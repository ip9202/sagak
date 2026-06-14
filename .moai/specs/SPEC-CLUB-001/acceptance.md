---
id: SPEC-CLUB-001
title: "Track A — 합류형 요청 — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-001 인수 기준

## 개요

본 문서는 SPEC-CLUB-001 요구사항(REQ-CLUBA-001 ~ REQ-CLUBA-012)의 인수 기준을
Given-When-Then(Gherkin) 형식으로 정의한다. 각 시나리오는 관찰 가능한 증거(테스트 출력,
DB 행 상태, 에러 응답)를 기반으로 검증 가능해야 한다.

---

## Module 1: REQ-CLUBA-READER — Track A 독자 목록 조회

### 시나리오 R1: 독자 목록 조회 (user_books_public 뷰 소비)

**Given** `user_books_public` 보안 뷰가 `is_public=true` 행만 노출하도록 정의되어 있다
**When** 요청자가 `fetchActiveReaders(bookId)`를 호출한다
**Then** 시스템은 해당 `book_id`를 가진 공개 독자 행들을 반환해야 한다
**And** 각 행은 제한 컬럼(`user_id`, `current_page`, `started_reading_at`, `book_id`)만 포함해야 한다

**검증 방법**: 통합 테스트 — Supabase 로컬 환경에서 2명 이상의 공개 독자 + 1명의 비공개 독자
 설정 후, 공개 독자만 반환되는지 확인. 비공개 독자(`is_public=false`)는 결과에 포함되지 않아야 함.

### 시나리오 R2: 비공개 독자 제외 (is_public 필터)

**Given** 독자 A는 `user_books.is_public=true`, 독자 B는 `user_books.is_public=false`이다
**When** 요청자가 동일한 `book_id`로 독자 목록을 조회한다
**Then** 시스템은 독자 A만 반환하고, 독자 B는 반환하지 않아야 한다

**검증 방법**: 통합 테스트 — `user_books_public` 뷰 쿼리 결과에 독자 B의 `user_id`가 없는지 확인.

### 시나리오 R3: 유령 유저 필터링 (활성 독자 정렬)

**Given** 독자 목록에 `started_reading_at` 값이 다양한 독자들이 존재한다
**When** 요청자가 독자 목록을 조회한다
**Then** 시스템은 `started_reading_at` 기준으로 정렬된 결과를 반환해야 한다 (최근 시작 우선)

**검증 방법**: 단위 테스트 — 정렬 로직에 동일한 `book_id`, 다른 `started_reading_at`을 가진
 모의 데이터를 입력하여 순서 검증.

### 시나리오 R4: 독자별 그룹 식별 (club_id 매핑)

**Given** 독자 A는 `clubs`(type='group', status='active')에 속해 있고, 독자 B는 어떤 그룹에도 속하지 않는다
**When** 요청자가 독자 목록의 각 독자에 대해 그룹을 조회한다
**Then** 시스템은 독자 A에게는 해당 `club_id`를 매핑하고, 독자 B에게는 `club_id=null`을 반환해야 한다

**검증 방법**: 통합 테스트 — `club_members` JOIN 조회 후 `club_id` 매핑 검증. 그룹 없는 독자는
 `null` 반환 확인.

---

## Module 2: REQ-CLUBA-REQUEST — 합류 요청 생성

### 시나리오 R5: 합류 요청 생성 (pending 초기 상태)

**Given** 요청자가 인증되어 있고 (`auth.uid()` 유효), 대상 `club_id`가 존재한다
**When** 요청자가 `createJoinRequest(clubId, message)`를 호출한다
**Then** 시스템은 `join_requests`에 새 행을 INSERT해야 한다
**And** `status`는 `'pending'`이어야 한다
**And** `requester_id`는 `auth.uid()`와 일치해야 한다
**And** `message`는 요청자가 전달한 값이어야 한다

**검증 방법**: 통합 테스트 — INSERT 후 `join_requests` SELECT로 행 검증. `status='pending'`,
 `requester_id=auth.uid()` 확인.

### 시나리오 R6: 중복 요청 방지 (UNIQUE 위반 409)

