---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-DB-001
title: "Database Schema & RLS — Implementation Plan"
spec: SPEC-DB-001
version: "1.2.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [database, supabase, postgresql, rls, security, schema]
---

# SPEC-DB-001 구현 계획

## 1. 개요

본 문서는 SPEC-DB-001(데이터베이스 스키마 및 RLS)의 구현 계획을 정의한다.
모든 데이터 모델의 단일 출처는 `.booktalk/pages_06_ERD.md`이다.

> **중요**: `/moai db init`이 생성한 `.moai/project/db/schema.md`(7개 추론 테이블)은
> 비권위 문서다. pages_06_ERD.md의 12개 엔터티 모델이 우선한다.

---

## 2. 마이그레이션 파일 구조

Supabase CLI 규칙(`supabase/migrations/{NNNN}_{name}.sql`)을 따른다.
마이그레이션은 의존성 순서대로 정렬된다.

### 마이그레이션 순서

| 순서 | 파일명 | 내용 | 의존성 |
|------|--------|------|--------|
| 1 | `0001_create_users.sql` | `users` 테이블 + `handle_new_user` 트리거(auth.users 연동, SECURITY DEFINER) | 없음 |
| 2 | `0002_create_books.sql` | `books` 카탈로그 테이블 | 없음 |
| 3 | `0003_create_user_books.sql` | `user_books` 서재 junction + UNIQUE + CHECK | users, books |
| 4 | `0004_create_clubs.sql` | `clubs` 모임 테이블 + CHECK + `handle_new_club_host` 트리거(SECURITY DEFINER) | users, books |
| 5 | `0005_create_emotion_records.sql` | `emotion_records` + CHECK(visibility/club_id) | users, books, clubs |
| 6 | `0006_create_sticker_enum_and_reactions.sql` | `sticker_type` ENUM + `sticker_reactions` + UNIQUE | emotion_records, users |
| 7 | `0007_create_club_members.sql` | `club_members` + UNIQUE + CHECK | clubs, users |
| 8 | `0008_create_join_requests.sql` | `join_requests` + UNIQUE + CHECK + 상태 전환 트리거(BEFORE UPDATE RAISE + AFTER UPDATE ACCEPT→member 삽입, SECURITY DEFINER) | clubs, users, club_members |
| 9 | `0009_create_reading_sessions.sql` | `reading_sessions` 타이머 세션 | users, books |
| 10 | `0010_create_completion_reports.sql` | `completion_reports` + UNIQUE(user_book_id) + 완독 자동 생성 트리거(ON CONFLICT DO NOTHING, SECURITY DEFINER) | users, books, user_books |
| 11 | `0011_create_point_logs.sql` | `point_logs` 포인트 내역 + CHECK | users |
| 12 | `0012_create_notifications.sql` | `notifications` 알림 로그 + CHECK | users |
| 13 | `0013_create_indexes.sql` | ERD 섹션 3의 모든 권장 인덱스 | 전체 |
| 14 | `0014_enable_rls_and_policies.sql` | RLS 활성화 + 모든 테이블 정책 (REQ-DB-013a ~ REQ-DB-021) + `fn_user_in_club` 헬퍼 함수(SECURITY DEFINER) | 전체 |
| 15 | `0015_create_security_views.sql` | `user_profiles` 뷰 + `user_books_public` 뷰 + GRANT (REQ-DB-013e, Option A — REVOKE 없음) | 전체 |
| 16 | `0016_create_triggers.sql` | `updated_at` 자동 갱신 트리거 (users, user_books, emotion_records) | 전체 |

### 순서 설계 원칙

1. **FK 의존성 준수**: 자식 테이블은 부모 테이블 이후에 생성.
   - `clubs`를 `emotion_records`보다 먼저 생성 (emotion_records.club_id FK).
