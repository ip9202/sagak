---
id: SPEC-CLUB-001
title: "Track A — 합류형 요청 (비동기 연결)"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [club, social, track-a, join-request, state-machine, supabase, rls]
---

# SPEC-CLUB-001: Track A — 합류형 요청

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Track A 합류형 요청(독자 목록, 상태 기계, host 응답, 멤버 자동 추가) 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android)
- **백엔드 데이터베이스**: Supabase (관리형 PostgreSQL 15+), PostgREST 자동 REST API
- **서버 사이드 로직**: Supabase Edge Functions (Deno 런타임) — `service_role` 키로 RLS 우회
- **인증**: Supabase Auth (JWT 세션, `auth.uid()` — SPEC-AUTH-001)
- **API 클라이언트**: `@supabase/supabase-js` v2 싱글톤 (SPEC-API-001 REQ-API-001)
- **상태 기계 실행 주체**: PostgreSQL `BEFORE UPDATE` 트리거(`guard_join_request_status_trigger`) +
  `AFTER UPDATE` 트리거(`join_request_accept_trigger`) — 클라이언트가 아닌 DB가 상태 전환 무결성 보장
- **데이터 격리**: RLS(Row-Level Security) — 요청자 본인 OR 대상 club의 host만 조회/응답 (REQ-DB-020)

### 단일 출처 (Single Source of Truth)

본 SPEC의 합류 요청 상태 기계 및 멤버 자동 추가 메커니즘은 `.moai/specs/SPEC-DB-001/spec.md`
REQ-DB-006 ~ REQ-DB-008, REQ-DB-019 ~ REQ-DB-020 을 단일 출처로 한다.
독자 목록 데이터는 `user_books_public` 보안 뷰(REQ-DB-013e)를 소비한다.
API 서피스는 `.moai/project/structure.md` "Clubs CRUD" + Edge Functions 섹션,
`.booktalk/pages_08_API명세서.md` 섹션 7.2(Track A)를 따른다.

### 의존성

- **SPEC-DB-001** (선행, 완료 v1.2.0): `join_requests`/`club_members`/`clubs` 스키마, 상태 기계 트리거,
  `join_request_accept` SECURITY DEFINER 트리거, RLS 정책, `user_books_public` 보안 뷰
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤, gen-types 타입(`JoinRequest`, `ClubMember`, `Club`,
  `UserBooksPublic`), 에러 정규화(`normalizeError`), Edge Function 호출 래퍼
- **SPEC-LIBRARY-001** (선행): `user_books.is_public` 노출 제어 — 독자 목록 소스
- **SPEC-AUTH-001** (선행): 사용자 식별(`auth.uid()`), 세션 JWT
- **SPEC-BOOK-001** (선행): 책 컨텍스트(`book_id`) — 독자 목록 필터 기준
- **후속**: SPEC-CLUB-002 (Track B 개설형 — 상태 기계 패턴 공유), SPEC-FEED-001 (모임 피드),
  SPEC-NOTIF-001 (요청 알림 발송)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. Track A는 `type='group'` 모임에 대한 **비동기 합류 요청**이다. 실시간 매칭, 시그널 푸시,
   팝업 채팅이 아니다 (product.md 비목표 "실시간 매칭 및 팝업 채팅" 준수). 요청자가 host에게
   "같이 읽어요" 메시지를 보내고, host가 수동으로 승인/거절하는 느슨한 연결 모델이다.
2. `clubs.type='instant'`(실시간 문득 모임)는 MVP에서 거부된다. CHECK 제약은 전방향 호환을 위해
   `'instant'`를 허용하나, 클라이언트와 Edge Function은 INSERT 전 `type='group'` 검증을 수행한다
   (SPEC-DB-001 REQ-DB-006 주석, 감사 리포트 D15).
3. 상태 기계 무결성은 **DB 트리거가 단독 보장**한다. 클라이언트는 `join_requests.status`를
   직접 전환할 수 있으나, `BEFORE UPDATE` 트리거(`guard_join_request_status_trigger`)가
   terminal 상태(`accepted`/`declined`)에서의 `status` 재설정을 `RAISE EXCEPTION`으로 강제 거부한다.
   클라이언트는 이 예외를 에러 정규화(SPEC-API-001 REQ-API-012 `VALIDATION` 카테고리)로 처리한다.
