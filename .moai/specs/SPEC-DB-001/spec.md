---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-DB-001
title: "Database Schema & Row-Level Security"
version: "1.2.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [database, supabase, postgresql, rls, security, schema]
---

# SPEC-DB-001: Database Schema & Row-Level Security

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 12개 엔터티 스키마 + RLS 정책 정의 | 강력쇠주먹 |
| 2026-06-14 | 1.1.0 | 감사 리포트(iteration 1) 결함 전수 수정: D1 컬럼 마스킹→보안 뷰, D2 host 자동 가입 트리거, D3 재처리 거부 BEFORE UPDATE RAISE, D4 SECURITY DEFINER 트리거, D5 books 정식 REQ, D6 추적성 복원, D7 RLS 재귀 해제 헬퍼 함수, D8 pg_graphic 수정, D9-D11 AC/멱등성 수정, MP-3 labels 추가 | 강력쇠주먹 |
| 2026-06-14 | 1.2.0 | 감사 리포트(iteration 2) 결함 수정: N1 권한/RLS 모순 제거(Option A — REVOKE 폐지, RLS 단독), N2 report_data 소유권 명시(트리거 단독), N3 트리거 마이그레이션 위치 정정, N4 REQ-DB-013e EARS화, N5 컬럼 리스트 단정, N6 비실행 시나리오 정정, N7 트리거 과블록 완화, N8 FK ON DELETE RESTRICT 정책, N9 fn_user_in_club 소유자 명확화 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **데이터베이스 엔진**: Supabase (관리형 PostgreSQL 15+)
- **API 계층**: PostgREST (자동 REST API 생성)
- **실시간**: Supabase Realtime (postgres_changes 구독)
- **인증**: Supabase Auth (`auth.users` 내부 스키마, `auth.uid()` 함수)
- **마이그레이션 도구**: Supabase CLI (`supabase/migrations/*.sql`)
- **격리 전략**: 단일 스키마(`public`) + RLS(Row-Level Security) 행 단위 격리
- **서버 사이드 로직**: Edge Functions (Deno 런타임) — `service_role` 키로 RLS 우회

### 단일 출처 (Single Source of Truth)

본 SPEC의 데이터 모델은 `.booktalk/pages_06_ERD.md`를 단일 출처로 한다.
`/moai db init`이 생성한 `.moai/project/db/schema.md` 스켈레톤(7개 추론 테이블)은
**비권위 문서**이며, 본 SPEC과 충돌할 경우 pages_06_ERD.md가 우선한다.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. `public.users.id`는 `auth.users.id`와 1:1 매핑된다 (동일 UUID). 회원가입 시
   `auth.users` 생성과 함께 `public.users` 프로필 행이 트리거로 자동 삽입된다.
2. `service_role` 키는 Edge Functions(서버 측)에서만 사용되며, 모든 RLS를 우회한다.
   클라이언트는 절대 `service_role` 키를 갖지 않는다.
3. 모든 타임스탬프 컬럼은 `timestamptz`(UTC) 타입을 사용한다.
4. 모든 PK는 `uuid` 타입이며 `gen_random_uuid()` 기본값을 가진다.
   `gen_random_uuid()`는 PostgreSQL 13+에서 코어에 내장되어 있으며(Supabase 기본 환경),
   별도 확장 설치가 불필요하다. PostgreSQL 12 이하에서는 `pgcrypto` 확장이 필요하다.

### 2.2 비즈니스 가정

1. Track B(개설형) 모임은 개설 즉시 `status='active'`이며, 최소 인원 게이트가 없다
   (0명 출발). 개설자는 `clubs` INSERT 시 `SECURITY DEFINER` 트리거로 자동으로
   `club_members(role='host')`에 추가된다 (REQ-DB-008b 참조).
2. Track A(합류형) 요청은 `pending → accepted | declined` 상태 기계를 따른다.
   수락 시 `club_members(role='member')`에 자동 추가된다. 상태 전환은 `pending`에서만
   허용되며, 이미 처리된(`accepted`/`declined`) 요청의 재업데이트는 `BEFORE UPDATE`
   트리거가 예외를 발생시켜 강제 거부한다 (REQ-DB-008 참조).
3. 감정 기록은 `visibility` 컬럼으로 공개 범위를 제어한다:
   `public`(전체 인증 사용자) 또는 `club`(해당 모임원만).
4. 스티커 리액션은 기록당 사용자당 1개만 허용된다 (`UNIQUE(record_id, user_id)`).
   MVP에서는 자기 반응을 허용하며(ERD 제약과 일치), UNIQUE 위반 시 409 Conflict로
   거부한다(업서트 미적용 — 미결정 사항 6.2 해결).
5. 완독 처리(`user_books.status: reading → completed`) 시 `completion_reports`가
   자동 생성된다 (멱등성: `ON CONFLICT (user_book_id) DO NOTHING`).

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 5개 요구사항 모듈로 구성된다: REQ-SCHEMA-CORE, REQ-SCHEMA-EMOTION,
> REQ-SCHEMA-SOCIAL, REQ-SCHEMA-ENGAGE, REQ-RLS.