2. **ENUM/타입 먼저**: `sticker_type` ENUM은 `sticker_reactions` 테이블보다 먼저.
3. **SECURITY DEFINER 트리거 함수는 각 대상 테이블 생성 마이그레이션 내에 정의**:
   `handle_new_user`는 `0001`(users), `handle_new_club_host`는 `0004`(clubs),
   `join_request_accept` (및 BEFORE UPDATE RAISE 가드)는 `0008`(join_requests),
   `generate_completion_report`는 `0010`(completion_reports)에 각각 정의한다
   (감사 리포트 N3 해결). 트리거 함수의 `SECURITY DEFINER` 속성은 RLS 활성화
   시점과 무관하게 동작한다(런타임에 RLS를 우회하므로, 정의 시점에 RLS가 없어도 됨).
   헬퍼 함수 `fn_user_in_club`만 `0014`에 정의한다 (RLS 정책 0014에서 참조하므로).
4. **보안 뷰는 RLS 이후**: 뷰(0015)는 베이스 테이블 RLS 정책(0014)이 확정된 후 생성.
5. **updated_at 트리거는 최종**: 보조 트리거는 모든 구조 확정 후.

---

## 3. 우선순위 마일스톤

### Primary Goal (1순위) — MVP 데이터 기반 + 보안 뷰

- `users`, `books`, `user_books` 테이블 생성 (마이그레이션 1-3)
- `emotion_records`, `sticker_reactions` 테이블 생성 (마이그레이션 5-6)
- 핵심 RLS 정책 적용 (users, user_books, emotion_records)
- 보안 뷰 `user_profiles`, `user_books_public` 생성 (마이그레이션 15) — MUST-PASS
- 인덱스 생성 (서재/피드 조회용)

> 이유: 감정 아카이브가 핵심 단독 가치이며, 컬럼 마스킹 보안 뷰는 민감 정보
> 누출 방지를 위해 MVP 필수 요구사항이다 (감사 리포트 D1).

### Secondary Goal (2순위) — 소셜 연결

- `clubs`, `club_members`, `join_requests` 테이블 생성 (마이그레이션 4, 7-8)
- `handle_new_club_host` 트리거 (clubs INSERT → host 자동 가입, SECURITY DEFINER)
- `join_request_accept` 트리거 (수락 → member 자동 추가, SECURITY DEFINER)
- `join_requests` 재처리 거부 BEFORE UPDATE 트리거 (RAISE EXCEPTION)
- `fn_user_in_club` 헬퍼 함수 (RLS 재귀 해제)
- Track A/B 브리지 RLS 정책 (clubs 공개 조회, join_requests 상태 기계)

> 이유: 연결은 완독을 돕는 수단이지만, 단독 가치 이후에 얹힌다. host 자동 가입과
> 재처리 거부는 Track B/A 핵심 플로우의 무결성 보장 요소다.

### Final Goal (3순위) — 참여/보상

- `reading_sessions`, `completion_reports`, `point_logs`, `notifications` (마이그레이션 9-12)
- 완독 자동 리포트 생성 트리거 (ON CONFLICT DO NOTHING 멱등 보장, SECURITY DEFINER)
- notifications 시스템 INSERT RLS 우회 설정 (SECURITY DEFINER / service_role)

---

## 4. 위험 분석 (Risk Analysis)

### 위험 1: RLS 정책 오구성 = 데이터 유출 (CRITICAL)

**위험**: emotion_records의 RLS 정책이 잘못 작성되면, `visibility='club'`인 비공개
감정 기록이 타인에게 노출될 수 있다. 이는 심리적 안전 훼손(PRUD 핵심 리스크)으로 이어진다.

**완화**:
- 모든 RLS 정책에 대해 Given/When/Then 인수 테스트 작성 (acceptance.md)
- RLS 정책 적용 후 데이터 누출 자동화 테스트 (서로 다른 사용자로 쿼리하여 행 노출 검증)
- `service_role` 사용을 Edge Function으로 엄격히 제한
- `fn_user_in_club` 헬퍼 함수로 emotion_records/club_members 재귀 방지 (D7)

### 위험 2: user_books 비즈니스 컬럼 기본값 오류 (HIGH)

**위험**: `is_public`, `last_progress_at`, `started_reading_at`의 기본값/갱신 로직이
잘못되면 Track A 독자 목록과 '같은 시기' 추천이 작동하지 않는다.

**완화**:
- `is_public` 기본값 `true` (공개가 기본)
- `current_page` UPDATE 시 `last_progress_at = now()` 갱신 트리거 필수
- "오늘부터 읽어요" 선언 시 `started_reading_at` 명시적 설정 (앱 로직)

