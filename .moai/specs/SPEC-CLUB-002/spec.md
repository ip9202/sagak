---
id: SPEC-CLUB-002
title: "Track B 개설형 모임 관리"
version: "1.1.0"
status: completed
created: 2026-06-14
updated: 2026-06-19
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [club, track-b, social, group, host, trigger, progress, rls]
---

# SPEC-CLUB-002: Track B 개설형 모임 관리

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 함께 읽기 모임 생성(0명 출발), host 자동 가입 트리거 연동, 모임 설정, 진도 동기화, 참가자·상태 관리 정의 | 강력쇠주먹 |
| 2026-06-19 | 1.1.0 | DB 스키마 정합성 복구 — clubs 진도 계획 컬럼(daily_pages, trigger_page, duration_days)을 마이그레이션 `20240618000006_add_club_reading_plan_columns.sql`로 추가. `title`→`name`, `min_members` 제거(0명 출발 정책과 상충) 매핑 명시. REQ-CLUBB-001/004/005/009~012 컬럼 정의 갱신. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android)
- **데이터베이스**: Supabase PostgreSQL — `clubs` (SPEC-DB-001 REQ-DB-006 + 본 SPEC 마이그레이션 `20240618000006_add_club_reading_plan_columns.sql`로 진도 계획 컬럼 추가), `club_members` (SPEC-DB-001 REQ-DB-007)
- **API 계층**: PostgREST (자동 REST API 생성) — `clubs` 테이블 CRUD
- **인증**: Supabase Auth (JWT) — `auth.uid()`로 사용자 식별
- **DB 트리거**: `handle_new_club_host` SECURITY DEFINER 함수 (SPEC-DB-001 REQ-DB-008b) — clubs INSERT 시 동일 트랜잭션에서 club_members host 행 자동 추가
- **RLS 정책**: `clubs`는 모든 authenticated 사용자에게 SELECT `USING(true)` (공개 탐색), INSERT는 `host_id = auth.uid()` WITH CHECK, UPDATE/DELETE는 host만 (SPEC-DB-001 REQ-DB-018). `club_members`는 `fn_user_in_club` 헬퍼 기반 같은 모임 멤버만 SELECT (SPEC-DB-001 REQ-DB-019)
- **API 클라이언트**: `supabase` 싱글톤 + 타입 안전 쿼리 래퍼 (SPEC-API-001 REQ-API-001)

### 단일 출처 (Single Source of Truth)

본 SPEC의 API 서피스는 `.moai/project/structure.md` "Clubs CRUD (모임 관리)" 섹션을 단일 출처로 한다.
`clubs`·`club_members` 테이블 스키마, RLS 정책, 트리거 정의는 `.moai/specs/SPEC-DB-001/spec.md` (REQ-DB-006, REQ-DB-007, REQ-DB-008b, REQ-DB-013c, REQ-DB-018, REQ-DB-019)와 `.moai/project/db/schema.md`에 기반한다.
0명 출발 정책과 host 자동 가입은 `.booktalk/pages_06_ERD.md` 2.6 및 SPEC-DB-001 가정 2.2.1을 따른다.

> **컬럼 매핑 주의 (2026-06-19 정합성 복구)**: 본 SPEC 초기 초안이 가정한 `clubs.title`은 실제 컬럼명 `clubs.name`으로 매핑된다. `clubs.min_members`는 0명 출발 정책(REQ-CLUBB-003)과 상충하므로 **제거**되었으며, 대신 `clubs.max_members`(상한)만 유지한다. 진도 계획 컬럼 `daily_pages`, `trigger_page`, `duration_days`는 본 SPEC 마이그레이션 `supabase/migrations/20240618000006_add_club_reading_plan_columns.sql`로 추가되었다 (모두 NULL 허용 + `>= 0` CHECK).

### 의존성