**Given** 요청자가 이미 동일한 `(club_id, requester_id)` 요청을 보낸 상태이다
**When** 요청자가 동일한 `club_id`로 재요청을 시도한다
**Then** 시스템은 UNIQUE 제약 위반으로 INSERT가 실패해야 한다
**And** 에러 정규화는 이를 `VALIDATION` 카테고리로 분류해야 한다
**And** 사용자 친화적 메시지 "이미 이 그룹에 요청을 보냈습니다"를 반환해야 한다

**검증 방법**: 통합 테스트 — 첫 요청 성공 후, 동일 조건 재요청 시 409 응답 확인.
 에러 정규화(`normalizeError`) 출력 카테고리 검증.

### 시나리오 R7: RLS 권한 강제 (요청자 본인만 INSERT)

**Given** 요청자 A가 인증되어 있다
**When** 요청자 A가 `requester_id`를 요청자 B의 ID로 위조하여 INSERT를 시도한다
**Then** 시스템은 RLS 정책 `join_requests_insert_own`(WITH CHECK `auth.uid() = requester_id`)에
 의해 INSERT를 거부해야 한다
**And** 에러 정규화는 이를 `RLS_DENIED` 카테고리로 분류해야 한다

**검증 방법**: pgTAP 테스트 (SPEC-DB-001 패턴) — 요청자 A 세션으로 `requester_id=B` INSERT 시도 시
 실패 확인.

### 시나리오 R8: 대상 그룹 없음 시 lazy 생성 (Edge Function 위임)

**Given** 대상 독자가 어떤 `clubs` 행도 가지고 있지 않다 (`club_id=null`)
**When** 요청자가 해당 독자에게 합류 요청을 보낸다
**Then** 시스템은 Edge Function `process-join-request`를 호출해야 한다
**And** Edge Function은 대상 독자의 1인 그룹(`type='group'`, `status='active'`)을 lazy 생성해야 한다
**And** `handle_new_club_host` 트리거가 대상 독자를 host로 자동 가입시켜야 한다
**And** 생성된 `club_id`로 `join_requests` 행이 INSERT되어야 한다

**검증 방법**: 통합 테스트 — Edge Function 호출 후 `clubs` 행 생성, `club_members`(role='host')
 행 존재, `join_requests` 행 존재 확인. `club_id`가 lazy 생성된 값과 일치하는지 검증.

---

## Module 3: REQ-CLUBA-RESPOND — host 승인/거절 응답

### 시나리오 R9: host 승인 (pending → accepted)

**Given** host가 인증되어 있고, `join_requests` 행 하나가 `status='pending'`이다
**When** host가 `respondToJoinRequest(requestId, 'accepted')`를 호출한다
**Then** 시스템은 해당 행의 `status`를 `'accepted'`로 전환해야 한다
**And** `responded_at`을 `now()`로 설정해야 한다

**검증 방법**: 통합 테스트 — host 세션으로 UPDATE 후 `join_requests` SELECT로 `status='accepted'`,
 `responded_at` NOT NULL 확인.

### 시나리오 R10: host 거절 (pending → declined)

**Given** host가 인증되어 있고, `join_requests` 행 하나가 `status='pending'`이다
**When** host가 `respondToJoinRequest(requestId, 'declined')`를 호출한다
**Then** 시스템은 해당 행의 `status`를 `'declined'`로 전환해야 한다
**And** `responded_at`을 `now()`로 설정해야 한다
**And** `club_members`에 어떤 행도 추가되지 않아야 한다

**검증 방법**: 통합 테스트 — UPDATE 후 `status='declined'` 확인. `club_members`에 해당
 `requester_id` 행이 없는지 확인.

### 시나리오 R11: host 전용 권한 (비host 거부)

**Given** 요청자가 host가 아닌 사용자(일반 멤버 또는 외부자)이고, 요청이 `status='pending'`이다
**When** 비host 사용자가 해당 요청의 `status`를 변경하려 시도한다
**Then** 시스템은 RLS 정책 `join_requests_update_host`(`auth.uid() = club.host_id`)에 의해
 UPDATE를 거부해야 한다
**And** 에러 정규화는 이를 `RLS_DENIED` 카테고리로 분류해야 한다

**검증 방법**: pgTAP 테스트 — 비host 세션으로 UPDATE 시도 시 실패 확인. `RLS_DENIED` 에러 카테고리 검증.

### 시나리오 R12: terminal 상태 재설정 거부 (트리거 예외 처리)

