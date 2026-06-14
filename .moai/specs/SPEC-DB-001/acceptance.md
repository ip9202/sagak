---
# NOTE: `created` is the canonical field name per MoAI plan workflow Phase 2
# (8-field frontmatter: id, version, status, created, updated, author, priority,
# issue_number). Do NOT rename to `created_at` — orchestrator ruling on MP-3.
id: SPEC-DB-001
title: "Database Schema & RLS — Acceptance Criteria"
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

# SPEC-DB-001 인수 기준

## 1. 개요

본 문서는 SPEC-DB-001의 인수 기준을 Given/When/Then(Gherkin) 형식으로 정의한다.
각 시나리오는 관측 가능한 증거(observable evidence)를 요구한다.

> **추적성 메모 (감사 리포트 D12 해결)**: spec.md의 EARS 요구사항(REQ-DB-001 ~
> REQ-DB-021 + REQ-DB-008b, REQ-DB-013a~013e)은 아래 Gherkin Feature들이 검증한다.
> 각 Feature 헤더는 `검증 REQ: REQ-DB-XXX` 형식으로 부모 EARS REQ를 명시한다.
> 모든 REQ-DB-XXX는 최소 하나의 Gherkin 시나리오에 매핑된다.

### REQ → 시나리오 매핑 요약

| REQ ID | 검증 시나리오 |
|--------|---------------|
| REQ-DB-001 | 시나리오 8 |
| REQ-DB-002 | 시나리오 10 |
| REQ-DB-003 | 시나리오 7 |
| REQ-DB-004 | 시나리오 4 (case 3) |
| REQ-DB-005 | 시나리오 6 |
| REQ-DB-006 | 시나리오 5, 11 |
| REQ-DB-007 | 시나리오 11 (host 자동 가입) |
| REQ-DB-008 | 시나리오 2 |
| REQ-DB-008b | 시나리오 11 |
| REQ-DB-009 | 시나리오 12 |
| REQ-DB-010 | 시나리오 3 |
| REQ-DB-011 | 시나리오 13 |
| REQ-DB-012 | 시나리오 14 |
| REQ-DB-013a | 시나리오 9 (case 2) |
| REQ-DB-013b | 시나리오 10 |
| REQ-DB-013c | 시나리오 3, 11, 15 |
| REQ-DB-013d | 시나리오 4 (case 2), 16 |
| REQ-DB-013e | 시나리오 1 (case 2), 17 |
| REQ-DB-014 | 시나리오 17 |
| REQ-DB-015 | 시나리오 1 |
| REQ-DB-016 | 시나리오 4 |
| REQ-DB-017 | 시나리오 18 |
| REQ-DB-018 | 시나리오 5 |
| REQ-DB-019 | 시나리오 16 |
| REQ-DB-020 | 시나리오 2 |
| REQ-DB-021 | 시나리오 12, 13, 14 |

---

## 2. 핵심 시나리오

### 시나리오 1: RLS가 타인의 비공개 서재 행을 차단한다

**검증 REQ**: REQ-DB-015, REQ-DB-013e

```gherkin
Feature: user_books RLS — 타인 비공개 행 차단 및 보안 뷰

  Scenario: 인증된 사용자가 타인의 비공개 서재 행을 조회할 수 없다
    Given 사용자 A가 user_books에 is_public=false 행을 가지고 있다
    And 사용자 B가 별도로 인증되어 있다
    When 사용자 B가 "GET /rest/v1/user_books"를 호출한다
    Then 사용자 B의 결과에 사용자 A의 is_public=false 행이 포함되지 않는다
    And 응답 행 수가 사용자 B 자신의 행 수와 일치한다

  Scenario: 타인의 공개 서재 정보는 user_books_public 뷰를 통해서만 제한 컬럼 노출
    Given 사용자 A가 user_books에 is_public=true 행을 가지고 있다
    And 사용자 B가 별도로 인증되어 있다
    When 사용자 B가 "GET /rest/v1/user_books_public"을 호출한다
    Then 사용자 A의 공개 행의 book_id, current_page, started_reading_at, user_id 컬럼만 조회된다
    And 그 외 컬럼(is_public, last_progress_at, completed_at 등)은 노출되지 않는다
    And 베이스 테이블 user_books에는 사용자 B 자신의 행만 보인다
    And user_books 베이스 테이블의 started_reading_at 등 전체 컬럼은
        사용자 B 자신의 행에만 노출된다

  Scenario: 사용자는 자신의 서재 행을 전체 조회할 수 있다
    Given 사용자 A가 읽는 중/완독/보관 상태의 user_books 행 3개를 가지고 있다
    When 사용자 A가 "GET /rest/v1/user_books"를 호출한다
    Then 3개 행이 모두 반환된다
    And 모든 컬럼이 포함된다
```

