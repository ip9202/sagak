---
id: SPEC-CLUB-001
title: "Track A — 합류형 요청 — Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-001 구현 계획

## 개요

본 문서는 SPEC-CLUB-001(Track A 합류형 요청)의 구현 계획을 정의한다. DB 스키마, 트리거,
RLS 정책은 SPEC-DB-001(v1.2.0)에서 이미 완료되었으므로, 본 계획은 **클라이언트 측 기능 구현**에
집중한다. Edge Function `process-join-request`은 입력/출력 계약만 정의하고, Deno 구현 로직은
별도 작업으로 분리될 수 있다.

> 본 문서는 구현 코드를 포함하지 않는다. 구현 코드는 `/moai run SPEC-CLUB-001` 단계에서
> manager-ddd/tdd 에이전트가 작성한다.

---

## 1. 마일스톤 (우선순위 기반)

### Primary Goal — Track A 핵심 플로우 (요청 → 응답 → 멤버 추가)

| 단계 | 범위 | 관련 REQ | 의존성 |
|------|------|----------|--------|
| P1-1 | 독자 목록 조회 함수 (`fetchActiveReaders`) | REQ-CLUBA-001 ~ 003 | SPEC-LIBRARY-001(user_books_public), SPEC-API-001 |
| P1-2 | 합류 요청 생성 함수 (`createJoinRequest`) | REQ-CLUBA-004 ~ 006 | SPEC-DB-001(join_requests), SPEC-API-001 |
| P1-3 | host 응답 함수 (`respondToJoinRequest`) | REQ-CLUBA-007 ~ 009 | SPEC-DB-001(상태 기계 트리거), SPEC-API-001 |
| P1-4 | 멤버십 확인 함수 (`confirmMembership`) | REQ-CLUBA-010 ~ 012 | SPEC-DB-001(join_request_accept 트리거) |

### Secondary Goal — Edge Function 계약 및 통합

| 단계 | 범위 | 관련 REQ | 의존성 |
|------|------|----------|--------|
| S2-1 | `process-join-request` Edge Function 입력/출력 계약 정의 | REQ-CLUBA-006 | SPEC-DB-001(service_role), pages_08 7.2 |
| S2-2 | 클라이언트-Edge Function 통합 (lazy 그룹 생성 플로우) | REQ-CLUBA-006 | S2-1 |

### Final Goal — UI 화면 및 에러 처리

| 단계 | 범위 | 관련 REQ | 의존성 |
|------|------|----------|--------|
| F3-1 | 독자 목록 화면 (같은 책 독자 리스트) | REQ-CLUBA-001 ~ 003 | P1-1, SPEC-UI-001(BookCard 등 컴포넌트) |
| F3-2 | 요청 작성 화면 (message 입력) | REQ-CLUBA-004 ~ 006 | P1-2 |
| F3-3 | host 요청 관리 화면 (승인/거절) | REQ-CLUBA-007 ~ 009 | P1-3 |
| F3-4 | terminal 상태 에러 처리 (이미 처리된 요청) | REQ-CLUBA-008 | SPEC-API-001(REQ-API-012 VALIDATION) |

### Optional Goal — 알림 연동 (SPEC-NOTIF-001 의존)

| 단계 | 범위 | 관련 REQ | 의존성 |
|------|------|----------|--------|
| O4-1 | `join_request_received` 알림 발송 트리거 | 미결정 5.1 | SPEC-NOTIF-001 |
| O4-2 | `join_accepted` 알림 발송 트리거 | 미결정 5.1 | SPEC-NOTIF-001 |

---

## 2. 기술 접근법 (Technical Approach)

### 2.1 클라이언트 아키텍처

Track A 기능은 `src/features/club/trackA/` 디렉토리에 배치된다 (INDEX.md 구현 산출물 기준).
SPEC-UI-001의 디자인 토큰과 6개 컴포넌트를 재사용한다.

**모듈 구조 (예정)**:
- `src/features/club/trackA/api.ts` — Supabase 쿼리 함수 (fetchActiveReaders, createJoinRequest,
  respondToJoinRequest, confirmMembership)
- `src/features/club/trackA/hooks.ts` — React 훅 (useActiveReaders, useJoinRequest, useJoinResponse)
- `src/features/club/trackA/types.ts` — Track A 도메인 타입 (JoinRequest, ActiveReader 등)
- 화면 컴포넌트는 `app/(tabs)/club/` 또는 별도 라우트 그룹에 배치 (SPEC-NAV-001 연동)

### 2.2 데이터 페칭 전략