### REQ-SCHEMA-CORE: 핵심 엔터티 스키마 (users, books, user_books)

**목적**: 사용자 프로필, 도서 카탈로그, 개인 서재의 데이터 구조를 정의한다.

#### REQ-DB-001: users 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `users` 테이블을 유지해야 한다:
`id(uuid PK)`, `email(text UNIQUE NOT NULL)`, `nickname(text NOT NULL)`,
`avatar_url(text)`, `provider(text NOT NULL)`, `reading_alarm_time(time)`,
`reading_alarm_enabled(boolean default true)`, `role(text default 'member')`,
`created_at(timestamptz default now())`, `updated_at(timestamptz default now())`.

**WHEN** `auth.users`에 새 사용자가 생성되면,
**THEN** 시스템은 `public.users`에 대응하는 프로필 행을 자동으로 삽입해야 한다
(`handle_new_user` 트리거, `SECURITY DEFINER` 함수).

**WHILE** `role` 컬럼 값이 설정 중일 때,
**THEN** 시스템은 값이 `'member'` 또는 `'admin'` 중 하나임을 CHECK 제약으로 보장해야 한다.
> `role='admin'`은 향후 관리자 기능(사용자 프로필 조정 등)을 위해 예약된 값이다.
> MVP에서는 `role='admin'`에 대한 추가 권한 정책을 정의하지 않으며, admin 행의 타인
> 수정은 지원하지 않는다 (REQ-DB-014 참조). 추후 관리자 모듈 추가 시 별도 RLS 정책
> 도입이 필요하다.

**WHERE** `provider` 컬럼이 존재하면,
**THEN** 시스템은 값이 `'kakao'`, `'naver'`, `'google'` 중 하나임을 보장해야 한다.

> **제공자 선정 이유**: 카카오/네이버/구글은 한국 시장 주류 OAuth 조합이다.
> Apple 제외: App Store Guideline 4.8 한국 예외 조항 적용.
> 네이버는 Supabase Custom OIDC(2026년 6월 기능)로 연동된다.

#### REQ-DB-002: books 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `books` 테이블을 유지해야 한다:
`id(uuid PK)`, `isbn(text UNIQUE NOT NULL)`, `title(text NOT NULL)`,
`author(text NOT NULL)`, `publisher(text)`, `published_at(date)`,
`cover_url(text)`, `total_pages(integer)`, `kakao_id(text)`, `created_at(timestamptz default now())`.

> books는 카카오 도서 검색 API 결과의 캐시 테이블이다. 수동 입력 도서도 저장된다.

#### REQ-DB-003: user_books 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `user_books` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`,
`status(text NOT NULL)`, `current_page(integer default 0)`,
`is_public(boolean default true)`, `started_reading_at(timestamptz)`,
`last_progress_at(timestamptz)`, `completed_at(timestamptz)`,
`created_at(timestamptz default now())`, `updated_at(timestamptz default now())`.

**WHILE** `user_books` 행이 존재하는 동안,
**THEN** 시스템은 `(user_id, book_id)` 조합의 고유성을 UNIQUE 제약으로 보장해야 한다
(같은 사용자의 같은 책 중복 등록 방지).

**WHILE** `status` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'reading'`, `'completed'`, `'shelved'` 중 하나임을 보장해야 한다.

**WHEN** 사용자가 `current_page`를 업데이트하면,
**THEN** 시스템은 `last_progress_at`을 `now()`로 갱신해야 한다 (활성도 판정용).

**WHEN** `status`가 `'reading'`에서 `'completed'`로 전환되면,
**THEN** 시스템은 `completed_at`을 `now()`로 설정해야 한다.

> `is_public`, `last_progress_at`, `started_reading_at`은 Track A 독자 목록 및
> '같은 시기' 추천의 핵심 컬럼이다 (pages_06 ERD 2.3 참고).

##### FK ON DELETE 프로젝트 정책 (REQ-SCHEMA-CORE 전역)

시스템은 **항상** 모든 외래키에 대해 프로젝트 기본 `ON DELETE` 동작으로
`RESTRICT`(PostgreSQL 기본값)을 적용해야 한다 (감사 리포트 N8 해결).

이유: 사용자 콘텐츠(emotion_records, sticker_reactions, reading_sessions,
completion_reports 등)는 이력/감정 아카이브 가치를 가지며, 부모 행(users,
user_books, clubs) 삭제 시 자동 CASCADE로 소실되어서는 안 된다. 대신 앱 계층에서
소프트 삭제(status 컬럼 전환, `left_at` 설정 등)로 수명을 관리한다.

예외 (명시적 CASCADE 필요 시 별도 주석):
- `club_members.club_id → clubs.id`: RESTRICT (멤버 존재 시 모임 삭제 차단).
- `join_requests.club_id → clubs.id`: RESTRICT.
- `completion_reports.user_book_id → user_books.id`: RESTRICT (완독 리포트 보존).
- `emotion_records.user_id → users.id`, `emotion_records.book_id → books.id`: RESTRICT.

하드 삭제가 필요한 경우(예: GDPR 계정 삭제 요청)는 별도 데이터 삭제 Edge Function이
의존 순서대로 자식 행을 명시적 DELETE하는 방식으로 처리하며, 본 SPEC 범위 밖이다.

---

### REQ-SCHEMA-EMOTION: 감정 아카이브 엔터티 (emotion_records, sticker_reactions)

**목적**: 핵심 제품 가치인 페이지별 감정 기록과 공감 스티커 리액션의 데이터 구조를 정의한다.

#### REQ-DB-004: emotion_records 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `emotion_records` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`,
`page_number(integer NOT NULL)`, `content(text NOT NULL)`,
`visibility(text default 'public')`, `club_id(uuid FK→clubs.id, nullable)`,
`created_at(timestamptz default now())`, `updated_at(timestamptz default now())`.