**검증 방법**:
- 두 개의 분리된 Supabase 클라이언트(서로 다른 JWT)로 쿼리 실행
- 응답 행의 `user_id`가 요청자와 일치하는지 단정
- `user_books`(베이스) SELECT는 자기 행만, `user_books_public`(뷰)는 타인 공개 행 제한 컬럼만
- D9 수정: `reading_alarm_time`은 user_books가 아닌 users 컬럼이므로 제거.
  user_books의 민감 컬럼은 베이스 테이블 전체 접근 자체가 차단됨으로 검증.

---

### 시나리오 2: join_requests 상태 전환과 club_members 자동 추가

**검증 REQ**: REQ-DB-008, REQ-DB-020

```gherkin
Feature: join_requests 상태 기계 및 자동 멤버 추가

  Scenario: host가 합류 요청을 수락하면 club_members에 자동 추가된다
    Given 사용자 A가 clubs 그룹 X를 개설하여 host이다
    And 사용자 B가 그룹 X에 join_requests(status=pending)를 보냈다
    And club_members에 사용자 B가 존재하지 않는다
    When 사용자 A가 "PATCH /rest/v1/join_requests?id=eq.{req_id}"를
         { "status": "accepted" }로 호출한다
    Then join_requests.status가 "accepted"로 갱신된다
    And responded_at이 현재 시각으로 설정된다
    And club_members에 (club_id=X, user_id=B, role=member) 행이 자동 삽입된다

  Scenario: 이미 처리된 요청의 status 재설정은 거부된다 (BEFORE UPDATE RAISE)
    Given join_requests 행이 status=accepted 상태이다
    When host가 동일 요청을 { "status": "declined" }로 PATCH 시도한다
    Then BEFORE UPDATE 트리거가 RAISE EXCEPTION으로 요청을 거부한다
    And PostgreSQL 에러가 반환된다 (트랜잭션 중단, 0행 커밋 아님)
    And status는 여전히 "accepted"이다

  Scenario: terminal 상태 행의 status 외 컬럼 편집은 허용된다 (N7 완화)
    Given join_requests 행이 status=accepted 상태이다
    When host가 동일 요청의 message 또는 responded_at 컬럼을 PATCH 한다 (status不变)
    Then UPDATE가 성공한다 (status 컬럼 변경이 아니므로 RAISE 미발화)
    And status는 여전히 "accepted"이고 갱신 컬럼만 반영된다

  Scenario: 비-host는 요청을 수락/거절할 수 없다
    Given 사용자 C는 그룹 X의 멤버이지만 host가 아니다
    And 그룹 X에 pending join_requests가 있다
    When 사용자 C가 해당 요청을 PATCH 시도한다
    Then RLS 정책이 요청을 차단한다 (403 또는 0행 영향)

  Scenario: 동일 그룹에 중복 요청을 보낼 수 없다
    Given 사용자 B가 그룹 X에 이미 join_requests를 보냈다 (어떤 status든)
    When 사용자 B가 그룹 X에 다시 join_requests를 생성 시도한다
    Then UNIQUE(club_id, requester_id) 제약 위반으로 INSERT가 실패한다 (409 Conflict)
```

**검증 방법**:
- `service_role` 클라이언트로 club_members 행 존재 여부 직접 확인
- 상태 전환 전후의 join_requests.status 값 단정
- 재처리 시나리오: 에러 응답 본문에 "terminal" 키워드 포함 확인 (RAISE 메시지)
- UNIQUE 제약 위반 시 PostgreSQL 에러 코드 23505 확인

---

### 시나리오 3: 완독 처리 시 completion_reports 자동 생성 (멱등성)

**검증 REQ**: REQ-DB-010, REQ-DB-013c

