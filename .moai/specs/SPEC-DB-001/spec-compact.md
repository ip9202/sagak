---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-DB-001
title: "Database Schema & RLS — Compact View"
spec: SPEC-DB-001
version: "1.2.0"
status: draft
auto_generated: true
source: spec.md
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [database, supabase, postgresql, rls, security, schema]
---

# SPEC-DB-001 Compact

> 본 문서는 spec.md에서 요구사항, 인수 기준, 수정 대상 파일, 제외 범위만 추출한
> 자동 생성 요약본이다. 전체 내용은 spec.md를 참조한다.
> 버전 1.2.0: 감사 리포트 iteration 2 결함(N1-N9) 수정 반영.

---

## 요구사항 모듈 (5개)

### Module 1: REQ-SCHEMA-CORE — 핵심 엔터티 스키마

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-DB-001 | users 테이블 정의 | auth.users 연동 트리거(SECURITY DEFINER), role/provider CHECK, admin은 예약값 |
| REQ-DB-002 | books 테이블 정의 | isbn UNIQUE, 카카오 API 캐시 |
| REQ-DB-003 | user_books 테이블 정의 | UNIQUE(user_id, book_id), status CHECK, is_public/last_progress_at/started_reading_at 비즈니스 컬럼 |

**인수 기준 요약**:
- auth 가입 시 public.users 자동 생성 (시나리오 8)
- (user_id, book_id) 중복 등록 차단 (시나리오 7)
- current_page 업데이트 시 last_progress_at 자동 갱신

---

### Module 2: REQ-SCHEMA-EMOTION — 감정 아카이브

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-DB-004 | emotion_records 테이블 정의 | visibility CHECK(public/club), club_id NOT NULL when visibility=club |
| REQ-DB-005 | sticker_reactions + ENUM 정의 | sticker_type ENUM(3종, ERD 편차 명시), UNIQUE(record_id, user_id) 위반 시 409 거부(업서트 미적용) |

**인수 기준 요약**:
- visibility=club 시 club_id 필수 (CHECK 제약)
- 기록당 사용자당 스티커 1개 제한, 위반 시 409 Conflict (시나리오 6, 결정론적)

---

### Module 3: REQ-SCHEMA-SOCIAL — 소셜 연결

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-DB-006 | clubs 테이블 정의 | type CHECK(group/instant, instant는 앱 단 거부), status CHECK(active/closed), 0명 출발 |
| REQ-DB-007 | club_members 테이블 정의 | UNIQUE(club_id, user_id), role CHECK(host/member) |
| REQ-DB-008 | join_requests 상태 기계 | UNIQUE(club_id, requester_id), status CHECK, 수락 시 club_members 자동 추가, status 재설정만 BEFORE UPDATE RAISE EXCEPTION으로 강제 거부 (terminal 행의 타 컬럼 편집 허용, N7) |
| REQ-DB-008b | clubs INSERT → host 자동 가입 트리거 (신규) | SECURITY DEFINER 트리거 handle_new_club_host, clubs INSERT 시 club_members(host) 자동 삽입 |

**인수 기준 요약**:
- join_requests 수락 → club_members 자동 INSERT (시나리오 2)
- 재처리 시도 → BEFORE UPDATE 트리거 RAISE EXCEPTION (에러 반환, 0행 커밋 아님)
- clubs 개설 → host 자동 가입 (시나리오 11, Track B 핵심)
- 비-host의 수락/거절 차단 (RLS)

---

### Module 4: REQ-SCHEMA-ENGAGE — 참여/보상

| REQ ID | 요구사항 | 주요 제약 |
|--------|---------|-----------|
| REQ-DB-009 | reading_sessions 테이블 정의 | 타이머 시작/종료, duration_seconds, pages_read |
| REQ-DB-010 | completion_reports + 자동 생성 트리거 | report_data jsonb(트리거가 emotion_records 집계하여 단독 계산, N2), 멱등성: UNIQUE(user_book_id) + ON CONFLICT DO NOTHING |
| REQ-DB-011 | point_logs 테이블 정의 | reason CHECK(completion/reaction/exchange), amount(양수=적립/음수=차감) |
| REQ-DB-012 | notifications 테이블 정의 | type ENUM(6종), is_read boolean, 서버 전용 INSERT(SECURITY DEFINER/service_role) |