### 위험 3: join_requests 상태 전환 경쟁 조건 및 재처리 (MEDIUM → 해결됨)

**위험**: 동일 요청에 대해 두 host가 동시에 수락/거절을 시도하거나, 이미 처리된 요청이
재처리되면 club_members에 중복 행이 삽입될 수 있다.

**완화 (감사 리포트 D3 + N7 해결)**:
- `UNIQUE(club_id, requester_id)` 제약으로 중복 방지
- **BEFORE UPDATE 트리거** `guard_join_request_status()`:
  `NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'`인 경우에만
  `RAISE EXCEPTION`으로 트랜잭션 중단. status 컬럼 재설정만 차단하며,
  terminal 행의 다른 컬럼(message, responded_at 등) 양성 편집은 허용 (N7 완화).
  이것은 0행 영향이 아니라 에러 반환을 보장한다.
- `join_request_accept` AFTER UPDATE 트리거는 `SECURITY DEFINER`로 실행
- club_members `UNIQUE(club_id, user_id)` 제약으로 최종 방어선

### 위험 4: completion_reports 중복 생성 (MEDIUM → 해결됨)

**위험**: 완독 처리가 여러 번 트리거되면 같은 user_book에 대해 여러 리포트가 생성된다.
특히 completed→reading→completed 사이클 시 재발화 위험이 있다.

**완화 (감사 리포트 D11 해결)**:
- 트리거에 `WHERE NEW.status = 'completed' AND OLD.status != 'completed'` 가드
- `completion_reports`에 `UNIQUE(user_book_id)` 제약 (멱등성 보장)
- 트리거 본문을 `INSERT ... ON CONFLICT (user_book_id) DO NOTHING`으로 명시
  (bare UNIQUE는 에러를 발생시키지만, ON CONFLICT DO NOTHING은 조용히 스킵)
- 인수 테스트에 completed→reading→completed 사이클 케이스 추가 (정확히 1개 행 보장)

### 위험 5: auth.users와 public.users 동기화 누락 (MEDIUM)

**위험**: `handle_new_user` 트리거가 실패하면 인증은 되었지만 프로필이 없는 사용자가 발생한다.

**완화**:
- 트리거를 `AFTER INSERT ON auth.users`로 설정
- `SECURITY DEFINER` 함수로 권한 보장 (REQ-DB-013c)
- 프로필 누락 감지용 모니터링 쿼리 (선택)

### 위험 6: 컬럼 마스킹 실패로 민감 정보 노출 (CRITICAL → 해결됨)

**위험**: PostgreSQL RLS는 행 수준만 지원하므로, 타인 행의 민감 컬럼(email,
reading_alarm_time 등)이 노출될 수 있다.

**완화 (감사 리포트 D1 + N1 해결)**:
- `public.user_profiles` 뷰(id, nickname, avatar_url만 노출) + `public.user_books_public`
  뷰(book_id, current_page, started_reading_at, user_id, is_public=true 행만 노출) 생성
- 베이스 테이블(users, user_books)의 `authenticated` SELECT를 **REVOKE하지 않음**
  (Option A): RLS own-row 정책이 자기 행만 노출하므로 권한 계층에서 거부할 필요 없음
- 자기 행 전체 조회는 베이스 테이블 + RLS로 지원; 타인 공개 정보는 뷰로만 제한 컬럼 노출
- 클라이언트는 타인 정보를 뷰를 통해서만 접근 (PostgREST 엔드포인트 `/rest/v1/user_profiles`)
- 이것은 MUST-PASS 요구사항 (REQ-DB-013e)

### 위험 7: RLS 재귀로 인한 멤버십 판정 실패 (HIGH → 해결됨)

**위험**: emotion_records의 `visibility='club'` 정책이 club_members 서브쿼리를 사용하면,
club_members 자체 RLS가 적용되어 재귀/빈 결과가 발생한다.

**완화 (감사 리포트 D7 해결)**:
- `fn_user_in_club(p_club_id uuid) RETURNS boolean` SECURITY DEFINER 함수 정의
- 이 함수는 `bypassrls` 또는 `service_role` 소유로 RLS를 우회하여 멤버십 판정
- emotion_records 및 club_members RLS 정책은 서브쿼리 대신 이 함수 호출 사용