```gherkin
Feature: 완독 자동 리포트 생성

  Scenario: user_books.status가 completed로 전환되면 리포트가 자동 생성된다
    Given 사용자 A의 user_books 행이 status=reading이다
    And 감정 기록 5개가 해당 book에 존재한다
    When user_books.status가 "completed"로 업데이트된다
    Then completion_reports에 정확히 1개의 행이 생성된다
    And report_data.total_records가 5이다
    And report_data.emotion_curve와 highlights가 비어있지 않다
    And report_data가 DB 트리거에 의해 단독으로 계산되어 채워진다 (비동기 대기 없음)
    And 상태 전환 커밋 직후 report_data가 이미 완전히 채워져 있다 (N2 소유권 단정)
    And completed_at이 현재 시각으로 설정된다

  Scenario: 이미 완독 처리된 책을 다시 completed로 설정해도 리포트가 중복 생성되지 않는다
    Given user_books 행이 이미 status=completed이고 completion_reports가 1개 존재한다
    When user_books.status를 다시 "completed"로 업데이트한다 (값 변화 없음)
    Then completion_reports 행 수가 여전히 1개이다
    And 새로운 INSERT가 발생하지 않는다 (ON CONFLICT DO NOTHING 멱등성)

  Scenario: 완독→reading→completed 사이클 후에도 리포트는 정확히 1개만 존재 (D11)
    Given user_books 행이 status=completed이고 completion_reports가 1개 존재한다
    When user_books.status를 "reading"으로 되돌린다
    Then 기존 completion_reports 행이 삭제되지 않는다 (이력 보존)
    When user_books.status를 다시 "completed"로 전환한다
    Then completion_reports 행 수가 여전히 정확히 1개이다
    And ON CONFLICT (user_book_id) DO NOTHING으로 인해 중복 INSERT가 스킵되었다
```

**검증 방법**:
- `service_role`로 completion_reports 행 수 직접 카운트
- report_data JSONB 구조의 키 존재 여부 단정 (`emotion_curve`, `highlights`, `total_records`)
- completed→reading→completed 사이클 후 행 수 == 1 단정 (D11 멱등성 핵심 케이스)
- 트리거 로그 또는 EXPLAIN ANALYZE로 INSERT 발생 여부 확인

---

## 3. RLS 경계 시나리오

### 시나리오 4: emotion_records visibility별 접근 제어

**검증 REQ**: REQ-DB-016, REQ-DB-013d

```gherkin
Feature: 감정 기록 공개 범위 제어

  Scenario: visibility=public 기록은 모든 인증 사용자가 조회할 수 있다
    Given 사용자 A가 emotion_records(visibility=public, club_id=null)를 작성했다
    When 사용자 B(다른 사용자)가 해당 book_id의 피드를 조회한다
    Then 사용자 A의 public 기록이 결과에 포함된다
    But 사용자 B의 현재 진도(current_page)보다 높은 page_number의 기록은
        앱 단에서 블러 처리 대상이다 (RLS가 아닌 앱 로직)

  Scenario: visibility=club 기록은 해당 모임원만 조회할 수 있다 (fn_user_in_club 헬퍼)
    Given 사용자 A가 emotion_records(visibility=club, club_id=X)를 작성했다
    And 사용자 B는 그룹 X의 멤버이다
    And 사용자 C는 그룹 X의 멤버가 아니다
    When 사용자 B가 감정 기록 피드를 조회한다
    Then 사용자 A의 club 기록이 결과에 포함된다
    And fn_user_in_club(X)가 사용자 B에 대해 true를 반환한다 (재귀 없이)
    When 사용자 C가 감정 기록 피드를 조회한다
    Then 사용자 A의 club 기록이 결과에 포함되지 않는다
    And fn_user_in_club(X)가 사용자 C에 대해 false를 반환한다

  Scenario: visibility=club이면 club_id는 NOT NULL이어야 한다
    Given 감정 기록 INSERT를 시도한다
    When visibility=club이고 club_id=null인 행을 INSERT 시도한다
    Then CHECK 제약 위반으로 INSERT가 실패한다
```

### 시나리오 5: clubs 공개 조회와 host 전용 수정

**검증 REQ**: REQ-DB-018