4. `accepted` 전환 시 `club_members(role='member')` 자동 INSERT는 DB `AFTER UPDATE` 트리거
   (`join_request_accept_trigger`, SECURITY DEFINER)가 수행한다. **클라이언트는 club_members를
   직접 INSERT하지 않는다** (REQ-DB-019 — 클라이언트 INSERT 정책 없음, 권한 상승 방지).
5. 독자 목록은 `user_books_public` 보안 뷰(REQ-DB-013e)를 통해 조회한다. 이 뷰는
   `is_public=true` 행만 노출하며, 제한 컬럼(`book_id`, `current_page`, `started_reading_at`,
   `user_id`)만 반환한다. 클라이언트는 베이스 테이블 `user_books`를 직접 조회하지 않는다
   (RLS가 자기 행만 반환하므로 타인 독자 목록이 보이지 않음).
6. MVP에서는 **수동 승인만** 지원한다. 자동 수락(`auto_accept_requests`)은 SPEC-DB-001
   미결정 사항 6.1에 따라 제외된다. 모든 `join_requests`는 host의 명시적 `accepted`/`declined`
   판정을 필요로 한다.

### 2.2 비즈니스 가정

1. `join_requests`는 `(club_id, requester_id)` UNIQUE 제약으로 동일 그룹 중복 요청을 방지한다.
   위반 시 409 Conflict로 처리하며, MVP에서는 업서트를 적용하지 않는다
   (SPEC-DB-001 가정 2.2.4 패턴 준수).
2. 대상 독자가 아직 그룹(`clubs` 행)이 없는 경우, Edge Function `process-join-request`가
   해당 독자의 1인 그룹(`type='group'`, `status='active'`)을 lazy 생성한 뒤 요청을 건다
   (`.booktalk/pages_08_API명세서.md` 7.2). 이 때 `handle_new_club_host` 트리거(REQ-DB-008b)가
   해당 독자를 host로 자동 가입시킨다.
3. `join_requests.message`는 선택적 텍스트 필드다. 요청자가 host에게 보내는 "같이 읽어요" 메시지로,
   product.md 사용 시나리오 3(비동기 연결)의 "자연스럽게 공감·합류 요청" 경험을 제공한다.
4. host의 응답(`accepted`/`declined`)은 `responded_at` 타임스탬프와 함께 기록된다.
   terminal 상태 이후의 `status` 재설정은 트리거가 차단하나, `message` 등 다른 컬럼의
   양성 편집은 허용된다 (SPEC-DB-001 REQ-DB-008 N7 완화).
5. 거절된 요청의 재요청 쿨다운은 미결정 사항(6.2)이다. MVP에서는 UNIQUE 위반으로 인해
   동일 `(club_id, requester_id)` 재요청이 차단되나, host가 기존 요청을 삭제(soft 또는 hard)한
   후 재요청하는 플로우는 본 SPEC 범위 밖이다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-CLUBA-READER, REQ-CLUBA-REQUEST,
> REQ-CLUBA-RESPOND, REQ-CLUBA-MEMBER.

### REQ-CLUBA-READER: Track A 독자 목록 조회

**목적**: 같은 책을 읽는 공개·활성 독자 목록을 `user_books_public` 보안 뷰를 통해 제공하여,
요청자가 합류 대상을 탐색할 수 있도록 한다.

#### REQ-CLUBA-001: 독자 목록 쿼리 (user_books_public 뷰 소비)

시스템은 **항상** `user_books_public` 보안 뷰(REQ-DB-013e)를 통해 특정 `book_id`의 공개 독자
목록을 조회하는 함수(`fetchActiveReaders`)를 제공해야 한다. 이 함수는 `book_id`로 필터링하고,
제한 컬럼(`user_id`, `current_page`, `started_reading_at`, `book_id`)만 반환해야 한다.

**WHEN** 요청자가 특정 책의 독자 목록을 조회하면,
**THEN** 시스템은 `user_books_public` 뷰에서 `book_id`가 일치하는 행만 반환해야 한다.