**인수 기준 요약**:
- 완독 처리 시 리포트 자동 생성 (시나리오 3)
- completed→reading→completed 사이클 후에도 리포트 정확히 1개 (멱등성, D11)
- reading_sessions/point_logs/notifications 본인만 접근 (시나리오 12-14)

---

### Module 5: REQ-RLS — Row-Level Security (전체 테이블)

| REQ ID | 대상 테이블 | 정책 요약 |
|--------|-----------|-----------|
| REQ-DB-013a | 전체 (11 테이블) | RLS 활성화, 기본 거부 |
| REQ-DB-013b | books | RLS 활성화 + SELECT USING(true) 공개 정책 (정식 REQ, MUST-PASS) |
| REQ-DB-013c | 4개 트리거 | handle_new_user, join_request_accept, handle_new_club_host, generate_completion_report 모두 SECURITY DEFINER |
| REQ-DB-013d | fn_user_in_club 헬퍼 | SECURITY DEFINER 함수, 소유자 BYPASSRLS 역할(postgres), club_members 재귀 방지 (N9) |
| REQ-DB-013e | user_profiles, user_books_public 뷰 | 컬럼 마스킹용 보안 뷰 (MUST-PASS, EARS화 N4), Option A — RLS 단독·REVOKE 없음·자기 행은 베이스 테이블+RLS·타인은 뷰 제한 컬럼 (N1) |
| REQ-DB-014 | users | 본인 전체 조회(베이스 테이블+RLS own-row, Option A), 타인은 user_profiles 뷰(nickname/avatar만), 본인만 수정 |
| REQ-DB-015 | user_books | 본인 전체, 타인은 user_books_public 뷰(is_public=true 제한 컬럼만) |
| REQ-DB-016 | emotion_records | 본인 전체, public=전체, club=fn_user_in_club()로 멤버십 판정(재귀 없음) |
| REQ-DB-017 | sticker_reactions | 전체 읽기(USING true), 본인만 쓰기 |
| REQ-DB-018 | clubs | 전체 조회(공개 탐색), host만 수정/삭제, host_id=auth.uid() WITH CHECK |
| REQ-DB-019 | club_members | fn_user_in_club()로 같은 모임원만 조회, 서버(SECURITY DEFINER 트리거)가 INSERT, 본인만 탈퇴 |
| REQ-DB-020 | join_requests | 요청자 본인 + 대상 host만 조회, host만 status UPDATE |
| REQ-DB-021 | reading_sessions/completion_reports/point_logs/notifications | 본인만 조회, 서버(service_role/SECURITY DEFINER)가 INSERT |

**인수 기준 요약**:
- books 공개 카탈로그 접근 (시나리오 10)
- 타인 비공개 서재 행 차단 + 보안 뷰 (시나리오 1, 17)
- visibility=club 감정 기록 비멤버 차단 (시나리오 4)
- clubs 공개 조회 + host 전용 수정 (시나리오 5)
- club_members 재귀 없는 멤버십 판정 (시나리오 16)
- SECURITY DEFINER 트리거 검증 (시나리오 15)

---

## 수정 대상 파일 (Files to Modify/Create)

본 SPEC은 그린필드 프로젝트이므로 모든 파일이 신규 생성이다.

### 신규 생성 파일 (16개 마이그레이션)

