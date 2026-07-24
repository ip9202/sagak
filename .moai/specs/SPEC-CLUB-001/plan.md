---
id: SPEC-CLUB-001
title: "Track A — 합류형 요청 — Implementation Plan"
version: "1.2.0"
status: completed
created: 2026-06-14
updated: 2026-07-24
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-001 구현 계획

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Track A 클라이언트 구현 단계, Edge Function 계약, 리스크/테스트 전략 | 강력쇠주먹 |
| 2026-06-19 | 1.0.1 | M1~M5 구현 완료 반영 — 12 태스크 전수 구현, 789 테스트 PASS, 커버리지 게이트 충족 (progress.md 기준) | 강력쇠주먹 |
| 2026-06-23 | 1.1.0 | 구현 완료 상태로 전환. Edge Function skeleton 한계(M-1/M-2 보안 블로커) 및 통합 검증 지연 항목을 "잔여 작업"으로 명시. PR #21 expert-security 리뷰 결과 반영 | 강력쇠주먹 |
| 2026-06-23 | 1.2.0 | Edge Function M-1(JWT sub 검증) / M-2(입력 검증) 보안 요구사항 구현 완료 (commit 714490c). process-join-request/index.ts, logic.ts 수정. status: skeleton → implemented 전환. 잔여 작업 5.1(Edge Function 완성) 및 리스크 6.1(CRITICAL) 해결 표시 | 강력쇠주먹 |

---

## 개요

본 문서는 SPEC-CLUB-001(Track A 합류형 요청)의 구현 계획을 정의한다. DB 스키마, 상태 기계 트리거,
RLS 정책은 SPEC-DB-001(v1.2.0)에서 이미 완료되었으며, 본 SPEC은 **클라이언트 측 기능 구현**과
**Edge Function 구현**을 다룬다. Edge Function `process-join-request`은 v1.2.0에서 M-1/M-2 보안
요구사항과 함께 lazy 그룹 생성 + INSERT 로직 구현을 완료했다 (commit 714490c).

> 본 문서는 구현 코드를 포함하지 않는다. 구현 코드는 `/moai run SPEC-CLUB-001` 단계에서
> manager-tdd 에이전트가 작성했으며, 산출물은 `src/features/club/trackA/` 및
> `supabase/functions/process-join-request/`에 위치한다.

---

## 1. 구현 상태 요약 (Implementation Status)

| 마일스톤 | 범위 | 상태 | 비고 |
|----------|------|------|------|
| M1 — 데이터 계층 + Edge Function skeleton | T-001~T-008 | COMPLETE (2026-06-19) | trackA types/api/processJoinRequest + Deno skeleton, 54 테스트 |
| M2 — 훅 계층 | T-009 | COMPLETE (2026-06-19) | React Query 훅 4종 |
| M3 — 독자 목록 UI | T-010 | COMPLETE (2026-06-19) | ReadersScreen (SPEC-UI-002 준수) |
| M4 — 요청 작성 UI | T-011 | COMPLETE (2026-06-19) | JoinRequestSheet |
| M5 — host 응답 UI | T-012 | COMPLETE (2026-06-19) | HostRequestsScreen + terminal 에러 처리 |

**게이트 결과 (2026-06-19 기준)**:
- `npx tsc --noEmit`: 0 에러
- `npx jest`: 91 suite / 789 테스트 PASS
- club/ trackA 커버리지: Statements 93.44%, Branches 80.55%, Functions 92.68%, Lines 95.85% (80% 게이트 충족)
- SPEC-UI-002 FROZEN 규칙 준수 — 3계층 레이아웃, 타이틀 균일성, 카드 밀도, 빈/로딩/에러 상태, token-only 스타일링, 비과시 원칙

> 상세 산출물(커밋 SHA, 파일 목록)은 `progress.md` 참조.

---

## 2. 마일스톤 (우선순위 기반)

### Primary Goal — Track A 핵심 플로우 (요청 → 응답 → 멤버 추가) [COMPLETE]

| 단계 | 범위 | 관련 REQ | 상태 |
|------|------|----------|------|
| P1-1 | 독자 목록 조회 함수 (`fetchActiveReaders` + `resolveClubIdsForUsers`) | REQ-CLUBA-001 ~ 003 | COMPLETE |
| P1-2 | 합류 요청 생성 함수 (`createJoinRequest`) | REQ-CLUBA-004 ~ 005 | COMPLETE |
| P1-3 | lazy 그룹 생성 Edge Function 위임 (`processJoinRequestViaEdgeFunction`) | REQ-CLUBA-006 | skeleton COMPLETE |
| P1-4 | host 응답 함수 (`respondToJoinRequest`) | REQ-CLUBA-007 ~ 009 | COMPLETE |
| P1-5 | 멤버십 확인 함수 (`confirmMembership`) | REQ-CLUBA-010 ~ 012 | COMPLETE |