> 베이스 테이블 `user_books`를 직접 조회하지 않는다 — RLS가 자기 행만 반환하므로 타인 독자가
> 보이지 않는다. 보안 뷰는 `security_invoker = false`(기본값)로 정의되어 뷰 소유자 권한으로
> 실행되며, 베이스 테이블 RLS를 우회하여 `is_public=true` 행의 제한 컬럼을 재노출한다.

#### REQ-CLUBA-002: 유령 유저 필터링 (활성 독자만)

**WHILE** 독자 목록을 조회하는 동안,
**THEN** 시스템은 `user_books_public` 결과에서 최근 활성 독자만 노출하도록 클라이언트 측에서
`started_reading_at` 기준 정렬을 적용해야 한다.

> `user_books_public` 뷰 자체는 `is_public=true` 필터만 포함한다. "활성" 판정(`last_progress_at`
> 최근 여부)은 뷰에 `last_progress_at` 컬럼이 없으므로 클라이언트 측 정렬 또는 Edge Function
> `active-readers`(pages_08 7.2)에서 처리한다. 본 SPEC은 클라이언트 정렬을 기본으로 한다.

#### REQ-CLUBA-003: 독자별 그룹 식별 (club_id 매핑)

**WHEN** 독자 목록의 각 독자에 대해 합류 대상 그룹을 결정해야 하면,
**THEN** 시스템은 해당 `user_id`가 속한 `clubs`(type='group', status='active')의 `id`를 조회하여
`club_id`를 매핑해야 한다. 그룹이 없는 독자는 `club_id=null`로 표시한다.

> 그룹이 없는 독자에게 요청 시 Edge Function `process-join-request`이 1인 그룹을 lazy 생성한다
> (가정 2.2.2). 클라이언트는 `club_id=null`인 독자에 대해서도 요청을 시도할 수 있다.

---

### REQ-CLUBA-REQUEST: 합류 요청 생성

**목적**: 요청자가 대상 그룹의 host에게 "같이 읽어요" 메시지와 함께 합류 요청을 보낼 수 있도록 한다.
상태 기계의 `pending` 초기 상태를 보장한다.

#### REQ-CLUBA-004: 합류 요청 INSERT (pending 초기 상태)

시스템은 **항상** `join_requests` 테이블에 새 요청을 INSERT하는 함수(`createJoinRequest`)를
제공해야 한다. 이 함수는 `club_id`, `requester_id`(= `auth.uid()`), `message`(선택)를 인자로 받으며,
`status`는 DB 기본값 `'pending'`으로 설정된다.

**WHEN** 요청자가 합류 요청을 생성하면,
**THEN** 시스템은 `join_requests`에 `(club_id, requester_id, message, status='pending')` 행을
INSERT해야 한다.

**WHILE** INSERT가 수행되는 동안,
**THEN** 시스템은 RLS 정책 `join_requests_insert_own`(`auth.uid() = requester_id`, WITH CHECK)이
요청자 본인만 INSERT할 수 있도록 강제해야 한다 (REQ-DB-020).

#### REQ-CLUBA-005: 중복 요청 방지 (UNIQUE 위반 처리)

**IF** 동일한 `(club_id, requester_id)` 조합의 요청이 이미 존재하여 UNIQUE 제약이 위반되면,
**THEN** 시스템은 이를 409 Conflict로 감지하고, 사용자 친화적 메시지
("이미 이 그룹에 요청을 보냈습니다")를 반환해야 한다 (SPEC-API-001 REQ-API-012 `VALIDATION` 카테고리,
REQ-API-014 한국어 매핑).

> MVP에서는 업서트(`on conflict update`)를 적용하지 않는다 (단일 결정 동작). 기존 요청의 상태가
> `declined`인 경우에도 자동 재요청이 아니라 별도 UX(미결정 6.2)를 필요로 한다.

#### REQ-CLUBA-006: 대상 그룹 없음 시 lazy 생성 (Edge Function 위임)

**WHEN** 요청 대상 독자가 그룹(`clubs` 행)을 가지고 있지 않으면(`club_id=null`),
**THEN** 시스템은 Edge Function `process-join-request`를 호출하여 해당 독자의 1인 그룹
(`type='group'`, `status='active'`)을 lazy 생성한 뒤, 생성된 `club_id`로 요청을 INSERT해야 한다.