**WHILE** `visibility` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'public'` 또는 `'club'` 중 하나임을 보장해야 한다.

**IF** `visibility='club'`이면,
**THEN** 시스템은 `club_id`가 NOT NULL임을 CHECK 제약으로 보장해야 한다.

#### REQ-DB-005: sticker_reactions 테이블 및 ENUM 정의

시스템은 **항상** `sticker_type` 값을 `'empathy'`, `'touching'`, `'comforted'` 중
하나로 제한하는 ENUM 타입을 정의해야 한다.

> **ERD 편차 메모**: pages_06 ERD 2.5는 `sticker_type`을 `text`로 정의하나, 본 SPEC은
> 값 도메인 고정성과 오타 방지를 위해 전용 ENUM 타입으로 상향 정의한다. 향후 스티커
> 종류 추가 시 `ALTER TYPE ... ADD VALUE` 마이그레이션이 필요하다. 이 편차는 명시적
> 설계 결정이다 (감사 리포트 D13).

시스템은 **항상** 다음 컬럼을 가진 `sticker_reactions` 테이블을 유지해야 한다:
`id(uuid PK)`, `record_id(uuid FK→emotion_records.id)`, `user_id(uuid FK→users.id)`,
`sticker_type(sticker_type_enum NOT NULL)`, `created_at(timestamptz default now())`.

**WHILE** `sticker_reactions` 행이 존재하는 동안,
**THEN** 시스템은 `(record_id, user_id)` 조합의 고유성을 보장해야 한다
(기록 1개당 사용자 1명당 스티커 1개만 허용). UNIQUE 위반 시 409 Conflict로
거부되며, MVP에서는 업서트(on conflict update)를 적용하지 않는다 (미결정 사항 6.2 해결).

> 스티커 ENUM 의미: `empathy`(완전히 공감해요) / `touching`(마음이 찡해지네요) /
> `comforted`(덕분에 위로받았어요).

---

### REQ-SCHEMA-SOCIAL: 소셜 연결 엔터티 (clubs, club_members, join_requests)

**목적**: 함께 읽기 그룹, 멤버십, Track A 합류 요청 상태 기계의 데이터 구조를 정의한다.

#### REQ-DB-006: clubs 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `clubs` 테이블을 유지해야 한다:
`id(uuid PK)`, `host_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`,
`type(text NOT NULL)`, `title(text NOT NULL)`, `description(text)`,
`duration_days(integer)`, `daily_pages(integer)`, `min_members(integer)`,
`trigger_page(integer)`, `status(text default 'active')`,
`started_at(timestamptz default now())`, `created_at(timestamptz default now())`.

**WHILE** `type` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'group'` 또는 `'instant'` 중 하나임을 보장해야 한다.
> MVP에서는 `type='instant'` 행이 애플리케이션 계층에서 거부된다 (시그널 푸시, 팝업
> 채팅 로직이 구현되지 않음). CHECK는 전방향 호환을 위해 `'instant'`를 허용하나,
> 클라이언트/Edge Function 단에서 INSERT 전 `type='group'` 검증이 필요하다
> (감사 리포트 D15).

**WHILE** `status` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'active'` 또는 `'closed'` 중 하나임을 보장해야 한다.

> `min_members`는 게이트가 아니며 0이어도 출발한다 (pages_06 ERD 2.6).

#### REQ-DB-007: club_members 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `club_members` 테이블을 유지해야 한다:
`id(uuid PK)`, `club_id(uuid FK→clubs.id)`, `user_id(uuid FK→users.id)`,
`role(text default 'member')`, `joined_at(timestamptz default now())`,
`left_at(timestamptz)`.

**WHILE** `club_members` 행이 존재하는 동안,
**THEN** 시스템은 `(club_id, user_id)` 조합의 고유성을 보장해야 한다.

**WHILE** `role` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'host'` 또는 `'member'` 중 하나임을 보장해야 한다.

#### REQ-DB-008: join_requests 테이블 및 상태 기계 정의

시스템은 **항상** 다음 컬럼을 가진 `join_requests` 테이블을 유지해야 한다:
`id(uuid PK)`, `club_id(uuid FK→clubs.id)`, `requester_id(uuid FK→users.id)`,
`message(text)`, `status(text default 'pending')`,
`responded_at(timestamptz)`, `created_at(timestamptz default now())`.