| 파일 | 유형 | 내용 |
|------|------|------|
| `supabase/migrations/0001_create_users.sql` | 신규 | users 테이블 + auth 트리거(SECURITY DEFINER) |
| `supabase/migrations/0002_create_books.sql` | 신규 | books 카탈로그 |
| `supabase/migrations/0003_create_user_books.sql` | 신규 | user_books 서재 |
| `supabase/migrations/0004_create_clubs.sql` | 신규 | clubs 모임 + handle_new_club_host 트리거 |
| `supabase/migrations/0005_create_emotion_records.sql` | 신규 | emotion_records |
| `supabase/migrations/0006_create_sticker_enum_and_reactions.sql` | 신규 | ENUM + sticker_reactions |
| `supabase/migrations/0007_create_club_members.sql` | 신규 | club_members |
| `supabase/migrations/0008_create_join_requests.sql` | 신규 | join_requests + BEFORE UPDATE RAISE 트리거 + AFTER UPDATE ACCEPT 트리거 |
| `supabase/migrations/0009_create_reading_sessions.sql` | 신규 | reading_sessions |
| `supabase/migrations/0010_create_completion_reports.sql` | 신규 | completion_reports + UNIQUE(user_book_id) + ON CONFLICT DO NOTHING 트리거 |
| `supabase/migrations/0011_create_point_logs.sql` | 신규 | point_logs |
| `supabase/migrations/0012_create_notifications.sql` | 신규 | notifications |
| `supabase/migrations/0013_create_indexes.sql` | 신규 | 인덱스 12개 |
| `supabase/migrations/0014_enable_rls_and_policies.sql` | 신규 | RLS 활성화 + 정책 + fn_user_in_club 헬퍼 |
| `supabase/migrations/0015_create_security_views.sql` | 신규 | user_profiles 뷰 + user_books_public 뷰 + GRANT (Option A — REVOKE 없음) |
| `supabase/migrations/0016_create_triggers.sql` | 신규 | updated_at 트리거 |

### 참조 문서 (비수정)

| 파일 | 역할 |
|------|------|
| `.booktalk/pages_06_ERD.md` | 단일 출처 (읽기 전용 참조) |
| `.moai/project/db/schema.md` | 비권위 스켈레톤 (참고용, 수정 불가 — PostToolUse 훅 관리) |

---

## 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **Supabase Auth 제공자 설정** — 카카오/애플/구글 OAuth 앱 등록 (인프라 설정)
2. **Edge Function 로직** — kakao-book-search, process-join-request, generate-completion-report, send-notification
3. **프론트엔드 구현** — React Native/Expo 클라이언트 코드
4. **chat_messages 테이블** — 실시간 팝업 채팅 (확장 단계, pages_06 ERD 2.8)
5. **실시간 문득 모임 (type=instant) 로직** — 시그널 푸시, 팝업 채팅 (확장 단계, 앱 단 거부)
6. **Storage 버킷 설정** — 표지 이미지, 프로필 아바타 업로드 정책
7. **포인트 사용(굿즈 교환) 로직** — MVP는 point_logs 조회 전용
8. **데이터 마이그레이션/시드 데이터** — 초기 더미 데이터

---

## 미결정 사항 (해결 상태)

1. **clubs.auto_accept_requests 컬럼** — MVP 제외 (수동 승인 통일)
2. **스티커 자기 반응 허용 여부** — 해결됨: 허용, UNIQUE 위반 시 409 거부 (업서트 미적용, 결정론적)
3. **users 타인 조회 컬럼 노출 방식** — 해결됨: 보안 뷰(user_profiles, user_books_public) 채택, Option A — RLS 단독·베이스 테이블 REVOKE 없음 (REQ-DB-013e, N1 해결)
4. **report_data 소유권** — 해결됨: DB 트리거가 emotion_records 집계하여 단독 계산·즉시 채움, Edge Function은 트리거 호출 안 함 (REQ-DB-010, N2 해결)
5. **FK ON DELETE 정책** — 해결됨: 프로젝트 기본 RESTRICT, 사용자 콘텐츠 이력 보존 (REQ-SCHEMA-CORE 전역, N8 해결)
6. **SECURITY DEFINER 트리거 함수 위치** — 해결됨: 각 대상 테이블 생성 마이그레이션(0001/0004/0008/0010) 내 정의, fn_user_in_club만 0014 (N3 해결)