> lazy 생성 시 `handle_new_club_host` 트리거(REQ-DB-008b)가 해당 독자를 host로 자동 가입시킨다.
> 클라이언트는 이 트리거 동작을 직접 수행하지 않으며, Edge Function에 `service_role` 키로 위임한다.

---

### REQ-CLUBA-RESPOND: host 승인/거절 응답

**목적**: 대상 그룹의 host가 수신한 `pending` 요청을 승인(`accepted`) 또는 거절(`declined`)할 수
있도록 한다. DB 상태 기계 트리거와 연동하여 무결성을 보장한다.

#### REQ-CLUBA-007: host 전용 응답 권한 (RLS 강제)

시스템은 **항상** `join_requests.status` UPDATE를 host만 수행할 수 있도록 강제해야 한다.
RLS 정책 `join_requests_update_host`(`auth.uid() = club.host_id`)가 이를 보장한다 (REQ-DB-020).

**IF** host가 아닌 사용자가 요청의 `status`를 변경하려 하면,
**THEN** 시스템은 RLS에 의해 UPDATE가 거부되어야 하며, 에러 정규화는 이를 `RLS_DENIED` 카테고리로
분류해야 한다 (SPEC-API-001 REQ-API-012).

#### REQ-CLUBA-008: terminal 상태 재설정 거부 처리

**IF** host가 이미 `accepted` 또는 `declined`인 요청의 `status`를 다시 변경하려 하면,
**THEN** 시스템은 DB `BEFORE UPDATE` 트리거(`guard_join_request_status_trigger`)의
`RAISE EXCEPTION`으로 인해 UPDATE가 실패함을 감지하고, 사용자 친화적 메시지
("이미 처리된 요청입니다")를 반환해야 한다.

> 트리거 조건: `NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'`.
> 이 에러는 SPEC-API-001 에러 정규화에서 `VALIDATION` 카테고리로 분류된다. 클라이언트는
> 이 시나리오를 명시적으로 처리하여 사용자가 "승인" 버튼을 반복 누르는 경우의 혼란을 방지한다.

#### REQ-CLUBA-009: 응답 시 responded_at 기록

**WHEN** host가 요청을 `accepted` 또는 `declined`로 전환하면,
**THEN** 시스템은 `responded_at`을 `now()`로 설정해야 한다. 이 값은 host의 응답 시점을 기록하며,
요청자에게 전달되는 알림(SPEC-NOTIF-001)의 컨텍스트로 사용된다.

> `responded_at` 갱신은 `status` 전환과 동일 UPDATE 문에서 수행된다. `status`가 변경되지 않는
> 양성 편집(REQ-CLUBA-008 주석 참조)의 경우 `responded_at`도 갱신되지 않아야 한다.

---

### REQ-CLUBA-MEMBER: 수락 시 club_members 자동 추가

**목적**: `accepted` 전환 시 DB 트리거가 `club_members(role='member')`를 자동 INSERT하는 메커니즘을
클라이언트가 올바르게 소비하도록 보장한다. 클라이언트는 INSERT를 수행하지 않는다.

#### REQ-CLUBA-010: club_members 자동 INSERT (트리거 소비)

시스템은 **항상** `join_requests.status`가 `'pending'`에서 `'accepted'`로 전환될 때,
DB `AFTER UPDATE` 트리거(`join_request_accept_trigger`, SECURITY DEFINER 함수 `join_request_accept`)가
`club_members`에 `(club_id, requester_id, role='member')` 행을 자동 INSERT함을 신뢰해야 한다.

**WHEN** host가 요청을 `accepted`로 전환하면,
**THEN** 시스템은 동일 트랜잭션 내에서 `club_members`에 멤버 행이 생성됨을 보장받아야 한다
(트리거가 SECURITY DEFINER로 RLS를 우회하여 INSERT).

> 클라이언트는 `club_members`를 직접 INSERT하지 않는다 — REQ-DB-019에 클라이언트 INSERT 정책이
> 없으며, 권한 상승 방지를 위해 트리거만 INSERT를 수행한다. 클라이언트는 `accepted` 전환 후
> `club_members`를 재조회하여 멤버십을 확인한다.

#### REQ-CLUBA-011: 수락 후 멤버십 확인