- **SPEC-DB-001** (선행, v1.2.0): `clubs`·`club_members` 스키마 + RLS 정책 + `handle_new_club_host` 트리거 완료
  - **참고**: SPEC-DB-001은 진도 계획 컬럼(`daily_pages`, `trigger_page`, `duration_days`)을 포함하지 않는다. 이 컬럼들은 본 SPEC 마이그레이션 `20240618000006_add_club_reading_plan_columns.sql`에서 `clubs` 테이블에 추가한다. dev/prod Supabase에 마이그레이션 적용 후 gen-types(`src/types/supabase.ts`)를 재생성해야 클라이언트 타입에 반영된다.
- **SPEC-BOOK-001** (선행): 모임용 책(`book_id`) 확보 — 검색·등록으로 생성된 `books.id` 사용
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, gen-types `Club`/`ClubMember` 타입, 에러 처리
- **SPEC-CLUB-001** (병행): Track A 합류 요청 — 본 SPEC이 생성한 모임에 Track A 요청 수신 가능 (단 Track B 생성은 본 SPEC 영역)
- **후속 SPEC**: SPEC-FEED-001 (모임 피드 — 본 SPEC이 생성한 모임의 진도별 피드 소비)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. 모임 생성 시 host 자동 가입은 **DB 트리거(`handle_new_club_host`)가 단독으로 처리**한다.
   클라이언트는 `clubs` INSERT만 수행하며, `club_members` INSERT는 절대 클라이언트가
   직접 호출하지 않는다 (SPEC-DB-001 REQ-DB-008b, REQ-DB-013c). 트리거는 SECURITY DEFINER
   함수로 RLS를 우회하여 동일 트랜잭션에서 host 멤버십 행을 생성한다. 클라이언트는 clubs
   INSERT 커밋 후 `club_members`에 host 행이 존재하는지만 확인한다 (검증용).
2. `clubs` INSERT RLS 정책(REQ-DB-018)은 `host_id = auth.uid()` WITH CHECK를 요구한다.
   클라이언트는 INSERT 본문에 `host_id`를 명시적으로 포함하거나, `auth.uid()`와 일치하는
   값을 전송해야 한다. 위반 시 RLS가 INSERT를 거부한다.
3. `clubs` 테이블의 `type` 컬럼은 CHECK 제약으로 `'group'`과 `'instant'`를 모두 허용하나
   (REQ-DB-006 D15), MVP에서 `type='instant'`는 **클라이언트/Edge 단에서 거부**한다.
   본 SPEC은 Track B(개설형 함께 읽기)만 다루므로, 모임 생성 시 `type='group'`을 강제한다.
4. 모임 상태 전환(`active ↔ closed`)은 host만 수행할 수 있다. RLS UPDATE 정책
   (REQ-DB-018: `auth.uid() = host_id`)이 이를 강제한다. 비host 멤버의 `clubs` UPDATE는
   RLS에 의해 거부된다.
5. `club_members` 행의 직접 INSERT/UPDATE는 클라이언트가 수행하지 않는다. host 가입은
   트리거가, member 가입은 Track A 승인 트리거(`join_request_accept`)가 처리한다
   (SPEC-CLUB-001 영역). 클라이언트는 `club_members` SELECT(같은 모임 멤버만, REQ-DB-019)
   및 본인 탈퇴 DELETE(`auth.uid() = user_id`)만 수행한다.

### 2.2 비즈니스 가정

1. Track B 모임은 **0명이어도 출발**한다. `clubs` 테이블은 최소 인원 컬럼을 두지 않는다
   (초안의 `min_members`는 0명 출발 정책과 상충하여 제거됨, 2026-06-19 정합성 복구).
   `max_members`(상한)만 존재하며, 개설 즉시 `status='active'`이고 host 1명으로 모임이
   활성화된다. 추후 멤버가 가입하지 않아도 모임은 유효하다 (pages_06 ERD 2.6,
   SPEC-DB-001 가정 2.2.1).
2. 모임 생성 시 사용자는 책(`book_id`)을 먼저 선택해야 한다. 책은 SPEC-BOOK-001 검색·등록
   플로우를 통해 확보된 `books.id`를 사용한다. 책 없는 모임은 허용되지 않는다
   (`book_id` NOT NULL FK, REQ-DB-006).