```gherkin
Feature: 모임 공개 조회 및 host 권한

  Scenario: 모든 인증 사용자가 clubs 목록을 조회할 수 있다 (Track A/B 브리지)
    Given 사용자 A가 그룹 X를 개설했다
    And 사용자 B는 그룹 X와 무관한 별도 사용자이다
    When 사용자 B가 "GET /rest/v1/clubs?book_id=eq.{book}"을 호출한다
    Then 그룹 X가 결과에 포함된다 (공개 탐색 허용, USING(true))

  Scenario: host만 자신의 모임을 수정/삭제할 수 있다
    Given 사용자 A가 그룹 X의 host이다
    When 사용자 B가 그룹 X를 PATCH/DELETE 시도한다
    Then RLS 정책이 차단한다 (auth.uid() != host_id)
    When 사용자 A가 그룹 X를 PATCH 시도한다
    Then 수정이 성공한다

  Scenario: 개설 시 host_id는 auth.uid()와 일치해야 한다
    Given 사용자 A가 인증되어 있다
    When 사용자 A가 host_id=사용자B의 clubs 행을 INSERT 시도한다
    Then WITH CHECK 정책이 차단한다 (auth.uid() != host_id)
```

---

## 4. 엣지 케이스

### 시나리오 6: sticker_reactions 중복 방지 (결정론적, D10 해결)

**검증 REQ**: REQ-DB-005

```gherkin
Feature: 스티커 리액션 중복 방지

  Scenario: 동일 기록에 동일 사용자가 스티커를 2개 이상 놓을 수 없다 (409 거부)
    Given 사용자 A가 emotion_records R1에 sticker_type=empathy 리액션을 했다
    When 사용자 A가 R1에 sticker_type=touching 리액션을 추가 시도한다
    Then UNIQUE(record_id, user_id) 제약 위반으로 실패한다 (409 Conflict)
    And 기존 empathy 리액션은 변경되지 않는다 (업서트 미적용 — 미결정 사항 6.2 해결)

  Scenario: 다른 사용자는 동일 기록에 각자 스티커를 놓을 수 있다
    Given 사용자 A가 R1에 empathy 리액션을 했다
    When 사용자 B가 R1에 touching 리액션을 시도한다
    Then 성공한다 (user_id가 다르므로 UNIQUE 위반 아님)
```

> D10 해결: 시나리오 6은 이제 단일 결정 동작(409 Conflict)만 규정한다.
> 업서트 대안은 제거되었으며, 미결정 사항 6.2가 해결되었다 (spec.md).

### 시나리오 7: user_books UNIQUE 제약

**검증 REQ**: REQ-DB-003

```gherkin
Feature: 서재 중복 등록 방지

  Scenario: 같은 사용자가 같은 책을 중복 등록할 수 없다
    Given 사용자 A가 이미 book_id=B를 user_books에 등록했다
    When 사용자 A가 동일한 (user_id=A, book_id=B) 행을 INSERT 시도한다
    Then UNIQUE(user_id, book_id) 제약 위반으로 실패한다 (409)

  Scenario: 다른 사용자는 같은 책을 등록할 수 있다
    Given 사용자 A가 book_id=B를 등록했다
    When 사용자 B가 book_id=B를 등록한다
    Then 성공한다 (user_id가 다름)
```

### 시나리오 8: auth.users → public.users 동기화

**검증 REQ**: REQ-DB-001, REQ-DB-013c

```gherkin
Feature: 회원가입 시 프로필 자동 생성

  Scenario: Supabase Auth 가입 시 public.users에 프로필이 자동 생성된다
    Given auth.users에 새 사용자가 INSERT된다 (OAuth 가입)
    When handle_new_user 트리거가 실행된다 (SECURITY DEFINER)
    Then public.users에 동일 id의 행이 생성된다
    And nickname, email, provider 컬럼이 auth.users 메타데이터에서 채워진다
    And RLS 정책이 즉시 적용되어 자신의 행만 조회 가능하다
```

### 시나리오 9: 마이그레이션 순서 의존성

**검증 REQ**: REQ-DB-013a