**WHILE** `join_requests` 행이 존재하는 동안,
**THEN** 시스템은 `(club_id, requester_id)` 조합의 고유성을 보장해야 한다
(동일 그룹 중복 요청 방지).

**WHILE** `status` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'pending'`, `'accepted'`, `'declined'` 중 하나임을 보장해야 한다.

**IF** `status`가 이미 `'accepted'` 또는 `'declined'`인 요청의 `status` 컬럼을
다시 변경하려 하면,
**THEN** 시스템은 해당 UPDATE를 강제로 거부해야 한다.
구체적 메커니즘: `BEFORE UPDATE` 트리거가
`NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'`인 경우에만
`RAISE EXCEPTION 'join_requests status is terminal: %', OLD.status`를 발생시킨다.
이 조건은 `status` 컬럼 자체의 재설정만 차단하며, terminal 상태 행의 다른 컬럼
(`message`, `responded_at` 등)에 대한 양성 편집은 허용한다 (감사 리포트 N7 완화).
이것은 WHERE 절 가드(사이드 이펙트만 억제하고 UPDATE 자체는 커밋됨)가 아니며,
예외로 인해 트랜잭션이 중단되고 클라이언트에 에러가 반환된다 (감사 리포트 D3 해결).

**WHEN** `join_requests.status`가 `'pending'`에서 `'accepted'`로 전환되면,
**THEN** 시스템은 `club_members`에 `(club_id, requester_id, role='member')` 행을
자동으로 삽입해야 한다 (`join_request_accept` 트리거, `SECURITY DEFINER` 함수).

#### REQ-DB-008b: clubs INSERT 시 host 자동 가입 트리거 (신규)

**WHEN** 인증된 사용자가 `clubs` 테이블에 새 행을 INSERT하면,
**THEN** 시스템은 동일 트랜잭션 내에서 `club_members`에
`(club_id=NEW.id, user_id=NEW.host_id, role='host')` 행을 자동으로 삽입해야 한다.

구체적 메커니즘: `AFTER INSERT ON clubs FOR EACH ROW` 트리거가
`SECURITY DEFINER` 함수 `handle_new_club_host()`를 호출한다. 이 함수는
`club_members` INSERT 권한을 가진 역할(예: `service_role` 또는 트리거 소유자)로
실행되며, 클라이언트 RLS 제약 없이 host 멤버십 행을 생성한다.
이것은 Track B 핵심 플로우의 필수 요구사항이다 (감사 리포트 D2 해결).

---

### REQ-SCHEMA-ENGAGE: 참여 및 보상 엔터티 (reading_sessions, completion_reports, point_logs, notifications)

**목적**: 독서 타이머, 완독 리포트 자동 생성, 포인트 내역, 알림 로그의 데이터 구조를 정의한다.

#### REQ-DB-009: reading_sessions 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `reading_sessions` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`,
`started_at(timestamptz NOT NULL)`, `ended_at(timestamptz)`,
`duration_seconds(integer)`, `pages_read(integer)`.

#### REQ-DB-010: completion_reports 테이블 및 자동 생성 트리거 정의

시스템은 **항상** 다음 컬럼을 가진 `completion_reports` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `book_id(uuid FK→books.id)`,
`user_book_id(uuid FK→user_books.id)`, `report_data(jsonb NOT NULL)`,
`created_at(timestamptz default now())`.

> `report_data` 구조: `{ emotion_curve: [...], highlights: [...], total_records: N }`

**WHEN** `user_books.status`가 `'reading'`에서 `'completed'`로 전환되면,
**THEN** 시스템은 해당 `user_book_id`에 대해 정확히 하나의 `completion_reports` 행을
자동으로 생성해야 한다 (멱등성 보장).

**report_data 소유권 (감사 리포트 N2 해결)**: `report_data` JSONB는 **DB 트리거가
단독으로** 계산하여 채운다. 트리거는 발화 시점에 해당 사용자의 `emotion_records`를
집계하여 `emotion_curve`, `highlights`, `total_records`를 PL/pgSQL으로 산출하고,
그 결과를 `report_data` 컬럼과 함께 단일 INSERT로 삽입한다. 상태 전환 직후
(동일 트랜잭션 커밋 시점) `report_data`는 이미 완전히 채워져 있으며, 비동기 대기가
필요 없다. Edge Function `generate-completion-report`은 트리거에 의해 호출되지
않으며, 향후 풍부 콘텐츠(이미지 카드 등) 생성용으로만 예약된다 (제외 §2 참조).

구체적 멱등 메커니즘 (감사 리포트 D11 해결):
1. `completion_reports` 테이블에 `UNIQUE(user_book_id)` 제약을 건다.
2. `AFTER UPDATE OF status ON user_books` 트리거 (`SECURITY DEFINER` 함수)가
   `NEW.status='completed' AND OLD.status<>'completed'` 조건에서만 발화한다.