3. 모임 진도 동기화(`daily_pages`, `trigger_page` 업데이트)는 host만 수행한다. 이 값들은
   SPEC-FEED-001 스포일러 방지 피드의 진도 기준으로 사용되며, host가 모임원의 읽기 속도에
   맞춰 조정한다.
4. 모임 종료(`status='closed'`)는 host만 수행하며, 종료 후에도 데이터(`clubs` 행,
   `club_members`, 관련 `emotion_records`)는 보존된다 (FK ON DELETE RESTRICT 정책 —
   SPEC-DB-001 REQ-SCHEMA-CORE). closed 모임은 읽기 전용으로 전환된다.
5. Track B 모임도 Track A 합류 요청(SPEC-CLUB-001)을 수신할 수 있다. 즉, Track B로 개설된
   모임에 다른 사용자가 "같이 읽어요" 요청을 보낼 수 있으며, host가 승인하면 member로
   추가된다. 단, Track A 요청 처리 로직 자체는 SPEC-CLUB-001 영역이며 본 SPEC 범위 밖이다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-CLUBB-CREATE, REQ-CLUBB-HOST,
> REQ-CLUBB-PROGRESS, REQ-CLUBB-MANAGE.

### REQ-CLUBB-CREATE: 함께 읽기 모임 생성

**목적**: 사용자가 함께 읽기 모임(type='group')을 개설한다. 0명 출발 정책에 따라
개설 즉시 활성화되며, 최소 인원 게이트가 없다.

#### REQ-CLUBB-001: 모임 생성 엔드포인트

시스템은 **항상** `clubs` 테이블에 대한 PostgREST INSERT 엔드포인트를 통해 모임 생성을
지원해야 한다. 클라이언트는 `supabase.from('clubs').insert({...}).select().single()`을
호출하여 새 모임을 생성한다.

**WHEN** 인증된 사용자가 모임 생성을 요청하면,
**THEN** 시스템은 `clubs` INSERT를 수행해야 하며, 이때 `host_id`는 `auth.uid()`와
일치해야 한다 (RLS WITH CHECK, REQ-DB-018).
**AND** INSERT 본문은 `book_id`(NOT NULL), `name`(NOT NULL — 모임명), `type='group'`을 반드시
포함해야 한다. (초안의 `title`은 실제 컬럼명 `name`으로 매핑됨, 2026-06-19 정합성 복구.)

#### REQ-CLUBB-002: type='group' 강제 (instant 거부)

**IF** 모임 생성 요청의 `type` 값이 `'instant'`이거나 누락된 경우,
**THEN** 시스템은 클라이언트가 `type='group'`을 명시적으로 설정하도록 강제해야 한다.
`type` 누락 시 NOT NULL 제약으로 INSERT가 실패하며, `type='instant'`는 클라이언트 검증
단에서 거부한다 (REQ-DB-006 D15, MVP instant 미지원).

#### REQ-CLUBB-003: 0명 출발 허용 (최소 인원 게이트 없음)

**WHILE** 모임이 생성되는 동안,
**THEN** 시스템은 최소 인원 게이트를 적용하지 않아야 한다. `clubs` 테이블은 최소 인원
컬럼을 두지 않는다 (초안의 `min_members`는 0명 출발 정책과 상충하여 제거됨,
2026-06-19 정합성 복구; `max_members` 상한만 존재). 개설 즉시 `status='active'`이며
host 1명으로 모임이 활성화된다 (pages_06 ERD 2.6, SPEC-DB-001 가정 2.2.1).

#### REQ-CLUBB-004: 모임 설정 입력

**WHEN** 사용자가 모임 생성 폼을 작성하면,
**THEN** 시스템은 다음 설정 값을 선택적으로 수집하여 `clubs` INSERT에 포함해야 한다:
`description`(모임 설명), `duration_days`(목표 완독 기간, 일 단위), `daily_pages`(일일 권장 페이지),
`trigger_page`(트리거 페이지 — 특정 페이지 도달 시 이벤트 기준).