SPEC-API-001 미결정 사항 6.1(React Query vs SWR vs 순수 훅)이 해결되기 전까지, 본 SPEC은
순수 React 훅(`useEffect` + `useState`)을 기본으로 한다. 데이터 페칭 라이브러리 확정 시
해당 패턴으로 마이그레이션한다.

### 2.3 상태 기계 소비 패턴

클라이언트는 DB 트리거를 "신뢰"하며, 상태 전환 무결성을 클라이언트 측에서 재검증하지 않는다.
대신, 트리거가 발생시키는 예외(terminal 상태 재설정, UNIQUE 위반)를 에러 정규화
(SPEC-API-001 REQ-API-011 ~ 014)를 통해 사용자 친화적 메시지로 변환한다.

**핵심 원칙**: 클라이언트는 `club_members`를 직접 INSERT하지 않는다. `accepted` 전환 후
`club_members`를 재조회하여 트리거 동작을 관측한다 (REQ-CLUBA-011).

### 2.4 Edge Function 계약 (process-join-request)

**입력**:
```
POST /functions/v1/process-join-request
Authorization: Bearer <jwt>  (요청자 세션)
{
  "target_user_id": "uuid",   // 합류 대상 독자
  "book_id": "uuid",          // 책 컨텍스트
  "message": "같이 읽어요!"   // 선택적 메시지
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

**출력 (409)**: 중복 요청 (UNIQUE 위반)
**출력 (403)**: 권한 부족 (RLS 거부)

> Edge Function은 `service_role` 키로 실행되어 RLS를 우회한다. lazy 그룹 생성 시
> `handle_new_club_host` 트리거가 대상 독자를 host로 자동 가입시킨다 (REQ-DB-008b).

---

## 3. 아키텍처 설계 방향

### 3.1 RLS 신뢰 경계

본 SPEC은 RLS를 데이터 보호의 단일 진실 원천으로 신뢰한다. 클라이언트 측 권한 검사는
수행하지 않으며, RLS 거부 시 에러 정규화(`RLS_DENIED` 카테고리)로 처리한다.

| 작업 | RLS 정책 | 실패 시 처리 |
|------|----------|-------------|
| 독자 목록 조회 | `user_books_public` 뷰 (authenticated GRANT) | 빈 결과 반환 |
| 요청 생성 | `join_requests_insert_own` (auth.uid()=requester_id) | `RLS_DENIED` 에러 |
| host 응답 | `join_requests_update_host` (auth.uid()=club.host_id) | `RLS_DENIED` 에러 |
| 멤버십 확인 | `club_members_select_same_club` (fn_user_in_club) | 빈 결과 (비멤버) |

### 3.2 보안 뷰 소비 패턴

`user_books_public` 뷰는 `security_invoker = false`(기본값)로 정의되어 뷰 소유자 권한으로
실행된다. 클라이언트는 이 뷰를 직접 SELECT하여 타인의 공개 서재 정보(제한 컬럼)에 접근한다.
베이스 테이블 `user_books`를 직접 조회하면 RLS가 자기 행만 반환하므로 타인 독자가 보이지 않는다.

### 3.3 트리거 연동 지점

| 트리거 | 발화 조건 | 클라이언트 관측 |
|--------|----------|----------------|
| `guard_join_request_status_trigger` (BEFORE UPDATE) | terminal 상태 status 재설정 시 RAISE EXCEPTION | REQ-CLUBA-008 — VALIDATION 에러 처리 |
| `join_request_accept_trigger` (AFTER UPDATE) | status='accepted' 전환 시 club_members INSERT | REQ-CLUBA-010 ~ 011 — 멤버십 재조회로 확인 |
| `handle_new_club_host` (AFTER INSERT clubs) | clubs INSERT 시 host 자동 가입 | REQ-CLUBA-006 — lazy 그룹 생성 후 host 확인 |

---

## 4. 리스크 및 대응 계획

### 4.1 리스크: 트리거 예외 처리 누락

**리스크**: `guard_join_request_status_trigger`의 RAISE EXCEPTION을 클라이언트가 처리하지 않으면,
사용자가 "승인" 버튼을 반복 누를 때 무의미한 에러가 노출된다.

**대응**: REQ-CLUBA-008이 이 시나리오를 명시적으로 처리한다. 에러 정규화는 트리거 예외를
`VALIDATION` 카테고리로 분류하고, "이미 처리된 요청입니다" 한국어 메시지를 반환한다.
acceptance.md 시나리오 R8이 이를 검증한다.

### 4.2 리스크: lazy 그룹 생성 실패

**리스크**: Edge Function `process-join-request`이 lazy 그룹 생성에 실패하면, 요청자의 요청이
유실되거나 불완전 상태가 될 수 있다.

**대응**: Edge Function은 원자적 트랜잭션으로 lazy 생성 + 요청 INSERT를 수행해야 한다.
실패 시 500 에러를 반환하고, 클라이언트는 재시도 로직(SPEC-API-001 REQ-API-013)을 적용한다.
단, `VALIDATION`/`RLS_DENIED` 에러는 재시도하지 않는다.

### 4.3 리스크: UNIQUE 위반 시 사용자 경험

**리스크**: 동일 그룹에 재요청 시 UNIQUE 위반이 발생하며, 사용자가 "왜 요청이 안 되나요?"라고
혼란을 겪을 수 있다.

**대응**: REQ-CLUBA-005가 409 Conflict를 "이미 이 그룹에 요청을 보냈습니다" 메시지로 변환한다.
추가로, 독자 목록 화면에서 이미 요청한 독자에게는 "요청 대기 중" 배지를 표시하는 UX를
고려한다 (Secondary Goal 이후).

### 4.4 리스크: 독자 목록 정렬 기준 미확정

**리스크**: 미결정 사항 5.3(정렬 기준)이 해결되기 전까지, 독자 목록의 순서가 일관되지 않을 수 있다.

**대응**: MVP에서는 `started_reading_at` DESC(최근 시작 우선)를 기본으로 한다(pages_08 7.2 기준).
정렬 기준 확정 후 클라이언트 측 정렬 로직을 업데이트한다.

---

## 5. 테스트 전략

### 5.1 단위 테스트 (Jest + @testing-library/react-native)

- `fetchActiveReaders`: book_id 필터링, 제한 컬럼 반환 검증
- `createJoinRequest`: status='pending' 초기 상태, RLS WITH CHECK 검증
- `respondToJoinRequest`: host 권한, terminal 상태 예외 처리
- `confirmMembership`: accepted 후 club_members 존재 검증

### 5.2 통합 테스트 (Supabase 로컬 개발 환경)

- 상태 기계 전환: pending → accepted (트리거 발화, club_members INSERT 확인)
- 상태 기계 전환: pending → declined (멤버 미추가 확인)
- terminal 재설정 거부: accepted → pending 시도 시 RAISE EXCEPTION 확인
- UNIQUE 위반: 동일 (club_id, requester_id) 재요청 시 409 확인
- RLS 격리: 요청자가 타인 요청 조회 불가, host가 아닌 사용자의 status UPDATE 거부

### 5.3 RLS 검증 (pgTAP 기반, SPEC-DB-001 패턴 준수)

- `join_requests_select_requester_or_host`: 요청자 본인 + host만 조회
- `join_requests_insert_own`: 요청자 본인만 INSERT
- `join_requests_update_host`: host만 status UPDATE
- `club_members_select_same_club`: fn_user_in_club 재귀 차단 검증

> RLS 정책 자체는 SPEC-DB-001에서 이미 272개 pgTAP 테스트로 검증 완료. 본 SPEC은 클라이언트
> 소비 패턴에 대한 추가 검증을 수행한다.

---

## 6. 품질 게이트 (TRUST 5)

| 항목 | 기준 | 검증 방법 |
|------|------|----------|
| Tested | 85%+ 커버리지, 상태 기계 시나리오 전수 | Jest 커버리지 리포트, pgTAP 트리거 테스트 |
| Readable | 한국어 주석, 명확한 함수명 (fetchActiveReaders 등) | 코드 리뷰, SPEC-UI-001 패턴 준수 |
| Unified | SPEC-API-001 에러 정규화 패턴 재사용 | 기존 `normalizeError` 함수 사용 |
| Secured | RLS 신뢰, service_role 키 클라이언트 미노출 | 환경 변수 검증, RLS 정책 의존 |
| Trackable | Conventional commits, SPEC-CLUB-001 참조 | `feature/SPEC-CLUB-001-track-a` 브랜치 |

---

## 7. 다음 단계

1. 본 SPEC 문서(spec.md, plan.md, acceptance.md) 사용자 승인
2. `/moai run SPEC-CLUB-001` 실행 — manager-ddd/tdd가 구현
3. 구현 완료 후 `/moai sync SPEC-CLUB-001` — manager-docs가 문서 동기화
4. Track A 화면 통합 후 SPEC-NAV-001(네비게이션) 연동 검증
5. SPEC-CLUB-002(Track B) 구현 시 상태 기계 패턴 재사용