### Secondary Goal — Edge Function 완성 [COMPLETE]

| 단계 | 범위 | 관련 REQ | 상태 |
|------|------|----------|------|
| S2-1 | `process-join-request` Deno skeleton + 순수 로직(logic.ts) | REQ-CLUBA-006 | COMPLETE |
| S2-2 | Edge Function lazy 그룹 생성 + INSERT 실제 구현 | REQ-CLUBA-006 | COMPLETE (commit 714490c) |
| S2-3 | Edge Function 인가 검증 (M-1: JWT sub → requester_id 덮어쓰기) | 보안 | COMPLETE (commit 714490c) |
| S2-4 | Edge Function 입력 검증 (M-2: target_user_id 공개 독자 + 활성 그룹 조회) | 보안 | COMPLETE (commit 714490c) |

### Final Goal — UI 화면 및 에러 처리 [COMPLETE]

| 단계 | 범위 | 관련 REQ | 상태 |
|------|------|----------|------|
| F3-1 | 독자 목록 화면 (ReadersScreen) | REQ-CLUBA-001 ~ 003 | COMPLETE |
| F3-2 | 요청 작성 화면 (JoinRequestSheet) | REQ-CLUBA-004 ~ 006 | COMPLETE |
| F3-3 | host 요청 관리 화면 (HostRequestsScreen) | REQ-CLUBA-007 ~ 009 | COMPLETE |
| F3-4 | terminal 상태 에러 처리 ("이미 처리된 요청입니다") | REQ-CLUBA-008 | COMPLETE |

### Optional Goal — 알림 연동 (SPEC-NOTIF-001 의존) [DEFERRED]

| 단계 | 범위 | 관련 REQ | 상태 |
|------|------|----------|------|
| O4-1 | `join_request_received` 알림 발송 트리거 | 미결정 5.1 | stub (TODO 표기) |
| O4-2 | `join_accepted` 알림 발송 트리거 | 미결정 5.1 | stub (TODO 표기) |

---

## 3. 기술 접근법 (Technical Approach)

### 3.1 클라이언트 아키텍처 (구현 완료)

Track A 기능은 `src/features/club/trackA/` 디렉토리에 배치되었다. SPEC-UI-001의 디자인 토큰과
SPEC-UI-002의 화면 패턴(3계층 레이아웃, 타이틀 균일성, 카드 밀도, 빈/로딩/에러 상태)을 준수한다.

**실제 모듈 구조**:
- `src/features/club/trackA/types.ts` — JoinResponseStatus/Action, MESSAGE_MAX_LENGTH=500,
  validateMessageLength, ActiveReader, gen-types Row 별칭
- `src/features/club/trackA/readersApi.ts` — fetchActiveReaders (`user_books_public` 뷰,
  started_reading_at DESC), resolveClubIdsForUsers (club_members JOIN clubs!inner)
- `src/features/club/trackA/joinRequestApi.ts` — createJoinRequest, fetchMyJoinRequests,
  fetchIncomingJoinRequests, respondToJoinRequest, confirmMembership
- `src/features/club/trackA/processJoinRequest.ts` — processJoinRequestViaEdgeFunction
  (invokeEdgeFunction 위임, lazy 그룹 생성)
- `src/features/club/trackA/hooks.ts` — React Query 훅 4종
  (useActiveReaders, useCreateJoinRequest, useRespondToJoinRequest, useConfirmMembership)
- `src/features/club/trackA/components/ReadersScreen.tsx` — 독자 목록 화면
- `src/features/club/trackA/components/JoinRequestSheet.tsx` — 요청 작성 모달 시트
- `src/features/club/trackA/components/HostRequestsScreen.tsx` — host 수신 요청 응답 화면
- `src/features/club/trackA/index.ts` — barrel export
- `app/(tabs)/readers.tsx`, `app/(tabs)/host-requests.tsx` — 숨겨진 스택 라우트 (href:null)

### 3.2 데이터 페칭 전략