**컬럼 정의 (마이그레이션 `20240618000006_add_club_reading_plan_columns.sql`, 2026-06-19 추가)**:
- `daily_pages integer` — NULL 허용, `CHECK (daily_pages IS NULL OR daily_pages >= 0)`
- `trigger_page integer` — NULL 허용, `CHECK (trigger_page IS NULL OR trigger_page >= 0)`
- `duration_days integer` — NULL 허용, `CHECK (duration_days IS NULL OR duration_days >= 0)`

이 값들은 NULL을 허용하며, host가 추후 진도 동기화(REQ-CLUBB-PROGRESS)에서 업데이트할 수 있다.
0명 출발 정책(REQ-CLUBB-003)과 일관되게 모임 개설 시 필수가 아니다.

#### REQ-CLUBB-005: 모임 생성 결과 반환

**WHEN** `clubs` INSERT가 성공하면,
**THEN** 시스템은 생성된 `clubs` 행의 전체 객체(`id`, `host_id`, `book_id`, `type`,
`name`, `status='active'`, `created_at`, `description`, `max_members`, `daily_pages`,
`trigger_page`, `duration_days`)를 `.select().single()`로 반환해야 한다.
**AND** 반환된 `clubs.id`는 후속 모임 관리 화면(host)의 라우팅 파라미터로 사용된다.

---

### REQ-CLUBB-HOST: host 자동 가입 트리거 연동

**목적**: 모임 생성 시 DB 트리거(`handle_new_club_host`)가 동일 트랜잭션에서 host
멤버십을 자동 생성함을 클라이언트가 확인하고, 직접 `club_members` INSERT를 수행하지
않도록 보장한다.

#### REQ-CLUBB-006: 클라이언트 club_members INSERT 금지

시스템은 **항상** 클라이언트가 `club_members` 테이블에 직접 INSERT를 수행하지 않도록
해야 한다. host 가입은 `handle_new_club_host` 트리거(REQ-DB-008b)가 단독 처리하며,
클라이언트가 `club_members` INSERT를 시도하면 RLS 정책(REQ-DB-019 — 클라이언트 INSERT
정책 없음)에 의해 거부된다.

#### REQ-CLUBB-007: host 멤버십 존재 확인

**WHEN** `clubs` INSERT가 성공적으로 커밋된 후,
**THEN** 시스템은 클라이언트가 `club_members` 테이블에서
`(club_id=새 모임 id, user_id=auth.uid(), role='host')` 행이 존재하는지 조회하여
트리거가 정상 동작했음을 확인해야 한다.

**IF** host 멤버십 행이 존재하지 않으면,
**THEN** 시스템은 트리거 실패로 간주하고 사용자에게 "모임 생성 중 오류가 발생했습니다"
메시지를 표시해야 한다 (트리거 미배포 또는 RLS 권한 문제를 나타냄).

#### REQ-CLUBB-008: host 멤버십 조회 권한

**WHILE** host가 자신의 모임 멤버십을 확인하는 동안,
**THEN** 시스템은 `club_members` RLS 정책(REQ-DB-019 — `fn_user_in_club(club_id)`가
true인 행만 SELECT)에 의해 host 본인의 멤버십 행을 조회할 수 있도록 해야 한다.
host는 자신이 속한 모임이므로 `fn_user_in_club`이 true를 반환한다.

---

### REQ-CLUBB-PROGRESS: 진도 동기화

**목적**: host가 모임의 진도 설정(`daily_pages`, `trigger_page`)을 업데이트하여
모임원의 읽기 속도를 동기화한다. 이 값은 SPEC-FEED-001 스포일러 방지 피드의 진도
기준으로 사용된다.

#### REQ-CLUBB-009: 진도 업데이트 엔드포인트

시스템은 **항상** `clubs` 테이블에 대한 PostgREST UPDATE를 통해 모임 진도 동기화를
지원해야 한다. 클라이언트는 `supabase.from('clubs').update({ ... }).eq('id', clubId)`를
호출하여 진도를 업데이트한다.

**WHEN** host가 모임 진도를 업데이트하면,
**THEN** 시스템은 `daily_pages` 및/또는 `trigger_page` 컬럼을 업데이트해야 한다
(컬럼 정의는 REQ-CLUBB-004 및 마이그레이션 `20240618000006_add_club_reading_plan_columns.sql` 참조).
**AND** UPDATE는 RLS 정책(REQ-DB-018: `auth.uid() = host_id`)에 의해 host만 수행할 수 있다.