```gherkin
Feature: 마이그레이션 순서 검증

  Scenario: clubs는 emotion_records보다 먼저 생성되어야 한다
    Given 마이그레이션 0004_create_clubs와 0005_create_emotion_records가 있다
    When emotion_records.club_id FK가 clubs를 참조한다
    Then 0004가 0005보다 먼저 실행되어야 한다
    And 순서가 잘못되면 FK 생성 시 에러가 발생한다

  Scenario: RLS 활성화는 모든 테이블 생성 후 실행된다
    Given 0001~0012 마이그레이션이 테이블을 생성한다
    When 0014_enable_rls_and_policies가 실행된다
    Then 모든 테이블(11개 사용자 데이터 + books)에 RLS가 일괄 활성화된다
    And 정책이 누락된 테이블이 없다 (기본 거부 원칙)
```

---

## 5. 보안 뷰 및 헬퍼 함수 시나리오 (신규)

### 시나리오 10: books 공개 카탈로그 정책 (REQ-DB-013b, 신규)

**검증 REQ**: REQ-DB-013b, REQ-DB-002

```gherkin
Feature: books 공개 카탈로그 접근

  Scenario: 인증된 사용자가 모든 books 행을 조회할 수 있다
    Given books 테이블에 도서 100권이 존재한다
    And books에 RLS가 활성화되어 있다
    When 인증된 사용자가 "GET /rest/v1/books"를 호출한다
    Then 100권 모두 반환된다 (SELECT USING(true) 정책)
    And 응답에 빈 결과가 아닌 전체 카탈로그가 포함된다

  Scenario: books SELECT 공개 정책이 마이그레이션에 존재한다 (정책 존재 단정)
    Given 마이그레이션이 적용된 데이터베이스가 있다
    When pg_policies에서 books 테이블의 정책을 조회한다
    Then authenticated 역할에 대해 cmd='SELECT' USING (true) 정책이 존재한다
    And 정책이 누락된 경우 인증 사용자 쿼리가 빈 결과를 반환함으로 회귀 감지 가능하다
```

### 시나리오 11: clubs INSERT 시 host 자동 가입 (REQ-DB-008b, 신규)

**검증 REQ**: REQ-DB-006, REQ-DB-007, REQ-DB-008b, REQ-DB-013c

```gherkin
Feature: 모임 개설 시 host 자동 멤버십

  Scenario: clubs INSERT 시 handle_new_club_host 트리거가 host 멤버십 생성
    Given 사용자 A가 인증되어 있다
    And club_members에 사용자 A의 행이 없다
    When 사용자 A가 clubs에 새 모임(host_id=A)을 INSERT한다
    Then clubs 행이 생성된다
    And handle_new_club_host 트리거(SECURITY DEFINER)가 발화한다
    And club_members에 (club_id=새모임, user_id=A, role=host) 행이 자동 삽입된다
    And joined_at이 현재 시각으로 설정된다

  Scenario: host가 아닌 사용자는 club_members INSERT를 직접 할 수 없다
    Given 사용자 B가 인증되어 있다
    When 사용자 B가 club_members에 직접 INSERT를 시도한다
    Then RLS 정책이 차단한다 (클라이언트 INSERT 정책 없음)
    And 오직 SECURITY DEFINER 트리거만 club_members에 INSERT 가능하다
```

### 시나리오 12: reading_sessions 본인만 접근 (REQ-DB-021, 신규)

**검증 REQ**: REQ-DB-009, REQ-DB-021

```gherkin
Feature: reading_sessions RLS — 본인만

  Scenario: 사용자는 자신의 독서 세션만 조회할 수 있다
    Given 사용자 A가 reading_sessions 행 3개를 가지고 있다
    And 사용자 B가 reading_sessions 행 2개를 가지고 있다
    When 사용자 A가 "GET /rest/v1/reading_sessions"를 호출한다
    Then 사용자 A의 행 3개만 반환된다
    And 사용자 B의 행은 포함되지 않는다

  Scenario: 타인의 독서 세션은 조회할 수 없다
    Given 사용자 B의 reading_sessions 행이 존재한다
    When 사용자 A가 해당 세션 ID로 직접 조회 시도한다
    Then 빈 결과가 반환된다 (RLS 기본 거부)
```

### 시나리오 13: point_logs 본인만 조회 (REQ-DB-021, 신규)

**검증 REQ**: REQ-DB-011, REQ-DB-021