**Given** `join_requests` 행 하나가 `status='accepted'`이다 (terminal 상태)
**When** host가 해당 행의 `status`를 다시 `'pending'` 또는 `'declined'`로 변경하려 시도한다
**Then** 시스템은 DB `BEFORE UPDATE` 트리거(`guard_join_request_status_trigger`)의
 `RAISE EXCEPTION`으로 인해 UPDATE가 실패해야 한다
**And** 에러 정규화는 이를 `VALIDATION` 카테고리로 분류해야 한다
**And** 사용자 친화적 메시지 "이미 처리된 요청입니다"를 반환해야 한다

**검증 방법**: 통합 테스트 — accepted 상태에서 status 재설정 시도 시 예외 발생 확인.
 예외 메시지에 "terminal" 포함 여부 검증. 클라이언트 에러 처리 로직이 `VALIDATION` 카테고리로 분류하는지 확인.

### 시나리오 R13: terminal 상태 양성 편집 허용 (message 수정)

**Given** `join_requests` 행 하나가 `status='accepted'`이다 (terminal 상태)
**When** host가 해당 행의 `status`는 변경하지 않고 `message` 컬럼만 수정한다
**Then** 시스템은 UPDATE를 허용해야 한다 (트리거 조건이 `status` 변경만 차단하므로)

**검증 방법**: 통합 테스트 — accepted 상태에서 message만 UPDATE 시도 시 성공 확인.
 `status` 값이 불변인지, `message`만 변경되었는지 검증.

---

## Module 4: REQ-CLUBA-MEMBER — 수락 시 club_members 자동 추가

### 시나리오 R14: accepted 전환 시 club_members 자동 INSERT

**Given** `join_requests` 행 하나가 `status='pending'`이고, 요청자는 아직 해당 그룹의 멤버가 아니다
**When** host가 해당 요청을 `status='accepted'`로 전환한다
**Then** 시스템은 동일 트랜잭션 내에서 `club_members`에 `(club_id, requester_id, role='member')`
 행을 자동 INSERT해야 한다 (`join_request_accept_trigger`, SECURITY DEFINER)
**And** 요청자는 자동으로 그룹 멤버가 되어야 한다

**검증 방법**: 통합 테스트 — accepted 전환 후 `club_members` SELECT로 `(club_id, requester_id)`
 행 존재 확인. `role='member'` 검증. 클라이언트가 INSERT를 수행하지 않았음을 확인 (트리거 단독).

### 시나리오 R15: 수락 후 멤버십 확인 (클라이언트 관측)

**Given** 요청이 `accepted`로 전환되어 트리거가 `club_members`에 행을 추가했다
**When** 요청자가 `confirmMembership(clubId)`를 호출한다
**Then** 시스템은 `club_members`에서 해당 `club_id`와 요청자의 `user_id`를 가진 행을 반환해야 한다
**And** RLS 정책 `club_members_select_same_club`(`fn_user_in_club`)이 요청자의 조회를 허용해야 한다

**검증 방법**: 통합 테스트 — accepted 후 요청자 세션으로 `club_members` SELECT 시 자신의 멤버십
 행이 보이는지 확인. `fn_user_in_club`이 true를 반환하는지 검증.

### 시나리오 R16: declined 시 멤버십 미추가

**Given** `join_requests` 행 하나가 `status='pending'`이다
**When** host가 해당 요청을 `status='declined'`로 전환한다
**Then** 시스템은 `club_members`에 어떤 행도 추가하지 않아야 한다
**And** `join_request_accept_trigger`는 `NEW.status='accepted'` 조건에서만 발화하므로,
 declined 전환은 멤버십에 영향을 주지 않는다

**검증 방법**: 통합 테스트 — declined 전환 후 `club_members`에 해당 `requester_id` 행이 없는지 확인.

### 시나리오 R17: SECURITY DEFINER 트리거 RLS 우회 검증

**Given** `join_request_accept` 트리거는 SECURITY DEFINER로 정의되어 있다
**When** host가 요청을 accepted로 전환하여 트리거가 발화한다
**Then** 시스템은 트리거가 RLS를 우회하여 `club_members` INSERT를 수행해야 한다
**And** 클라이언트에게 RLS 거부 에러가 반환되지 않아야 한다

**검증 방법**: pgTAP 테스트 — host 세션에서 accepted 전환 시 트리거가 정상적으로
 `club_members`에 INSERT하는지 확인. SECURITY DEFINER 속성(prosecdef=true) 검증 (SPEC-DB-001 패턴).