**WHEN** 요청이 `accepted`로 전환된 후,
**THEN** 시스템은 요청자가 해당 `club_id`의 `club_members`에 존재하는지 재조회하여 확인해야 한다.
이 확인은 트리거 동작을 클라이언트가 검증하는 관측 지점이다.

> RLS 정책 `club_members_select_same_club`(`fn_user_in_club(club_id)`)에 의해, 새 멤버는 자신이
> 속한 그룹의 멤버 목록을 조회할 수 있다 (REQ-DB-019). 요청자는 `accepted` 후 자신의 멤버십을
> 포함한 그룹 멤버 목록을 볼 수 있다.

#### REQ-CLUBA-012: 거절 시 멤버십 미추가

**IF** 요청이 `declined`로 전환되면,
**THEN** 시스템은 `club_members`에 어떤 행도 추가되지 않음을 보장해야 한다.
`join_request_accept` 트리거는 `NEW.status = 'accepted'` 조건에서만 발화하므로,
`declined` 전환은 멤버십에 영향을 주지 않는다.

> 요청자는 `declined` 후에도 해당 그룹의 멤버가 아니다. 거절된 요청자는 동일 `(club_id, requester_id)`
> UNIQUE 제약으로 인해 재요청이 차단되며, 재요청 플로우는 미결정 사항(6.2)이다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **Track B 모임 생성**: `clubs` INSERT(개설형, 0명 출발), 모임 설정(`duration_days`,
   `daily_pages`, `trigger_page`), 진도 동기화는 SPEC-CLUB-002가 처리한다. 본 SPEC은 Track A
   합류 요청만 다루며, 모임 생성 로직을 포함하지 않는다.
2. **실시간 피드**: 모임원 감정 기록 진도별 슬라이딩 피드, Supabase Realtime `postgres_changes`
   구독은 SPEC-FEED-001이 처리한다. 본 SPEC은 합류 요청 상태 기계만 정의한다.
3. **자동 수락(auto_accept_requests)**: SPEC-DB-001 미결정 사항 6.1에 따라 MVP에서 제외.
   모든 요청은 host의 수동 승인이 필요하다. `clubs.auto_accept_requests` 컬럼은 존재하지 않는다.
4. **실시간 문득 모임 (type='instant')**: 시그널 푸시, 팝업 채팅은 확장 단계 기능이다
   (product.md 비목표 "실시간 매칭 및 팝업 채팅"). CHECK 제약은 `'instant'`를 허용하나,
   클라이언트/Edge Function은 `type='group'`만 허용한다.
5. **실시간 팝업 채팅**: `chat_messages` 테이블, Realtime 채팅 채널은 MVP 범위 밖이다
   (SPEC-DB-001 제외 범위 4).
6. **Edge Function `process-join-request` 서버 로직**: 본 SPEC은 Edge Function이 수행하는
   lazy 그룹 생성, `service_role` 키 사용, 알림 발송 트리거를 "소비"하는 클라이언트 인터페이스만
   정의한다. Edge Function의 Deno 코드 구현은 본 SPEC 범위 밖이나, 입력/출력 계약은
   REQ-CLUBA-006에 명시된다.
7. **요청 알림 발송**: `join_request_received`(host에게), `join_accepted`(요청자에게) 알림은
   SPEC-NOTIF-001이 처리한다. 본 SPEC은 알림이 발송됨을 가정하나, 알림 채널/포맷은 정의하지 않는다.
8. **독자 목록 정렬 기준 상세**: `started_reading_at`(같은 시기 우선) vs `current_page`(비슷한 진도)
   중 어느 기준을 우선할지는 미결정 사항(6.3)이다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 요청 알림 발송 시점 — SPEC-NOTIF-001 연동 (해결 대기)

`join_requests` INSERT 시 host에게 `join_request_received` 알림을 발송하는 시점과 방식이
미확정. DB 트리거가 알림을 직접 생성하는지, Edge Function `process-join-request`가
`send-notification` Edge Function을 호출하는지, 클라이언트가 별도로 알림 API를 호출하는지.

**상태**: SPEC-NOTIF-001 구현 시 확정. 본 SPEC은 알림이 발송됨을 가정하고, 알림 발송 메커니즘은
정의하지 않는다. `accepted` 전환 시 요청자에게 `join_accepted` 알림도 동일한 미결정 상태.

### 5.2 거절 시 재요청 쿨다운 — 미해결