#### REQ-CLUBB-010: 비host 진도 업데이트 차단

**IF** host가 아닌 사용자가 모임 진도 업데이트를 시도하면,
**THEN** 시스템은 RLS UPDATE 정책(REQ-DB-018)에 의해 UPDATE를 거부해야 한다.
**AND** 클라이언트는 SPEC-API-001 에러 처리 체계를 통해 사용자에게 "모임 진도는
호스트만 변경할 수 있습니다" 메시지를 표시해야 한다.

#### REQ-CLUBB-011: 진도 업데이트 입력 검증

**WHILE** host가 진도 업데이트 폼을 작성하는 동안,
**THEN** 시스템은 `daily_pages`가 0 이상의 정수인지, `trigger_page`가 0 이상의 정수인지
검증해야 한다. 음수 또는 비정수 값은 클라이언트 단에서 차단한다.
DB 컬럼 CHECK 제약(`daily_pages >= 0`, `trigger_page >= 0`)이 2차 방어선 역할을 한다
(마이그레이션 `20240618000006_add_club_reading_plan_columns.sql`).

#### REQ-CLUBB-012: closed 모임 진도 업데이트 차단

**IF** 모임 `status='closed'`인 상태에서 진도 업데이트를 시도하면,
**THEN** 시스템은 클라이언트가 업데이트를 차단하고 "종료된 모임은 진도를 변경할 수
없습니다" 메시지를 표시해야 한다. closed 모임은 읽기 전용이다 (가정 2.2.4).

---

### REQ-CLUBB-MANAGE: 참가자·상태 관리 (host 권한)

**목적**: host가 모임 참가자 목록을 조회하고, 모임 상태(active/closed)를 관리한다.
비host 멤버는 자신의 탈퇴만 수행할 수 있다.

#### REQ-CLUBB-013: 모임 멤버 목록 조회

**WHEN** host가 모임 관리 화면에 진입하면,
**THEN** 시스템은 `club_members` 테이블에서 해당 `club_id`의 모든 멤버 행을 조회해야 한다
(`supabase.from('club_members').select('*, users(...)').eq('club_id', clubId)`).
**AND** RLS 정책(REQ-DB-019 — `fn_user_in_club(club_id)`)에 의해 host가 속한 모임의
멤버만 조회할 수 있다.

#### REQ-CLUBB-014: 모임 상태 변경 (active → closed)

**WHEN** host가 모임 종료를 요청하면,
**THEN** 시스템은 `clubs` 테이블의 `status`를 `'closed'`로 UPDATE해야 한다
(`supabase.from('clubs').update({ status: 'closed' }).eq('id', clubId)`).
**AND** UPDATE는 RLS 정책(REQ-DB-018: `auth.uid() = host_id`)에 의해 host만 수행할 수 있다.

#### REQ-CLUBB-015: closed → active 재활성화 허용

**IF** host가 종료된 모임(`status='closed'`)을 다시 활성화하려 하면,
**THEN** 시스템은 `status`를 `'active'`로 UPDATE하는 것을 허용해야 한다 (status ENUM
`active/closed`는 양방향 전환을 허용, REQ-DB-006). 단, closed 모임 피드 보존 정책은
미결정 사항 6.1에서 별도 확정한다.

#### REQ-CLUBB-016: 멤버 자발적 탈퇴

**WHEN** 모임 멤버(host 또는 member)가 자발적 탈퇴를 요청하면,
**THEN** 시스템은 `club_members`에서 해당 행을 DELETE해야 한다
(`supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', auth.uid())`).
**AND** RLS DELETE 정책(REQ-DB-019: `auth.uid() = user_id`)에 의해 본인 멤버십만 삭제할 수 있다.

**IF** host가 유일한 멤버인 상태에서 탈퇴를 시도하면,
**THEN** 시스템은 host 탈퇴 전 모임 종료(`status='closed'`)를 유도하거나, host 탈퇴 시
고아 모임(orphan club)이 되는 점을 사용자에게 경고해야 한다 (미결정 사항 6.2).