---

## 엣지 케이스 (Edge Cases)

### 엣지 케이스 E1: 자기 자신에게 합류 요청

**Given** 요청자가 자신이 host인 그룹에 합류 요청을 시도한다
**When** 요청자가 `createJoinRequest(ownClubId, message)`를 호출한다
**Then** 시스템은 UNIQUE 제약(`club_id`, `requester_id`) 또는 비즈니스 로직에 의해 거부해야 한다
 (host는 이미 `club_members`에 존재하므로 합류 요청이 무의미)

**검증 방법**: 통합 테스트 — 자기 그룹에 요청 시도 시 에러 응답 확인. UX에서 사전 차단 권장.

### 엣지 케이스 E2: 비활성 그룹(closed)에 합류 요청

**Given** 대상 그룹의 `status='closed'`이다
**When** 요청자가 해당 그룹에 합류 요청을 시도한다
**Then** 시스템은 요청을 허용하거나 거부해야 한다 (비즈니스 결정 미확정)
**And** MVP에서는 명시적 검증 없이 요청을 허용하되, host가 응답하지 않을 수 있음을 UX로 안내

**검증 방법**: 단위 테스트 — closed 그룹 요청 시나리오 문서화. 향후 비즈니스 로직 확정 시 검증 강화.

### 엣지 케이스 E3: 네트워크 장애 시 요청 재시도

**Given** 요청자가 합류 요청을 보냈으나 네트워크 장애로 응답을 받지 못했다
**When** 클라이언트가 재시도 로직을 수행한다
**Then** 시스템은 UNIQUE 제약으로 인해 재시도가 409를 반환할 수 있음을 감지해야 한다
**And** 최초 요청이 성공했을 가능성을 UI로 안내해야 한다 ("요청이 전송되었을 수 있습니다")

**검증 방법**: 단위 테스트 — 네트워크 모킹, 재시도 후 409 응답 시나리오 처리 검증.

### 엣지 케이스 E4: 메시지 길이 제한

**Given** 요청자가 매우 긴 `message`를 입력한다
**When** `createJoinRequest`가 호출된다
**Then** 시스템은 `message` 필드의 길이 제한(예: 500자)을 적용해야 한다
**And** 제한 초과 시 `VALIDATION` 에러를 반환해야 한다

**검증 방법**: 단위 테스트 — 길이 제한 초과 메시지 입력 시 에러 검증. 제한 값은 구현 시 확정.

---

## 품질 게이트 요약

### 관측 가능한 증거 요구사항

각 시나리오는 다음 중 하나 이상의 관측 가능한 증거를 제공해야 한다:

1. **DB 행 상태**: `join_requests.status`, `club_members` 행 존재 여부 (SELECT 쿼리 결과)
2. **에러 응답**: HTTP 상태 코드(409, 403), 에러 카테고리(`VALIDATION`, `RLS_DENIED`)
3. **트리거 동작**: `RAISE EXCEPTION` 메시지, SECURITY DEFINER 속성(prosecdef)
4. **사용자 메시지**: 한국어 사용자 친화적 메시지 반환 ("이미 이 그룹에 요청을 보냈습니다" 등)

### 커버리지 요구사항

- 단위 테스트: Track A API 함수(fetchActiveReaders, createJoinRequest, respondToJoinRequest,
  confirmMembership) 85%+ 커버리지
- 통합 테스트: 상태 기계 전환(pending → accepted, pending → declined) 전수 시나리오
- RLS 검증: pgTAP 기반 요청자/host 격리, fn_user_in_club 재귀 차단 (SPEC-DB-001 272 테스트에 추가)

### Definition of Done

- [ ] 모든 REQ-CLUBA-001 ~ 012 시나리오 통과
- [ ] 4개 엣지 케이스 처리 로직 구현
- [ ] 단위 테스트 85%+ 커버리지 달성
- [ ] 통합 테스트: 상태 기계 전환 전수 검증
- [ ] RLS 격리: 요청자/host 권한 경계 확인
- [ ] 트리거 예외 처리: terminal 상태, UNIQUE 위한 사용자 메시지 반환
- [ ] TRUST 5 품질 게이트 통과
- [ ] 한국어 주석 및 사용자 메시지 적용