```gherkin
Feature: point_logs RLS — 본인만, 조회 전용

  Scenario: 사용자는 자신의 포인트 내역만 조회할 수 있다
    Given 사용자 A가 point_logs 행(amount=+100, reason=completion)을 가지고 있다
    And 사용자 B가 point_logs 행(amount=+50, reason=reaction)을 가지고 있다
    When 사용자 A가 "GET /rest/v1/point_logs"를 호출한다
    Then 사용자 A의 행만 반환된다
    And 사용자 B의 amount=50 행은 노출되지 않는다

  Scenario: 클라이언트는 point_logs에 INSERT/UPDATE할 수 없다
    Given 사용자 A가 인증되어 있다
    When 사용자 A가 point_logs에 직접 INSERT를 시도한다
    Then RLS 정책이 차단한다 (조회 전용, service_role만 INSERT)
```

### 시나리오 14: notifications 본인만 조회, 서버만 생성 (REQ-DB-021, 신규)

**검증 REQ**: REQ-DB-012, REQ-DB-021, REQ-DB-013c

```gherkin
Feature: notifications RLS — 본인 조회, 서버 INSERT

  Scenario: 사용자는 자신의 알림만 조회할 수 있다
    Given 사용자 A에게 notifications 행 3개가 있다
    And 사용자 B에게 notifications 행 5개가 있다
    When 사용자 A가 "GET /rest/v1/notifications"를 호출한다
    Then 사용자 A의 행 3개만 반환된다

  Scenario: 사용자는 자신의 알림 is_read만 업데이트할 수 있다
    Given 사용자 A의 notifications 행(is_read=false)이 있다
    When 사용자 A가 해당 행을 { "is_read": true }로 PATCH한다
    Then 업데이트가 성공한다 (auth.uid() = user_id)

  Scenario: 클라이언트는 notifications를 직접 생성할 수 없다
    Given 사용자 A가 인증되어 있다
    When 사용자 A가 notifications에 직접 INSERT를 시도한다
    Then RLS 정책이 차단한다
    And 오직 service_role 또는 SECURITY DEFINER 트리거만 INSERT 가능하다
```

### 시나리오 15: SECURITY DEFINER 트리거 검증 (REQ-DB-013c, 신규)

**검증 REQ**: REQ-DB-013c

```gherkin
Feature: SECURITY DEFINER 트리거 — RLS 보호 테이블 INSERT

  Scenario: 4개 트리거 함수 모두 SECURITY DEFINER로 정의됨
    Given 마이그레이션이 적용된 데이터베이스가 있다
    When pg_proc에서 4개 트리거 함수의 정의를 조회한다
    Then handle_new_user, join_request_accept, handle_new_club_host,
         generate_completion_report 모두 SECURITY DEFINER로 정의되어 있다
    And 각 함수 소유자가 해당 테이블 INSERT 권한을 가진 역할이다

  Scenario: SECURITY DEFINER 속성 단정 (회귀 방지)
    Given 마이그레이션이 적용된 데이터베이스가 있다
    When pg_proc에서 4개 트리거 함수의 prosecdef 컬럼을 조회한다
    Then 각 함수의 prosecdef = true이다 (모두 SECURITY DEFINER)
    And SECURITY INVOKER로 잘못 정의된 경우 club_members INSERT가 RLS에 의해
        거부됨으로 회귀 감지 가능하다
```

### 시나리오 16: club_members RLS 및 fn_user_in_club 헬퍼 (REQ-DB-019, REQ-DB-013d, 신규)

**검증 REQ**: REQ-DB-019, REQ-DB-013d

```gherkin
Feature: club_members RLS — 같은 모임원만 조회, 재귀 없음

  Scenario: 모임원은 같은 모임의 club_members 행을 조회할 수 있다
    Given 사용자 A와 사용자 B가 모두 그룹 X의 멤버이다
    When 사용자 A가 "GET /rest/v1/club_members?club_id=eq.X"를 호출한다
    Then 그룹 X의 모든 멤버 행이 반환된다 (사용자 A, B 포함)
    And fn_user_in_club(X)가 사용자 A에 대해 true를 반환한다

  Scenario: 비모임원은 다른 모임의 club_members 행을 조회할 수 없다
    Given 사용자 C는 그룹 X의 멤버가 아니다
    When 사용자 C가 "GET /rest/v1/club_members?club_id=eq.X"를 호출한다
    Then 빈 결과가 반환된다 (fn_user_in_club(X) = false)

  Scenario: fn_user_in_club이 club_members RLS 재귀를 유발하지 않음
    Given emotion_records(visibility=club, club_id=X) 행이 존재한다
    When 사용자 B(그룹 X 멤버)가 감정 기록 피드를 조회한다
    Then fn_user_in_club(X)가 SECURITY DEFINER로 RLS를 우회하여 판정한다
    And club_members 자체 RLS로 인한 재귀/빈 결과가 발생하지 않는다
    And emotion_records.club_id=X 행이 정상적으로 반환된다

  Scenario: 사용자는 자신의 멤버십만 탈퇴할 수 있다
    Given 사용자 A가 그룹 X의 멤버이다
    When 사용자 B가 사용자 A의 club_members 행을 DELETE 시도한다
    Then RLS 정책이 차단한다 (auth.uid() != user_id)
    When 사용자 A가 자신의 club_members 행을 DELETE한다
    Then 탈퇴가 성공한다
```