`declined`된 요청의 재요청을 허용할지, 쿨다운 기간을 둘지, 영구 차단할지 미확정.
현재 UNIQUE(club_id, requester_id) 제약으로 인해 동일 조합 재요청이 차단된다.

**영향 범위**: 거절된 요청자의 UX. host가 실수로 거절한 경우 복구 경로. 쿨다운이 필요한 경우
`join_requests`에 `cooldown_until` 컬럼 추가 또는 soft-delete 플로우 검토.

**해결 시점**: Track A UX 테스트 후 확정. MVP에서는 거절 시 재요청 불가로 동작한다.

### 5.3 독자 목록 정렬 기준 — 미해결

`user_books_public` 결과의 정렬 기준이 미확정. pages_08 7.2는 `started_reading_at`(같은 시기) 우선을
언급하나, `current_page`(비슷한 진도) 우선이 사용자 경험에 더 적합할 수 있다.

**후보**:
- `started_reading_at` DESC (최근 시작 우선 — "같은 시기 독자")
- `current_page` 근접도 (비슷한 진도 우선 — "같은 구간 독자")
- 혼합 (같은 시기 + 비슷한 진도 가중치)

**영향 범위**: REQ-CLUBA-002 클라이언트 측 정렬 로직. Edge Function `active-readers` 구현 시
서버 측 정렬로 이관 가능.

**해결 시점**: Track A 베타 테스트 후 A/B 테스트로 확정.

### 5.4 lazy 그룹 생성 주체 — 클라이언트 vs Edge Function (해결 대기)

REQ-CLUBA-006은 Edge Function `process-join-request`이 lazy 그룹을 생성한다고 가정한다.
그러나 클라이언트가 직접 `clubs` INSERT(REQ-DB-018 `clubs_insert_host_self` 허용) 후
`join_requests` INSERT하는 2단계 접근도 가능하다.

**권장**: Edge Function 위임 — `service_role` 키로 RLS를 우회하여 원자적 처리가 가능하며,
클라이언트가 2단계 트랜잭션을 관리할 필요가 없다. 단, Edge Function 의존성이 추가된다.

**상태**: 구현 시 확정. 본 SPEC은 Edge Function 위임을 기본 가정으로 한다.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-CLUB-001 | REQ-CLUBA-001 ~ REQ-CLUBA-012 | `.moai/project/product.md`(사용 시나리오 3 비동기 연결, 비목표), `.moai/project/structure.md`(Clubs CRUD, Edge Functions), `.moai/project/tech.md`(백엔드, Edge Functions), `.moai/specs/SPEC-DB-001/spec.md`(REQ-DB-006~008, REQ-DB-013e, REQ-DB-019~020), `.moai/project/db/schema.md`(join_requests, club_members, clubs, user_books_public), `.moai/project/db/rls-policies.md`(join_requests, club_members), `.booktalk/pages_08_API명세서.md`(7.2 Track A), `.booktalk/pages_04_유저플로우.md`(모임 시스템), `.moai/specs/INDEX.md`(SPEC 카탈로그) |
| REQ-CLUBA-READER | REQ-CLUBA-001 ~ REQ-CLUBA-003 | SPEC-DB-001 REQ-DB-013e(user_books_public 뷰), structure.md API 서피스, pages_08 7.2 active-readers |
| REQ-CLUBA-REQUEST | REQ-CLUBA-004 ~ REQ-CLUBA-006 | SPEC-DB-001 REQ-DB-008(join_requests 스키마, UNIQUE), REQ-DB-020(REQ-RLS INSERT), pages_08 7.2 POST /join_requests |
| REQ-CLUBA-RESPOND | REQ-CLUBA-007 ~ REQ-CLUBA-009 | SPEC-DB-001 REQ-DB-008(상태 기계 트리거), REQ-DB-020(REQ-RLS UPDATE host), pages_08 7.2 PATCH /join_requests |
| REQ-CLUBA-MEMBER | REQ-CLUBA-010 ~ REQ-CLUBA-012 | SPEC-DB-001 REQ-DB-008(join_request_accept 트리거), REQ-DB-007(club_members), REQ-DB-019(REQ-RLS fn_user_in_club), REQ-DB-013c(SECURITY DEFINER) |