---

## 5. 의존성 (Dependencies)

### 외부 의존성

- **Supabase CLI**: 마이그레이션 실행 도구 (`supabase db push`)
- **gen_random_uuid()**: PostgreSQL 13+ 코어 내장 (Supabase 기본 환경). 확장 불필요.
  PostgreSQL 12 이하에서만 `pgcrypto` 확장 필요 (감사 리포트 D8 해결).
- **Supabase Auth**: `auth.uid()` 함수, `auth.users` 테이블

### 내부 의존성 (SPEC 간)

본 SPEC은 데이터 계층의 기반이므로, 다른 모든 SPEC의 전제 조건이다:
- 인증 SPEC (예정): `users` 테이블 의존
- 감정 기록 SPEC (예정): `emotion_records`, `sticker_reactions` 의존
- 모임 SPEC (예정): `clubs`, `club_members`, `join_requests` 의존
- 타이머/완독 SPEC (예정): `reading_sessions`, `completion_reports` 의존

---

## 6. 기술 접근 방식

### 6.1 단일 스키마 + RLS 전략

모든 사용자 데이터는 `public` 스키마에共存하며, PostgreSQL RLS로 행 단위 격리를 수행한다.
이는 멀티테넌트 격리 전략 중 단일 스키마 방식을 선택한 것이다.

장점:
- 조인 쿼리 단순 (스키마 간 CROSS-SCHEMA 조인 불필요)
- 마이그레이션 관리 단순 (테이블 수 = 1배)
- Supabase PostgREST 자동 API와 자연스럽게 통합

단점:
- RLS 정책 오구성 시 데이터 유출 위험 (위험 1)
- 모든 쿼리에 RLS 오버헤드

### 6.2 컬럼 마스킹 전략: 보안 뷰 (REQ-DB-013e)

RLS는 행 수준만 지원하므로, 컬럼 수준 보호는 별도 메커니즘이 필요하다.
세 가지 후보 중 보안 뷰를 선택했다 (감사 리포트 D1):

| 후보 | 채택 여부 | 이유 |
|------|-----------|------|
| (a) column-level GRANT/REVOKE | 기각 | 컬럼별 GRANT는 관리 부담 크고, PostgREST와 통합 복잡 |
| (b) SECURITY DEFINER VIEW | **채택** | 선언적이고 PostgREST 자동 노출. RLS own-row 정책과 보완 동작 |
| (c) PostgREST 컬럼 필터 | 기각 | 클라이언트가 `select=` 생략하면 전체 노출 — 보장 없음 |

구현 (감사 리포트 N1 해결 — Option A: RLS 단독, REVOKE 없음):
- 뷰는 `security_invoker = false`(기본값)로 정의 → 뷰 소유자 권한으로 실행
- 베이스 테이블(users, user_books)의 `authenticated` SELECT를 **REVOKE하지 않음**
- RLS own-row 정책(`USING (auth.uid() = id)` / `USING (auth.uid() = user_id)`)이
  자기 행 전체 컬럼을 노출 — 자기 프로필/서재 전체 조회 지원
- 타인 행은 RLS에 의해 베이스 테이블에서 숨겨짐; 타인 공개 정보는 뷰로만 제한 컬럼 노출
- 뷰에 `authenticated` SELECT GRANT (PostgREST 자동 노출)
- REVOKE 불필요: PostgreSQL에서 GRANT/REVOKE가 RLS보다 선행 평가되므로,
  REVOKE 시 자기 행조차 RLS 정책 도달 전에 거부됨

### 6.3 트리거 vs Edge Function 분리