### 시나리오 17: users 보안 뷰를 통한 타인 프로필 (REQ-DB-014, REQ-DB-013e, 신규)

**검증 REQ**: REQ-DB-014, REQ-DB-013e

```gherkin
Feature: users RLS — 자기 행만, 타인은 user_profiles 뷰

  Scenario: 사용자는 자신의 users 행을 전체 조회할 수 있다
    Given 사용자 A가 인증되어 있다
    When 사용자 A가 "GET /rest/v1/users?id=eq.{A}"를 호출한다
    Then 자신의 행이 모든 컬럼(email, reading_alarm_time 등 포함)과 함께 반환된다

  Scenario: 베이스 users 테이블에서 타인 행은 숨겨진다
    Given 사용자 A와 사용자 B가 모두 인증되어 있다
    When 사용자 A가 "GET /rest/v1/users?id=eq.{B}"를 호출한다
    Then 빈 결과가 반환된다 (RLS 기본 거부, auth.uid() != id)

  Scenario: 타인 공개 프로필은 user_profiles 뷰를 통해서만 노출
    Given 사용자 A와 사용자 B가 모두 인증되어 있다
    When 사용자 A가 "GET /rest/v1/user_profiles?id=eq.{B}"를 호출한다
    Then 사용자 B의 nickname, avatar_url만 반환된다
    And email, reading_alarm_time, reading_alarm_enabled는 노출되지 않는다

  Scenario: 사용자는 자신의 users 행만 수정할 수 있다
    Given 사용자 A가 인증되어 있다
    When 사용자 A가 "PATCH /rest/v1/users?id=eq.{A}"를 호출한다
    Then 업데이트가 성공한다 (auth.uid() = id)
    When 사용자 A가 "PATCH /rest/v1/users?id=eq.{B}"를 시도한다
    Then RLS 정책이 차단한다 (0행 영향)
```

### 시나리오 18: sticker_reactions 전체 공개 읽기 (REQ-DB-017, 신규)

**검증 REQ**: REQ-DB-017

```gherkin
Feature: sticker_reactions RLS — 전체 공개 읽기, 본인만 쓰기

  Scenario: 모든 인증 사용자가 sticker_reactions 전체 행을 조회할 수 있다
    Given 사용자 A가 R1에 empathy 리액션을 했다
    And 사용자 B가 R1에 touching 리액션을 했다
    When 사용자 C(제3자)가 "GET /rest/v1/sticker_reactions?record_id=eq.R1"를 호출한다
    Then 사용자 A와 사용자 B의 리액션이 모두 반환된다 (USING(true))

  Scenario: 사용자는 자신의 리액션만 관리할 수 있다
    Given 사용자 A가 R1에 empathy 리액션을 했다
    When 사용자 B가 사용자 A의 리액션을 DELETE 시도한다
    Then RLS 정책이 차단한다 (auth.uid() != user_id)
    When 사용자 A가 자신의 리액션을 DELETE한다
    Then 삭제가 성공한다
```

---

## 6. 품질 게이트 (Quality Gates)

### TRUST 5 검증