React Query(중앙 QueryClientProvider — SPEC-LIBRARY-001 M0 부트스트랩)를 사용한다.
queryKey 캐싱 + mutation 성공 후 invalidate 패턴을 적용한다.
- `useActiveReaders(bookId)`: queryKey `['club','readers',bookId]`
- `useConfirmMembership(clubId, userId)`: queryKey `['club','membership',{clubId,userId}]`
- `useCreateJoinRequest` / `useRespondToJoinRequest`: 성공 후 readers/incoming 캐시 invalidate

### 3.3 상태 기계 소비 패턴

클라이언트는 DB 트리거를 "신뢰"하며, 상태 전환 무결성을 클라이언트 측에서 재검증하지 않는다.
대신, 트리거가 발생시키는 예외(terminal 상태 재설정, UNIQUE 위반)를 에러 정규화
(SPEC-API-001 REQ-API-011 ~ 014)를 통해 사용자 친화적 메시지로 변환한다.

**핵심 원칙**: 클라이언트는 `club_members`를 직접 INSERT하지 않는다. `accepted` 전환 후
`club_members`를 재조회하여 트리거 동작을 관측한다 (REQ-CLUBA-011).

### 3.4 Edge Function 계약 (process-join-request)

**입력**:
```
POST /functions/v1/process-join-request
Authorization: Bearer <jwt>  (요청자 세션)
{
  "target_user_id": "uuid",   // 합류 대상 독자
  "book_id": "uuid",          // 책 컨텍스트
  "message": "같이 읽어요!"   // 선택적 메시지 (최대 500자)
}
```

**출력 (200)**:
```json
{
  "club_id": "uuid",           // lazy 생성 또는 기존 그룹
  "join_request_id": "uuid",   // 생성된 요청
  "status": "pending"
}
```

**출력 (409)**: 중복 요청 (UNIQUE 위반, 23505)
**출력 (403)**: 권한 부족 (RLS 거부)
**출력 (400)**: 입력 검증 실패 (message 길이 초과 등)

> Edge Function은 `service_role` 키로 실행되어 RLS를 우회한다. lazy 그룹 생성 시
> `handle_new_club_host` 트리거가 대상 독자를 host로 자동 가입시킨다 (REQ-DB-008b).
>
> **보안 검증 (v1.2.0 구현 완료, commit 714490c)**:
> - **M-1 (인가)**: JWT `sub`를 검증된 `requester_id`로 덮어쓴다 (requester_id 위조 차단)
> - **M-2 (입력 검증)**: `target_user_id`가 `user_books_public` 공개 독자 + 활성 그룹 보유 여부 조회
> - **추가**: UNIQUE(23505) → 409 매핑, lazy 생성 race condition 방어, CORS Origin 화이트리스트화
> - 구현 파일: `supabase/functions/process-join-request/index.ts`, `logic.ts`

---

## 4. 아키텍처 설계 (RLS 신뢰 경계)

본 SPEC은 RLS를 데이터 보호의 단일 진실 원천으로 신뢰한다. 클라이언트 측 권한 검사는
수행하지 않으며, RLS 거부 시 에러 정규화(`RLS_DENIED` 카테고리)로 처리한다.

| 작업 | RLS 정책 | 실패 시 처리 |
|------|----------|-------------|
| 독자 목록 조회 | `user_books_public` 뷰 (authenticated GRANT) | 빈 결과 반환 |
| 요청 생성 | `join_requests_insert_own` (auth.uid()=requester_id) | `RLS_DENIED` 에러 |
| host 응답 | `join_requests_update_host` (auth.uid()=club.host_id) | `RLS_DENIED` 에러 |
| 멤버십 확인 | `club_members_select_same_club` (fn_user_in_club) | 빈 결과 (비멤버) |

### 트리거 연동 지점

| 트리거 | 발화 조건 | 클라이언트 관측 |
|--------|----------|----------------|
| `guard_join_request_status_trigger` (BEFORE UPDATE) | terminal 상태 status 재설정 시 RAISE EXCEPTION | REQ-CLUBA-008 — VALIDATION 에러 처리 |
| `join_request_accept_trigger` (AFTER UPDATE, SECURITY DEFINER) | status='accepted' 전환 시 club_members INSERT | REQ-CLUBA-010 ~ 011 — 멤버십 재조회로 확인 |
| `handle_new_club_host` (AFTER INSERT clubs) | clubs INSERT 시 host 자동 가입 | REQ-CLUBA-006 — lazy 그룹 생성 후 host 확인 |

---

## 5. 잔여 작업 (Remaining Work)

### 5.1 Edge Function 완성 (S2-2 ~ S2-4) — COMPLETE (v1.2.0)