3. 트리거 본문은 `emotion_records`를 집계하여 `report_data`를 계산한 뒤
   `INSERT INTO completion_reports (..., report_data, ...) VALUES (...)
   ON CONFLICT (user_book_id) DO NOTHING`을 실행한다.
   이는 완독→reading→완독 사이클(역방향 후 재전환)에서도 리포트가 중복 생성되지
   않음을 보장한다.

#### REQ-DB-011: point_logs 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `point_logs` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `amount(integer NOT NULL)`,
`reason(text NOT NULL)`, `ref_id(uuid)`, `created_at(timestamptz default now())`.

**WHILE** `reason` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'completion'`, `'reaction'`, `'exchange'` 중 하나임을 보장해야 한다.

#### REQ-DB-012: notifications 테이블 정의

시스템은 **항상** 다음 컬럼을 가진 `notifications` 테이블을 유지해야 한다:
`id(uuid PK)`, `user_id(uuid FK→users.id)`, `type(text NOT NULL)`,
`title(text NOT NULL)`, `body(text NOT NULL)`, `ref_id(uuid)`,
`is_read(boolean default false)`, `created_at(timestamptz default now())`.

**WHILE** `type` 값이 설정 중일 때,
**THEN** 시스템은 값이 `'reading_reminder'`, `'join_request_received'`,
`'join_accepted'`, `'sticker_received'`, `'completion'`, `'club_signal'` 중 하나임을
보장해야 한다.

---

### REQ-RLS: Row-Level Security 정책 (전체 테이블)

**목적**: 단일 스키마에서 모든 사용자 데이터를 행 단위로 격리한다.
원칙: **기본 거부(Deny by default)**. 명시적 정책이 없으면 행이 보이지 않는다.

#### REQ-DB-013a: RLS 활성화 요구사항

시스템은 **항상** 모든 사용자 데이터 테이블에 대해 RLS를 활성화해야 한다:
`users`, `user_books`, `emotion_records`, `sticker_reactions`, `clubs`,
`club_members`, `join_requests`, `reading_sessions`, `completion_reports`,
`point_logs`, `notifications`.

#### REQ-DB-013b: books 테이블 공개 카탈로그 정책 (신규, 정식 REQ으로 승격)

**WHILE** `books` 테이블에 RLS가 활성화된 상태에서,
**THEN** 시스템은 `books`에 대해 `authenticated` 역할에 단일 SELECT 정책
`USING (true)`를 정의해야 한다.

> 이 정책이 누락되면 `books` 테이블의 모든 행이 기본 거부 원칙에 의해 숨겨지며,
> 도서 카탈로그 조회에 의존하는 모든 기능이 붕괴된다. 따라서 이것은 주석이 아닌
> MUST-PASS 요구사항이다 (감사 리포트 D5 해결). INSERT/UPDATE/DELETE는
> `service_role`만 허용한다.

#### REQ-DB-013c: SECURITY DEFINER 트리거 요구사항 (신규)

RLS 보호 테이블(`club_members`, `completion_reports`, `notifications`,
`public.users`)에 INSERT를 수행하는 모든 트리거 함수는 **반드시**
`SECURITY DEFINER`로 정의되어야 하며, INSERT 권한을 가진 역할이 소유해야 한다
(감사 리포트 D4 해결).

해당 트리거 4종:
1. `handle_new_user()` — `auth.users` INSERT → `public.users` INSERT
2. `join_request_accept()` — `join_requests` UPDATE → `club_members` INSERT
3. `handle_new_club_host()` — `clubs` INSERT → `club_members` INSERT (host)
4. `generate_completion_report()` — `user_books` UPDATE → `completion_reports` INSERT

이 트리거들이 `SECURITY DEFINER`가 아닌 경우, 호출자 권한으로 실행되어 RLS에 의해
INSERT가 거부된다 (`club_members` 등에는 클라이언트 INSERT 정책이 없기 때문).

#### REQ-DB-013d: RLS 재귀 해제 헬퍼 함수 (신규)

시스템은 **항상** `SECURITY DEFINER` 헬퍼 함수 `fn_user_in_club(p_club_id uuid)
RETURNS boolean`을 정의해야 한다. 이 함수는 `club_members` 테이블을 직접 조회하여
`auth.uid()`가 인자로 전달된 `p_club_id`의 멤버인지 반환한다.

> 목적 (감사 리포트 D7 해결): `emotion_records`의 `visibility='club'` RLS 정책과
> `club_members` 자체의 읽기 정책은 모두 club 멤버십을 서브쿼리로 검사한다.
> 그런데 `club_members`에도 RLS가 걸려 있으므로, 서브쿼리가 `club_members`의 자체
> 정책의 적용을 받아 재귀/빈 결과를 유발한다. `fn_user_in_club()`은
> `SECURITY DEFINER`이므로 RLS를 우회하여 멤버십을 판정하고, 재귀를 끊는다.
> 소유자는 `BYPASSRLS` 속성을 가진 역할(예: Supabase의 `postgres` 슈퍼유저 역할)이어야
> 한다 (감사 리포트 N9 해결). `service_role`은 함수 호출 시 RLS 우회용 연결 역할일 뿐,
> 함수 소유자로 권장하지 않는다.

#### REQ-DB-013e: 컬럼 마스킹용 보안 뷰 (신규, MUST-PASS)

시스템은 **항상** 인증된 사용자가 타인의 민감 컬럼에 직접 접근하지 못하도록,
공개 컬럼만 노출하는 보안 뷰(`public.user_profiles`,
`public.user_books_public`)를 정의해야 한다. 여기서 각 뷰는 소정의 제한된
컬럼 집합만 반환해야 한다 (WHERE 보안 뷰가 존재하는 한).

> 배경: PostgreSQL RLS는 행 수준(row-level) 격리만 수행하며, 컬럼 수준
> (column-level) 마스킹은 불가능하다. 따라서 타인 행의 민감 컬럼을 숨기기 위해
> 보안 뷰를 사용한다 (감사 리포트 D1 해결 — 컬럼 마스킹 메커니즘 결정).

**권한 모델 (감사 리포트 N1 해결 — Option A: RLS 단독, REVOKE 없음)**:

PostgreSQL에서 GRANT/REVOKE는 RLS보다 먼저 평가된다. 베이스 테이블의 SELECT를
REVOKE하면 RLS 정책이 실행되기 전에 권한 거부로 쿼리가 실패하므로, "REVOKE 후 RLS로
자기 행만 노출"은 모순이다. 따라서 본 SPEC은 **RLS 단독 모델(Option A)**을 채택한다:
베이스 테이블 SELECT는 REVOKE하지 않으며, RLS own-row 정책으로 자기 행 전체를
노출하고, 보안 뷰로 타인 행의 제한 컬럼만 노출한다. `users`와 `user_books`는 동일한
패턴을 따른다 (두 뷰 간 비일관성 제거).

**보안 뷰 1: `public.user_profiles`**
- 정의: `SELECT id, nickname, avatar_url FROM public.users`
- 목적: 타인 사용자의 공개 프로필 컬럼만 노출 (Track A 독자 목록, 스티커 작성자 표시 등).
- 권한: `authenticated` 역할에 뷰 `SELECT` GRANT.
  베이스 테이블 `public.users`의 `SELECT`는 REVOKE하지 않는다. 대신 RLS 정책
  `USING (auth.uid() = id)`가 자기 행만 전체 컬럼으로 노출한다 (REQ-DB-014).
  타인 행은 RLS에 의해 베이스 테이블에서 숨겨지며, 타인 공개 프로필은
  `user_profiles` 뷰를 통해서만 접근한다.

**보안 뷰 2: `public.user_books_public`**
- 정의: `SELECT book_id, current_page, started_reading_at, user_id
  FROM public.user_books WHERE is_public = true`
- 목적: 타인의 공개 서재 행에서 Track A 독자 목록용 제한 컬럼만 노출.
- 권한: `authenticated` 역할에 뷰 `SELECT` GRANT.
  베이스 테이블 `public.user_books`의 `SELECT`는 REVOKE하지 않는다. RLS 정책
  `USING (auth.uid() = user_id)`가 자기 행만 전체 컬럼으로 노출한다 (REQ-DB-015).
  타인 행은 베이스 테이블에서 숨겨지며, 타인 공개 서재 정보는
  `user_books_public` 뷰를 통해서만 제한 컬럼으로 접근한다.

이 두 뷰는 `SECURITY DEFINER`(또는 `security_invoker = false`, 기본값)로 정의되어
뷰 소유자 권한으로 실행되며, 베이스 테이블의 RLS를 우회하여 안전한 컬럼만 재노출한다.
단, 클라이언트가 베이스 테이블을 직접 쿼리하는 경우 RLS가 여전히 자기 행만
반환하므로, 뷰와 RLS는 보완적으로 동작한다 (대체 불가 아님).

#### REQ-DB-014: users 테이블 RLS 정책

**WHILE** 인증된 사용자가 `users` 테이블(베이스 테이블)을 조회할 때,
**THEN** 시스템은 자신의 행(`auth.uid() = id`)만 전체 컬럼으로 조회할 수 있도록
허용해야 한다. 타인의 행은 RLS에 의해 숨겨진다. 타인의 공개 프로필(nickname,
avatar_url)은 `public.user_profiles` 뷰를 통해서만 접근한다 (REQ-DB-013e).

> 권한 모델 (감사 리포트 N1 해결 — Option A): 베이스 테이블 `public.users`의
> `authenticated` `SELECT`는 REVOKE하지 않는다. RLS 정책 `USING (auth.uid() = id)`가
> 자기 행 전체를 노출한다. 이는 "자기 행 전체 조회" 요구사항과 일관된다 — 권한
> 평가가 RLS보다 선행하므로 REVOKE 시 자기 행조차 조회할 수 없기 때문이다.

**WHILE** 인증된 사용자가 자신의 행을 수정하려 할 때,
**THEN** 시스템은 `auth.uid() = id` 조건에서만 UPDATE를 허용해야 한다.

> `role='admin'`에 대한 타인 행 수정 권한은 MVP에서 정의하지 않는다
> (감사 리포트 D14). admin 역할은 예약값이며, 향후 관리자 모듈에서 별도 정책 추가.

#### REQ-DB-015: user_books 테이블 RLS 정책

**WHILE** 인증된 사용자가 `user_books`(베이스 테이블)를 조회할 때,
**THEN** 시스템은 자신의 행(`auth.uid() = user_id`)만 전체 조회하도록 허용해야 한다.
타인의 행은 RLS에 의해 숨겨진다. 타인의 공개 서재 정보는 `public.user_books_public`
뷰를 통해서만 접근한다 (REQ-DB-013e).

**WHILE** 인증된 사용자가 `user_books`를 쓰려 할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 INSERT/UPDATE/DELETE를 허용해야 한다.

#### REQ-DB-016: emotion_records 테이블 RLS 정책

**WHILE** 인증된 사용자가 `emotion_records`를 조회할 때,
**THEN** 시스템은 다음 조건의 행을 노출해야 한다:
- 본인 작성 기록 (`auth.uid() = user_id`), 또는
- `visibility = 'public'`인 기록, 또는
- `visibility = 'club'`이고 `fn_user_in_club(emotion_records.club_id)`가 `true`인 기록
  (REQ-DB-013d 헬퍼 함수 사용 — 재귀 방지).

**WHILE** 인증된 사용자가 `emotion_records`를 쓰려 할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 INSERT/UPDATE/DELETE를 허용해야 한다
(작성자 본인만).

#### REQ-DB-017: sticker_reactions 테이블 RLS 정책

**WHILE** 인증된 사용자가 `sticker_reactions`를 조회할 때,
**THEN** 시스템은 모든 행을 노출해야 한다 (전체 공개 읽기, `USING (true)`).

**WHILE** 인증된 사용자가 `sticker_reactions`를 쓰려 할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 INSERT/DELETE를 허용해야 한다
(자신의 리액션만 관리).

#### REQ-DB-018: clubs 테이블 RLS 정책

**WHILE** 인증된 사용자가 `clubs`를 조회할 때,
**THEN** 시스템은 모든 행을 노출해야 한다 (공개 탐색 허용 — Track A/B 브리지,
`USING (true)`).

**IF** 인증된 사용자가 `clubs`를 수정/삭제하려 하면,
**THEN** 시스템은 `auth.uid() = host_id` 조건에서만 허용해야 한다 (host만).

**WHILE** 인증된 사용자가 `clubs`를 생성하려 할 때,
**THEN** 시스템은 모든 인증 사용자에게 INSERT를 허용하되, `host_id`가
`auth.uid()`와 일치해야 한다 (WITH CHECK).

#### REQ-DB-019: club_members 테이블 RLS 정책

**WHILE** 인증된 사용자가 `club_members`를 조회할 때,
**THEN** 시스템은 요청자가 같은 `club_id`의 멤버인 행만 노출해야 한다.
구체적 구현: `USING (fn_user_in_club(club_id))` (REQ-DB-013d 헬퍼 함수 사용 —
`club_members` 자체 RLS로 인한 재귀 방지).

**IF** `join_request_accept` 또는 `handle_new_club_host` 트리거가
`club_members`에 INSERT하면,
**THEN** 시스템은 `SECURITY DEFINER` 트리거 함수를 통해 RLS를 우회하여 처리해야 한다
(REQ-DB-013c). 클라이언트가 직접 INSERT하지 않는다.

**WHILE** 인증된 사용자가 자신의 멤버십을 탈퇴하려 하면,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 DELETE를 허용해야 한다.

#### REQ-DB-020: join_requests 테이블 RLS 정책

**WHILE** 인증된 사용자가 `join_requests`를 조회할 때,
**THEN** 시스템은 다음 행만 노출해야 한다:
- 요청자 본인의 요청 (`auth.uid() = requester_id`), 또는
- 요청자가 대상 그룹의 host인 요청 (대상 `club_id`의 `host_id = auth.uid()`).

**WHILE** 인증된 사용자가 합류 요청을 생성하려 하면,
**THEN** 시스템은 `auth.uid() = requester_id` 조건에서 INSERT를 허용해야 한다 (WITH CHECK).

**IF** 인증된 사용자가 대상 그룹의 host이면,
**THEN** 시스템은 해당 요청의 `status`를 UPDATE(`accepted`/`declined`)할 수 있도록 허용해야 한다.

#### REQ-DB-021: reading_sessions, completion_reports, point_logs, notifications RLS 정책

**WHILE** 인증된 사용자가 `reading_sessions`를 조회/수정할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 허용해야 한다 (본인만).

**WHILE** 인증된 사용자가 `completion_reports`를 조회할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 허용해야 한다 (본인만).

**IF** `generate_completion_report` 트리거가 `completion_reports`를 생성하면,
**THEN** 시스템은 `SECURITY DEFINER` 트리거를 통해 RLS를 우회하여 처리해야 한다
(REQ-DB-013c).

**WHILE** 인증된 사용자가 `point_logs`를 조회할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 허용해야 한다 (본인만, 조회 전용).

**WHILE** 인증된 사용자가 `notifications`를 조회/수정(`is_read`)할 때,
**THEN** 시스템은 `auth.uid() = user_id` 조건에서만 허용해야 한다.

**IF** 시스템이 알림을 생성하면,
**THEN** 시스템은 서버 측(`service_role` 또는 SECURITY DEFINER 트리거)에서
RLS 우회로 INSERT해야 한다.

---

## 4. 인덱스 (Indexes)

시스템은 다음 인덱스를 생성해야 한다 (pages_06 ERD 섹션 3 기준):

| 테이블 | 인덱스 컬럼 | 목적 |
|--------|------------|------|
| user_books | (user_id, status) | 서재 목록 조회 |
| user_books | (book_id, is_public, last_progress_at) | Track A 활성·공개 독자 목록 |
| user_books | (book_id, started_reading_at) | '같은 시기' 우선 추천 |
| clubs | (book_id, type, status) | 책별 그룹 조회(합류 대상) |
| join_requests | (club_id, status) | 그룹의 대기 중 요청 |
| join_requests | (requester_id, status) | 내가 보낸 요청 |
| emotion_records | (book_id, page_number) | 진도별 피드 조회 |
| emotion_records | (user_id, created_at DESC) | 내 기록 목록 |
| sticker_reactions | (record_id) | 기록별 리액션 집계 |
| club_members | (user_id) | 내 그룹 목록 |
| reading_sessions | (user_id, book_id) | 발자국/독서 통계 |
| notifications | (user_id, is_read) | 안읽은 알림 |

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **Supabase Auth 제공자 설정**: 카카오/네이버/구글 OAuth 앱 등록 및 콜백 URL 설정은
   본 SPEC 범위 밖이다 (인프라 설정, SPEC-DEPLOY-001 위임).
   - 네이버는 Supabase Custom OIDC(2026년 6월 기능)로 연동
   - Apple 제외: App Store Guideline 4.8 한국 예외 적용
2. **Edge Function 로직**: `kakao-book-search`, `process-join-request`,
   `generate-completion-report`, `send-notification` 등의 Edge Function 구현 로직은
   본 SPEC 범위 밖이다. 본 SPEC은 트리거/정책으로 자동 처리되는 부분만 정의한다.
3. **프론트엔드 구현**: React Native/Expo 클라이언트 코드, UI 컴포넌트는 본 SPEC 범위 밖이다.
4. **chat_messages 테이블**: 실시간 팝업 채팅(type=instant)용 테이블은 확장 단계 기능이므로
   MVP에서는 생성하지 않는다 (pages_06 ERD 2.8 명시).
5. **실시간 문득 모임 (type=instant) 관련 로직**: 시그널 푸시, 팝업 채팅은 확장 단계 기능이다.
6. **Storage 버킷 설정**: 책 표지 이미지, 프로필 아바타 업로드용 Storage 버킷 정책은 본 SPEC 범위 밖이다.
7. **포인트 사용(굿즈 교환) 로직**: point_logs는 MVP에서 조회 전용이다. 차감/교환 로직은 후순위.
8. **데이터 마이그레이션/시드 데이터**: 초기 더미 데이터는 본 SPEC 범위 밖이다.

---

## 6. 미결정 사항 (Open Questions — 해결 상태)

### 6.1 clubs 자동 수락(auto_accept) 컬럼 누락

pages_08 API 7.2와 pages_06 ERD 2.7b는 "host가 자동 수락 옵션을 켜둔 경우"를 언급하나,
`clubs` 테이블 정의에 `auto_accept_requests` 컬럼이 명시되어 있지 않다.

**결정**: MVP에서는 자동 수락을 제외하고 모든 요청을 수동 승인으로 통일한다.
`auto_accept_requests` 컬럼은 추후 확장 시 추가.

### 6.2 스티커 자기 반응(self-reaction) 허용 여부 — 해결됨

**결정**: 자기 반응 허용 (ERD 제약과 일치). UNIQUE(record_id, user_id) 위반 시
409 Conflict로 거부하며, MVP에서는 업서트를 적용하지 않는다 (단일 결정 동작).
이 결정은 acceptance.md 시나리오 6에 반영되었다 (감사 리포트 D10 해결).

### 6.3 users 타인 조회 시 컬럼 노출 방식 — 해결됨 (감사 리포트 D1)

**결정**: 보안 뷰 방식(REQ-DB-013e) 채택. `public.user_profiles` 및
`public.user_books_public` 뷰를 클라이언트 읽기 표면으로 노출하고, 베이스 테이블
SELECT는 자기 행만 RLS로 허용. PostgREST 컬럼 필터에 의존하지 않는다
(보장이 없음).

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-DB-001 | REQ-DB-001 ~ REQ-DB-021 + REQ-DB-008b, REQ-DB-013a~013e | pages_06_ERD.md, pages_03_기능명세서.md, pages_08_API명세서.md, 감사 리포트 SPEC-DB-001-review-1.md, SPEC-DB-001-review-2.md |