| 로직 | 구현 방식 | SECURITY DEFINER | 이유 |
|------|-----------|------------------|------|
| auth.users → public.users 동기화 | DB 트리거 | 예 (REQ-DB-013c) | 인증 직후 즉시 실행 보장 |
| clubs INSERT → host 멤버십 추가 | DB 트리거 | 예 (REQ-DB-013c) | Track B 원자성 보장 (REQ-DB-008b) |
| join_requests 수락 → club_members 추가 | DB 트리거 | 예 (REQ-DB-013c) | 원자성 보장 (트랜잭션 내) |
| join_requests 재처리 거부 | BEFORE UPDATE 트리거 | 해당 없음 | RAISE EXCEPTION으로 강제 거부 (REQ-DB-008) |
| 완독 → completion_reports 생성 | DB 트리거 | 예 (REQ-DB-013c) | 멱등성(ON CONFLICT DO NOTHING) + 원자성 |
| updated_at 자동 갱신 | DB 트리거 | 아니오 | 자기 테이블 UPDATE, RLS 우회 불필요 |
| current_page → last_progress_at 갱신 | DB 트리거 | 아니오 | 자기 테이블 UPDATE |
| 카카오 도서 검색 | Edge Function | 해당 없음 | 외부 API 호출 |
| 포인트 적립 | Edge Function | 해당 없음 | 복잡한 비즈니스 로직 |
| 푸시 알림 발송 | Edge Function | 해당 없음 | 외부 서비스(Expo Push) 호출 |

원칙: **데이터 정합성이 필요한 로직은 DB 트리거(SECURITY DEFINER), 외부 연동이
필요한 로직은 Edge Function.**

### 6.4 RLS 재귀 해제 전략 (REQ-DB-013d)

`fn_user_in_club(p_club_id uuid)` 헬퍼 함수:
- `SECURITY DEFINER`로 정의, 소유자는 `BYPASSRLS` 속성을 가진 역할(예: Supabase의
  `postgres` 슈퍼유저 역할) — `service_role`은 함수 호출 시 RLS 우회용 연결 역할일 뿐,
  함수 소유자로 권장하지 않는다 (감사 리포트 N9 해결)
- 내부적으로 `SELECT 1 FROM club_members WHERE user_id = auth.uid() AND club_id = p_club_id` 실행
- `club_members` RLS를 우회하므로 재귀 발생 안 함
- emotion_records 및 club_members 자체 RLS 정책에서 호출

---

## 7. SPEC 분할 제안 (선택적)

본 SPEC은 12개 엔터티를 5개 요구사항 모듈로 다루고 있다. 팀이 모듈당 집중도를
높이고자 한다면, 다음 3-way 분할을 권장한다:

| SPEC ID | 범위 | 엔터티 | 모듈 수 |
|---------|------|--------|---------|
| SPEC-DB-001a | 코어 + 감정 | users, books, user_books, emotion_records, sticker_reactions | 3 |
| SPEC-DB-002 | 소셜 연결 | clubs, club_members, join_requests | 2 |
| SPEC-DB-003 | 참여/보상 | reading_sessions, completion_reports, point_logs, notifications | 3 |

**권장**: MVP에서는 단일 SPEC-DB-001로 진행하고, 팀 규모가 커지면 분할 검토.
단, 보안 뷰(REQ-DB-013e)와 헬퍼 함수(REQ-DB-013d)는 모든 분할에서 공유되므로
001a에 포함해야 한다.

---

## 8. 참고 문서

| 문서 | 역할 |
|------|------|
| `.booktalk/pages_06_ERD.md` | **단일 출처 (SSOT)** — 데이터 모델의 최종 권위 |
| `.booktalk/pages_03_기능명세서.md` | 비즈니스 규칙 소스 (Track A/B, 스티커, 스포일러) |
| `.booktalk/pages_08_API명세서.md` | 쿼리 패턴 소스 (PostgREST 엔드포인트) |
| `.booktalk/pages_02_PRD.md` | 제품 목표 및 리스크 컨텍스트 |
| `.moai/project/structure.md` | 11개 엔터티 요약 + API 서피스 |
| `.moai/project/db/rls-policies.md` | RLS 정책 초안 (4개 미결정 사항 포함) |
| `.moai/project/db/schema.md` | 비권위 스켈레톤 (참고용, 충돌 시 SSOT가 우선) |
| `.moai/reports/plan-audit/SPEC-DB-001-review-1.md` | 감사 리포트 iteration 1 — v1.1.0 결함 수정 근거 |
| `.moai/reports/plan-audit/SPEC-DB-001-review-2.md` | 감사 리포트 iteration 2 — 본 버전(1.2.0) 결함 수정 근거 (N1-N9) |