**상태 (2026-06-23)**: Edge Function `process-join-request`의 lazy 그룹 생성 + INSERT 로직과
M-1/M-2 보안 요구사항이 모두 구현 완료되었다 (commit 714490c).

**완료된 보안 요구사항**:

**M-1 (COMPLETE) — 인가 검증**:
`process-join-request` Edge Function이 `Authorization` 헤더의 JWT를 검증해 `sub`를 추출하고,
client-supplied `requester_id`를 검증된 값으로 **덮어쓴다**. `verify_jwt=true`는
인증(유효 JWT 보유)만 보장 — 인가(본인 확인)는 애플리케이션 단에서 처리됨. service_role이 RLS를
우회하므로, 이 검증으로 요청자 위조를 차단한다.

**M-2 (COMPLETE) — 입력 검증**:
`target_user_id`가 실제 `user_books_public`에 노출된 공개 독자인지, 이미 활성 group 클럽이
있는지 조회 후 처리한다. 위조 시 임의 독자를 host로 강제 가입시키는 부작용을 방지한다.

**완료된 부수 작업**:
- UNIQUE(23505) → 409 매핑
- lazy 생성 race condition 방어 (DB UNIQUE / idempotency key)
- skeleton `'TODO'` 응답 → 실제 id 교체
- CORS Origin 화이트리스트화

**구현 파일**: `supabase/functions/process-join-request/index.ts`, `logic.ts`

### 5.2 통합 플로우 검증 (Edge Function 완성 후) — PENDING

Edge Function skeleton 한계로 인해, 실제 DB 연동 통합 플로우 테스트는 지연 중이다.
Edge Function 완성 후 다음 시나리오를 로컬 Supabase 실제 RLS 정책으로 검증해야 한다:
- 독자 선택 → 요청 송신 → host 응답 → 멤버십 확인 전체 플로우
- 상태 기계 전환: pending → accepted (트리거 발화, club_members INSERT 확인)
- 상태 기계 전환: pending → declined (멤버 미추가 확인)
- terminal 재설정 거부: accepted → pending 시도 시 RAISE EXCEPTION 확인
- UNIQUE 위반: 동일 (club_id, requester_id) 재요청 시 409 확인
- RLS 격리: 요청자가 타인 요청 조회 불가, host가 아닌 사용자의 status UPDATE 거부

> RLS 정책 자체는 SPEC-DB-001에서 272개 pgTAP 테스트로 검증 완료. 본 SPEC은 클라이언트
> 소비 패턴에 대한 통합 검증만 추가로 수행한다.

### 5.3 알림 연동 (SPEC-NOTIF-001) — DEFERRED

미결정 사항 5.1 해결 후 `join_request_received`(host), `join_accepted`(요청자) 알림 발송 통합.
현재 Edge Function skeleton에 TODO 훅 표기됨.

### 5.4 독자 목록 정렬 기준 A/B 테스트 — DEFERRED

미결정 사항 5.3. MVP는 `started_reading_at` DESC 적용 중. Track A 베타 테스트 후
`current_page` 근접도 대안 검증.

---

## 6. 리스크 및 대응 (실구현 기반 갱신)

### 6.1 리스크: Edge Function 인가/입력 검증 누락 (M-1/M-2) — RESOLVED (v1.2.0)

**리스크**: skeleton 상태에서 service_role이 RLS를 우회하므로, requester_id 위조 및
target_user_id 위조 공격이 가능. 운영 배포 시 보안 침해.

**대응 (완료)**: 잔여 작업 5.1의 M-1/M-2 보안 요구사항이 구현 완료되었다 (commit 714490c).
Edge Function `process-join-request`은 JWT `sub` 검증(M-1)과 `target_user_id` 입력 검증(M-2)을
수행한다. 이제 `processJoinRequestViaEdgeFunction` 경로를 실서비스에서 안전하게 사용할 수 있다.

### 6.2 리스크: 트리거 예외 처리 누봉 — RESOLVED

**리스크**: `guard_join_request_status_trigger`의 RAISE EXCEPTION을 클라이언트가 처리하지 않으면,
사용자가 "승인" 버튼을 반복 누를 때 무의미한 에러가 노출.

**대응 (완료)**: `src/lib/api/errors.ts`의 `getUserFriendlyMessage`에 terminal 키워드 매핑
("이미 처리된 요청입니다") 추가. acceptance.md 시나리오 R8/R12가 이를 검증.

### 6.3 리스크: UNIQUE 위반 시 사용자 경험 — RESOLVED

**리스크**: 동일 그룹 재요청 시 UNIQUE 위반으로 사용자 혼란.