| 항목 | 기준 | 검증 방법 |
|------|------|-----------|
| **Tested** | RLS 정책 100% 커버 | 각 테이블당 최소 2개 RLS 테스트 (본인/타인) + 보안 뷰 테스트 |
| **Readable** | 마이그레이션 파일명 규칙 준수 | `NNNN_descriptive_name.sql` 형식 |
| **Unified** | 제약/ENUM 명명 규칙 일관 | `check_`, `_type` 접미사 일관 사용 |
| **Secured** | RLS 기본 거부, service_role 제한, 보안 뷰 적용 | 모든 테이블 RLS 활성화 + 뷰 GRANT 확인 (Option A: 베이스 테이블 REVOKE 없음) |
| **Trackable** | 마이그레이션 커밋 메시지 | `feat(db): add {table} table` 형식 |

### Definition of Done

본 SPEC은 다음 조건이 모두 충족되면 완료로 간주한다:

1. 16개 마이그레이션 파일이 `supabase/migrations/`에 존재한다
2. `supabase db push`가 로컬 환경에서 에러 없이 실행된다
3. 모든 12개 엔터티 테이블이 생성되어 있다
4. 모든 테이블(11개 사용자 데이터 + books)에 RLS가 활성화되어 있다
5. 보안 뷰 `user_profiles`, `user_books_public`이 생성되고 `authenticated` SELECT GRANT가 적용되어 있다 (Option A — 베이스 테이블 REVOKE 없음, RLS own-row 정책으로 자기 행만 노출)
6. `fn_user_in_club` 헬퍼 함수가 SECURITY DEFINER로 정의되어 있다
7. 4개 SECURITY DEFINER 트리거(handle_new_user, join_request_accept, handle_new_club_host, generate_completion_report)가 정의되어 있다
8. `supabase db reset` 후 시나리오 1-18이 통과한다
9. 두 개의 분리된 사용자 계정으로 RLS 격리 테스트가 통과한다
10. ERD(pages_06)의 모든 컬럼이 스키마에 반영되어 있다

### 검증 도구

- **Supabase CLI**: `supabase db push`, `supabase db reset`
- **RLS 테스트**: 두 개의 anon-key 클라이언트로 행 노출 검증
- **제약 검증**: 의도적 위반 INSERT로 에러 코드 확인 (23505 unique, 23514 check)
- **트리거 검증**: `service_role`로 부작용 행 직접 조회
- **보안 뷰 검증**: 베이스 테이블 vs 뷰 컬럼 노출 차이 단정
- **SECURITY DEFINER 검증**: `pg_proc.prosecdef = true` 단정

---

## 7. 수동 검증 체크리스트

구현 완료 후 다음 항목을 수동으로 확인한다:

- [ ] `supabase db reset`이 클린 상태에서 성공한다
- [ ] 모든 테이블(11개 사용자 데이터 + books)에 `ROW LEVEL SECURITY: ENABLED` 표시 (`\d+ tablename`)
- [ ] books 테이블에 `SELECT USING (true)` 공개 정책이 존재한다 (REQ-DB-013b)
- [ ] 보안 뷰 `user_profiles`(id, nickname, avatar_url)와 `user_books_public`(book_id, current_page, started_reading_at, user_id, is_public 필터)이 존재한다 (REQ-DB-013e, Option A)
- [ ] 베이스 테이블 users, user_books의 `authenticated` SELECT가 REVOKE되어 있지 않다 (Option A — RLS own-row 정책으로 자기 행만 노출)
- [ ] `fn_user_in_club` 함수가 SECURITY DEFINER로 정의되어 있다 (REQ-DB-013d)
- [ ] 4개 트리거 함수가 SECURITY DEFINER로 정의되어 있다 (REQ-DB-013c)
- [ ] `auth.uid()` 함수가 모든 사용자 데이터 정책에 사용된다
- [ ] CHECK 제약이 status/visibility/role/sticker_type에 적용되어 있다
- [ ] UNIQUE 제약이 (user_id, book_id), (record_id, user_id), (club_id, user_id),
      (club_id, requester_id), (user_book_id in completion_reports)에 존재한다
- [ ] 인덱스 12개가 생성되어 있다 (ERD 섹션 3)
- [ ] join_requests BEFORE UPDATE 트리거가 RAISE EXCEPTION으로 재처리를 거부한다 (REQ-DB-008)
- [ ] completion_reports 생성 트리거가 `ON CONFLICT (user_book_id) DO NOTHING`을 사용한다 (REQ-DB-010)
- [ ] clubs INSERT 시 host가 자동으로 club_members(role=host)에 추가된다 (REQ-DB-008b)