#### REQ-CLUBB-017: 모임 상세 조회

**WHEN** 인증된 사용자가 모임 상세를 요청하면,
**THEN** 시스템은 `supabase.from('clubs').select('*, books(...), club_members(...)')`
.eq('id', clubId).single()`을 실행하여 모임 정보와 연관된 책·멤버를 반환해야 한다.
**AND** RLS 정책(REQ-DB-018 — 모든 authenticated SELECT `USING(true)`)에 의해 모든
사용자가 조회할 수 있다 (공개 탐색 허용).

---

## 4. API 서피스 매핑 (API Surface Mapping)

본 SPEC은 `.moai/project/structure.md` "Clubs CRUD (모임 관리)" 엔드포인트의 Track B
구현을 정의한다.

| 엔드포인트 | 구현 메커니즘 | REQ |
|-----------|--------------|-----|
| `POST /clubs` | PostgREST `clubs` INSERT (type='group' 강제) | REQ-CLUBB-001~005 |
| `GET /clubs/{id}` | PostgREST `clubs` SELECT 단일 행 | REQ-CLUBB-017 |
| `PUT /clubs/{id}/progress` | PostgREST `clubs` UPDATE (`daily_pages`, `trigger_page`) | REQ-CLUBB-009~012 |
| host 자동 가입 | DB 트리거 `handle_new_club_host` (클라이언트 개입 없음) | REQ-CLUBB-006~008 |
| 멤버 목록 | PostgREST `club_members` SELECT | REQ-CLUBB-013 |
| 모임 종료/재활성화 | PostgREST `clubs` UPDATE (`status`) | REQ-CLUBB-014, 015 |
| 멤버 탈퇴 | PostgREST `club_members` DELETE | REQ-CLUBB-016 |

> `POST /clubs/{id}/join` (Track A 합류 요청)은 SPEC-CLUB-001 영역이며 본 SPEC 범위 밖이다.
> `GET /clubs/{id}/feed` (진도별 피드)는 SPEC-FEED-001 영역이다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **실시간 채팅 (type='instant')**: 시그널 푸시, 팝업 채팅 로직은 MVP 비목표이며
   (product.md "비목표"), `type='instant'` 모임 생성은 본 SPEC에서 거부한다 (REQ-CLUBB-002).
2. **모임 피드**: 진도별 슬라이딩 피드, 스포일러 방지 블러는 SPEC-FEED-001이 처리한다.
   본 SPEC은 진도 설정(`daily_pages`, `trigger_page`)까지만 책임진다.
3. **Track A 합류 요청 로직**: `join_requests` 상태 기계, host 승인/거절 UI, Track A
   독자 목록은 SPEC-CLUB-001 영역이다. 단, Track B 모임도 Track A 요청 수신은 가능하다
   (가정 2.2.5).
4. **자동 수락 (auto_accept)**: `auto_accept_requests` 컬럼은 MVP에서 제외되며
   (SPEC-DB-001 미결정 사항 6.1), 모든 Track A 요청은 수동 승인이다.
5. **모임 검색·추천**: "같은 책 읽는 모임", "같은 시기 모임" 추천은 추후 SPEC에서 처리한다.
   본 SPEC은 `clubs` SELECT `USING(true)`로 공개 탐색이 가능하지만 추천 알고리즘은 미구현이다.
6. **host 위임 (호스트 변경)**: host 권한을 다른 멤버에게 이양하는 로직은 미결정 사항
   (6.2)이며 MVP 범위 밖이다.
7. **감정 기록 연동**: 모임 피드 내 감정 기록 표시는 SPEC-FEED-001 영역이다. 본 SPEC은
   모임 진도 설정까지만 책임진다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 모임 종료(closed) 시 데이터 보존 정책 — 미해결

모임이 `status='closed'`로 전환된 후, 관련 데이터(`club_members`, `emotion_records`
visibility='club')의 보존 기간 및 접근 권한이 미확정이다.

**현재 결정**: closed 모임의 모든 데이터는 보존되며(FK ON DELETE RESTRICT), 멤버는
읽기 전용으로 접근할 수 있다. 진도 업데이트는 차단된다 (REQ-CLUBB-012).

**후보**:
- (A) 영구 보존 (현재 기본 — 감정 아카이브 가치 존중)
- (B) closed 후 N일 경과 시 아카이브 분리
- (C) host가 closed 시 데이터 삭제 옵션 제공

**영향 범위**: 스토리지 비용, 사용자 프라이버시, 감정 아카이브 가치.

**해결 시점**: SPEC-FEED-001 구현 시 모임 피드 보존 정책과 함께 확정.

### 6.2 host 위임 (호스트 변경) — 미해결

host가 모임을 떠나야 할 때, 다른 멤버에게 host 권한을 이양하는 로직이 미확정이다.

**현재 결정**: MVP에서는 host 위임을 지원하지 않는다. host 탈퇴 시 고아 모임(orphan
club)이 되며, 시스템은 사전 경고를 표시한다 (REQ-CLUBB-016). 고아 모임은 `status='closed'`로
전환을 유도한다.

**후보**:
- (A) host 위임 UI 추가 (`club_members.role` 업데이트)
- (B) host 탈퇴 시 자동으로 가장 오래된 member를 host로 승격
- (C) host 탈퇴 시 모임 자동 종료

**영향 범위**: 모임 지속성, 사용자 경험.

**해결 시점**: 사용자 피드백 기반 확정, 또는 SPEC-CLUB-001 Track A 패턴 참조.

### 6.3 진도 동기화 주기 — 미해결

host가 모임 진도를 업데이트하는 권장 주기(일일/주간/이벤트 기반)가 미확정이다.

**현재 결정**: 진도 동기화는 host가 수동으로 수행하며, 자동 알림이나 스케줄링은
지원하지 않는다 (SPEC-NOTIF-001 연동 시 별도 검토).

**영향 범위**: 모임원의 독서 속도 동기화 품질, SPEC-FEED-001 피드 진도 기준 정확도.

**해결 시점**: SPEC-FEED-001 구현 시 진도 기반 슬라이딩 윈도우 설계와 함께 확정.

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-CLUB-002 | REQ-CLUBB-001 ~ REQ-CLUBB-017 | `.moai/project/product.md`(핵심 기능 "Track B 개설형"), `.moai/project/structure.md`(API 서피스 Clubs CRUD), `.moai/specs/SPEC-DB-001/spec.md`(REQ-DB-006 clubs, REQ-DB-007 club_members, REQ-DB-008b host 자동 가입 트리거, REQ-DB-013c SECURITY DEFINER, REQ-DB-018 clubs RLS, REQ-DB-019 club_members RLS), `.moai/project/db/schema.md`(clubs·club_members 스키마), `.booktalk/pages_06_ERD.md`(2.6 clubs 엔터티, 0명 출발 정책), `.moai/specs/INDEX.md`(SPEC 카탈로그) |
| REQ-CLUBB-CREATE | REQ-CLUBB-001 ~ REQ-CLUBB-005 | structure.md "POST /clubs", SPEC-DB-001 REQ-DB-006(type ENUM, min_members 게이트 아님), pages_06 ERD 2.6 |
| REQ-CLUBB-HOST | REQ-CLUBB-006 ~ REQ-CLUBB-008 | SPEC-DB-001 REQ-DB-008b(handle_new_club_host 트리거), REQ-DB-013c(SECURITY DEFINER), REQ-DB-019(club_members RLS) |
| REQ-CLUBB-PROGRESS | REQ-CLUBB-009 ~ REQ-CLUBB-012 | structure.md "PUT /clubs/{id}/progress", SPEC-DB-001 REQ-DB-018(clubs UPDATE RLS — host만) |
| REQ-CLUBB-MANAGE | REQ-CLUBB-013 ~ REQ-CLUBB-017 | structure.md "GET /clubs/{id}", SPEC-DB-001 REQ-DB-018(clubs RLS), REQ-DB-019(club_members RLS), pages_06 ERD 2.6(status active/closed) |