**대응 (완료)**: 23505 → VALIDATION 매핑 → "이미 등록된 항목입니다" 한국어 메시지.
미결정 5.2(거절 재요청)는 UNIQUE 영구 차단으로 MVP 동작.

### 6.4 리스크: service_role 키 클라이언트 노출 — MITIGATED

**리스크**: service_role 키 노출 시 보안 침해.

**대응 (완료)**: Edge Function 환경(`Deno.env`)에서만 사용, 클라이언트 `.env` 미포함.
`invokeEdgeFunction` 래퍼는 클라이언트 측 키를 사용하지 않고 서버 측 service_role을 경유.

---

## 7. 테스트 전략

### 7.1 단위 테스트 (Jest + @testing-library/react-native) [COMPLETE]

- `types.test.ts`: MESSAGE_MAX_LENGTH, validateMessageLength (8 테스트)
- `readersApi.test.ts`: fetchActiveReaders book_id 필터링, resolveClubIdsForUsers 매핑 (11)
- `joinRequestApi.test.ts`: createJoinRequest, respondToJoinRequest, confirmMembership (17)
- `processJoinRequest.test.ts`: Edge Function 래퍼 (4)
- `hooks.test.tsx`: React Query 훅 4종 캐싱/invalidate (11)
- `ReadersScreen.test.tsx`: 빈/로딩/에러 상태, club_id null 표시 (9)
- `JoinRequestSheet.test.tsx`: message 입력, 중복 409 + 에러 처리 (8)
- `HostRequestsScreen.test.tsx`: 승인/거절 + terminal 에러 (6)
- `supabase/functions/process-join-request/__tests__/logic.test.ts`: 순수 로직 (14)

### 7.2 통합 테스트 (Supabase 로컬 개발 환경) [PENDING — 잔여 작업 5.2]

Edge Function 완성 후 수행:
- 상태 기계 전환: pending → accepted (트리거 발화, club_members INSERT 확인)
- 상태 기계 전환: pending → declined (멤버 미추가 확인)
- terminal 재설정 거부: accepted → pending 시도 시 RAISE EXCEPTION 확인
- UNIQUE 위반: 동일 (club_id, requester_id) 재요청 시 409 확인
- RLS 격리: 요청자가 타인 요청 조회 불가, host가 아닌 사용자의 status UPDATE 거부

### 7.3 RLS 검증 (pgTAP 기반)

RLS 정책 자체는 SPEC-DB-001에서 272개 pgTAP 테스트로 검증 완료. 본 SPEC은 클라이언트
소비 패턴에 대한 추가 통합 검증만 수행 (잔여 작업 5.2).

---

## 8. 품질 게이트 (TRUST 5) — 검증 결과

| 항목 | 기준 | 검증 결과 |
|------|------|----------|
| Tested | 85%+ 커버리지 | Statements 93.44%, Branches 80.55%, Functions 92.68%, Lines 95.85% — 789 테스트 PASS |
| Readable | 한국어 주석, 명확한 함수명 | fetchActiveReaders, createJoinRequest 등 — @MX:NOTE 태그 포함 |
| Unified | SPEC-API-001 에러 정규화 재사용 | normalizeError, classifyError, invokeEdgeFunction 재사용 |
| Secured | RLS 신뢰, service_role 미노출 | 클라이언트 키 미사용, Edge Function 환경 격리, M-1(JWT sub 검증)/M-2(입력 검증) 완료 (commit 714490c) |
| Trackable | Conventional commits, SPEC 참조 | feature/SPEC-CLUB-001-trackA 브랜치 — 커밋 SHA는 progress.md |

---

## 9. 다음 단계

1. ~~Edge Function 완성 (잔여 작업 5.1)~~ — COMPLETE (commit 714490c, v1.2.0)
2. 통합 플로우 검증 (잔여 작업 5.2) — Edge Function 완성됨, 로컬 Supabase 실제 RLS 테스트 수행 필요
3. SPEC-NOTIF-001 연동 (잔여 작업 5.3) — 알림 발송 훅 통합
4. 독자 목록 정렬 A/B 테스트 (잔여 작업 5.4) — Track A 베타 테스트 후
5. `/moai sync SPEC-CLUB-001` — 구현 완료 후 문서 동기화 (API 문서, CHANGELOG)
6. SPEC-NAV-001 연동 검증 — readers / host-requests 라우트 진입점(탭/딥링크) 확인
7. SPEC-CLUB-002(Track B 개설형)와 클럽 탭 통합 — `app/(tabs)/clubs.tsx` 콘텐츠 구현
