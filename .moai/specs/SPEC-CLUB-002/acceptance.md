---
id: SPEC-CLUB-002
title: "Track B 개설형 모임 관리 — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-CLUB-002 인수 기준

## 개요

본 문서는 SPEC-CLUB-002 요구사항(REQ-CLUBB-001 ~ REQ-CLUBB-017)의 인수 기준을
Given-When-Then(Gherkin) 형식으로 정의한다. 각 시나리오는 관찰 가능한 증거(테스트 출력,
DB 행 존재, RLS 동작, API 응답)를 기반으로 검증 가능해야 한다.

---

## Module 1: REQ-CLUBB-CREATE — 함께 읽기 모임 생성

### 시나리오 S1: 모임 생성 성공

**Given** 인증된 사용자가 유효한 `book_id`와 `title`을 보유한다
**When** `createClubApi.createClub({ book_id, title, type: 'group', description, ... })`를 호출한다
**Then** `supabase.from('clubs').insert({...}).select().single()`이 실행되어야 한다
**And** INSERT 본문의 `host_id`가 `auth.uid()`와 일치해야 한다
**And** HTTP 201(또는 PostgREST 성공) 응답과 생성된 `clubs` 행 객체가 반환되어야 한다
**And** 반환된 행의 `status`가 `'active'`이고 `type`이 `'group'`이어야 한다

**검증 방법**: 통합 테스트 — PostgREST INSERT 모킹, 반환 행 스키마 검증

### 시나리오 S2: type='group' 강제

**Given** 사용자가 모임 생성 폼에서 모임 유형을 선택한다
**When** `createClub` 함수가 호출된다
**Then** INSERT 본문의 `type` 값이 반드시 `'group'`이어야 한다
**And** `type='instant'`가 전달되는 경우 클라이언트 검증 단에서 거부되어야 한다

**검증 방법**: 단위 테스트 — `type='instant'` 입력 시 에러 발생 검증

### 시나리오 S3: type 누락 시 INSERT 실패

**Given** 모임 생성 요청에서 `type` 값이 누락되었다
**When** `clubs` INSERT가 실행된다
**Then** NOT NULL 제약 위반으로 INSERT가 실패해야 한다
**And** 클라이언트에 "모임 유형은 필수입니다" 에러 메시지가 표시되어야 한다

**검증 방법**: 통합 테스트 — `type` 누락 INSERT 시 PostgREST 에러 검증

### 시나리오 S4: 0명 출발 허용 (min_members 게이트 아님)

**Given** 모임 생성 요청에서 `min_members`가 0이거나 NULL이다
**When** `clubs` INSERT가 실행된다
**Then** 모임 생성이 성공해야 한다 (min_members 게이트 동작 없음)
**And** 반환된 `clubs` 행의 `status`가 `'active'`이어야 한다
**And** host 1명으로 모임이 즉시 활성화되어야 한다

**검증 방법**: 통합 테스트 — `min_members: 0` 또는 누락 시 INSERT 성공 검증

### 시나리오 S5: 모임 설정 입력 수집

**Given** 사용자가 모임 생성 폼에서 설정 값을 입력한다
**When** `createClub` 함수가 호출된다
**Then** 다음 값들이 선택적으로 INSERT 본문에 포함되어야 한다:
`description`, `duration_days`, `daily_pages`, `trigger_page`
**And** 값이 누락된 필드는 NULL로 저장되어야 한다 (REQ-DB-006)

**검증 방법**: 단위 테스트 — 다양한 설정 조합의 INSERT 본문 검증

### 시나리오 S6: 모임 생성 결과 반환

**Given** `clubs` INSERT가 성공했다
**When** `.select().single()` 응답이 처리된다
**Then** 생성된 `clubs` 행의 전체 객체가 반환되어야 한다
**And** 반환된 객체에 `id`(UUID), `host_id`, `book_id`, `type`, `title`, `status`, `started_at`이 포함되어야 한다
**And** 반환된 `id`는 후속 모임 관리 화면 라우팅에 사용 가능해야 한다

**검증 방법**: 통합 테스트 — 반환 객체 필드 검증

### 시나리오 S7: book_id 누락 시 INSERT 실패 (엣지 케이스)

**Given** 모임 생성 요청에서 `book_id`가 누락되었다
**When** `clubs` INSERT가 실행된다
**Then** NOT NULL 제약 위반으로 INSERT가 실패해야 한다
**And** 사용자에게 "책을 선택해 주세요" 메시지가 표시되어야 한다

**검증 방법**: 통합 테스트 — `book_id` 누락 INSERT 시 에러 검증

---

## Module 2: REQ-CLUBB-HOST — host 자동 가입 트리거 연동

### 시나리오 S8: 클라이언트 club_members INSERT 금지

**Given** 인증된 사용자가 모임을 생성했다
**When** 클라이언트가 `supabase.from('club_members').insert({...})`를 직접 호출한다
**Then** RLS 정책(REQ-DB-019 — 클라이언트 INSERT 정책 없음)에 의해 INSERT가 거부되어야 한다
**And** 클라이언트 코드는 `club_members` INSERT를 수행하지 않아야 한다 (트리거 단독 처리)

**검증 방법**: 통합 테스트 — 클라이언트 INSERT 시도 시 RLS 거부 검증,
코드 정적 분석으로 `club_members().insert` 호출 부재 확인

### 시나리오 S9: host 멤버십 자동 생성 (트리거 동작)

**Given** `handle_new_club_host` 트리거가 배포되어 있다 (SPEC-DB-001 REQ-DB-008b)
**When** `clubs` INSERT가 성공적으로 커밋된다
**Then** 동일 트랜잭션에서 `club_members`에 `(club_id=새 모임 id, user_id=host_id, role='host')` 행이 자동 생성되어야 한다
**And** 트리거는 SECURITY DEFINER 함수로 RLS를 우회하여 INSERT를 수행해야 한다

**검증 방법**: 통합 테스트 — `clubs` INSERT 후 `club_members` SELECT로 host 행 존재 검증

### 시나리오 S10: host 멤버십 존재 확인

**Given** `clubs` INSERT가 성공했다
**When** `hostMembershipApi.verifyHostMembership(newClubId)`를 호출한다
**Then** `supabase.from('club_members').select().eq('club_id', newClubId).eq('user_id', auth.uid()).eq('role', 'host').maybeSingle()`이 실행되어야 한다
**And** host 멤버십 행이 존재하면 `true`를 반환해야 한다 (트리거 정상 동작)

**검증 방법**: 단위 테스트 — PostgREST 응답 모킹, 반환 값 검증

### 시나리오 S11: host 멤버십 부재 시 트리거 실패 감지

**Given** `clubs` INSERT가 성공했으나 트리거가 동작하지 않았다 (미배포 등)
**When** `verifyHostMembership`을 호출한다
**Then** host 멤버십 행이 존재하지 않으므로 `false`를 반환해야 한다
**And** 사용자에게 "모임 생성 중 오류가 발생했습니다" 메시지가 표시되어야 한다

**검증 방법**: 단위 테스트 — 빈 응답 모킹, false 반환 및 에러 메시지 검증

### 시나리오 S12: host 멤버십 조회 권한 (RLS)

**Given** host가 자신이 생성한 모임의 멤버십을 조회한다
**When** `club_members` SELECT를 수행한다
**Then** RLS 정책(REQ-DB-019 — `fn_user_in_club(club_id)`)에 의해 host 본인의 행이 조회되어야 한다
**And** host가 속한 모임이므로 `fn_user_in_club`이 true를 반환하여 행이 노출되어야 한다

**검증 방법**: 통합 테스트 — RLS 활성 상태에서 host 멤버십 조회 성공 검증

---

## Module 3: REQ-CLUBB-PROGRESS — 진도 동기화

### 시나리오 S13: 진도 업데이트 성공 (host)

**Given** host가 자신이 생성한 모임의 진도를 업데이트한다
**When** `progressApi.updateProgress(clubId, { daily_pages: 30, trigger_page: 100 })`를 호출한다
**Then** `supabase.from('clubs').update({ daily_pages, trigger_page }).eq('id', clubId)`이 실행되어야 한다
**And** RLS UPDATE 정책(REQ-DB-018: `auth.uid() = host_id`)에 의해 UPDATE가 허용되어야 한다
**And** 업데이트된 행이 반환되어야 한다

**검증 방법**: 통합 테스트 — host UPDATE 성공 검증

### 시나리오 S14: 비host 진도 업데이트 차단

**Given** host가 아닌 모임 멤버가 진도 업데이트를 시도한다
**When** `updateProgress`를 호출한다
**Then** RLS UPDATE 정책(REQ-DB-018: `auth.uid() = host_id`)에 의해 UPDATE가 거부되어야 한다 (0 rows)
**And** 클라이언트는 SPEC-API-001 에러 처리를 통해 "모임 진도는 호스트만 변경할 수 있습니다" 메시지를 표시해야 한다

**검증 방법**: 통합 테스트 — 비host UPDATE 시 0 rows 반환 검증

### 시나리오 S15: 진도 업데이트 입력 검증

**Given** host가 진도 업데이트 폼에서 값을 입력한다
**When** `daily_pages` 또는 `trigger_page`에 음수 또는 비정수를 입력한다
**Then** 클라이언트 단에서 입력이 차단되어야 한다
**And** "0 이상의 정수를 입력해 주세요" 메시지가 표시되어야 한다
**And** PostgREST UPDATE가 호출되지 않아야 한다

**검증 방법**: 단위 테스트 — 음수/비정수 입력 시 에러 발생 검증

### 시나리오 S16: closed 모임 진도 업데이트 차단

**Given** 모임 `status='closed'`인 상태이다
**When** host가 진도 업데이트를 시도한다
**Then** 클라이언트가 업데이트를 사전 차단해야 한다 (status 확인 후)
**And** "종료된 모임은 진도를 변경할 수 없습니다" 메시지가 표시되어야 한다

**검증 방법**: 단위 테스트 — `status='closed'` 모임의 updateProgress 호출 시 에러 검증

---

## Module 4: REQ-CLUBB-MANAGE — 참가자·상태 관리

### 시나리오 S17: 모임 멤버 목록 조회

**Given** host가 모임 관리 화면에 진입한다
**When** `manageClubApi.getClubMembers(clubId)`를 호출한다
**Then** `supabase.from('club_members').select('*, users(...)').eq('club_id', clubId)`이 실행되어야 한다
**And** RLS 정책(REQ-DB-019 — `fn_user_in_club(club_id)`)에 의해 해당 모임의 모든 멤버 행이 반환되어야 한다
**And** 반환된 행에 host(role='host')와 일반 멤버(role='member')가 모두 포함되어야 한다

**검증 방법**: 통합 테스트 — 멤버 목록 반환 검증

### 시나리오 S18: 모임 종료 (active → closed)

**Given** host가 활성 모임(status='active')을 종료하려 한다
**When** `manageClubApi.closeClub(clubId)`를 호출한다
**Then** `supabase.from('clubs').update({ status: 'closed' }).eq('id', clubId)`이 실행되어야 한다
**And** RLS UPDATE 정책(REQ-DB-018)에 의해 host만 수행할 수 있어야 한다
**And** 업데이트된 행의 `status`가 `'closed'`이어야 한다

**검증 방법**: 통합 테스트 — status 전환 검증

### 시나리오 S19: 모임 재활성화 (closed → active)

**Given** host가 종료된 모임(status='closed')을 다시 활성화하려 한다
**When** `manageClubApi.reactivateClub(clubId)`를 호출한다
**Then** `supabase.from('clubs').update({ status: 'active' }).eq('id', clubId)`이 실행되어야 한다
**And** status ENUM이 양방향 전환을 허용하므로 UPDATE가 성공해야 한다 (REQ-DB-006)
**And** 업데이트된 행의 `status`가 `'active'`이어야 한다

**검증 방법**: 통합 테스트 — closed → active 전환 검증

### 시나리오 S20: 멤버 자발적 탈퇴

**Given** 모임 멤버(host 또는 member)가 자발적 탈퇴를 요청한다
**When** `manageClubApi.leaveClub(clubId)`를 호출한다
**Then** `supabase.from('club_members').delete().eq('club_id', clubId).eq('user_id', auth.uid())`이 실행되어야 한다
**And** RLS DELETE 정책(REQ-DB-019: `auth.uid() = user_id`)에 의해 본인 멤버십만 삭제되어야 한다

**검증 방법**: 통합 테스트 — 본인 멤버십 DELETE 성공 검증

### 시나리오 S21: host 고아 모임 경고 (엣지 케이스)

**Given** host가 유일한 멤버인 모임에서 탈퇴를 시도한다
**When** `leaveClub` 호출 전 시스템이 멤버 수를 확인한다
**Then** host에게 "호스트가 탈퇴하면 모임을 관리할 수 없습니다. 모임을 종료하시겠습니까?" 경고가 표시되어야 한다
**And** 사용자가 모임 종료를 선택하면 `closeClub`이 먼저 호출되어야 한다
**And** 사용자가 탈퇴를 강행하면 고아 모임이 됨을 명시적으로 확인해야 한다

**검증 방법**: 컴포넌트 테스트 — 경고 메시지 표시 및 분기 처리 검증

### 시나리오 S22: 모임 상세 조회

**Given** 인증된 사용자가 모임 상세를 요청한다
**When** `manageClubApi.getClubDetail(clubId)`를 호출한다
**Then** `supabase.from('clubs').select('*, books(...), club_members(...)').eq('id', clubId).single()`이 실행되어야 한다
**And** RLS 정책(REQ-DB-018 — authenticated SELECT `USING(true)`)에 의해 모든 사용자가 조회할 수 있어야 한다
**And** 반환된 객체에 모임 정보와 연관된 책·멤버가 포함되어야 한다

**검증 방법**: 통합 테스트 — 상세 조회 반환 스키마 검증

### 시나리오 S23: 비host 모임 종료 차단 (엣지 케이스)

**Given** host가 아닌 모임 멤버가 모임 종료를 시도한다
**When** `closeClub`을 호출한다
**Then** RLS UPDATE 정책(REQ-DB-018: `auth.uid() = host_id`)에 의해 UPDATE가 거부되어야 한다 (0 rows)
**And** "모임 종료는 호스트만 할 수 있습니다" 메시지가 표시되어야 한다

**검증 방법**: 통합 테스트 — 비host UPDATE 시 0 rows 검증

---

## 엣지 케이스 요약

| 시나리오 | 엣지 케이스 | 기대 동작 |
|---------|-----------|-----------|
| S3 | type 누락 | NOT NULL 제약 실패, INSERT 거부 |
| S4 | min_members=0 | 0명 출발 허용, 게이트 동작 없음 |
| S7 | book_id 누락 | NOT NULL 제약 실패, INSERT 거부 |
| S8 | 클라이언트 club_members INSERT | RLS 거부 (트리거 단독 처리) |
| S11 | 트리거 미배포 | host 멤버십 부재, 오류 메시지 |
| S16 | closed 모임 진도 업데이트 | 클라이언트 사전 차단 |
| S21 | host 유일 멤버 탈퇴 | 고아 모임 경고, 종료 유도 |
| S23 | 비host 모임 종료 | RLS 거부 (0 rows) |

---

## 품질 게이트 (Definition of Done)

본 SPEC의 인수 기준 충족 여부는 다음 기준으로 판정한다:

- **기능 완성도**: S1~S23 모든 시나리오 통과 (23/23)
- **테스트 커버리지**: `src/features/club/trackB/` 커버리지 85% 이상
- **SPEC-DB-001 정합성**: host 자동 가입 트리거(S9), RLS 권한(S12, S14, S23) 검증 통과
- **TRUST 5**: Tested, Readable, Unified, Secured, Trackable 5차원 모두 통과
- **0명 출발 정책**: S4(min_members=0) 통과로 0명 출발 검증
- **type='group' 강제**: S2, S3 통과로 instant 거부 검증

---

## 검증 도구

| 시나리오 범주 | 검증 도구 |
|--------------|----------|
| 클라이언트 API 함수 | Jest 단위 테스트 + `supabase` 모킹 |
| RLS 정책 동작 | Supabase 로컬 개발 환경(`supabase start`) + pgTAP 테스트 (SPEC-DB-001 패턴) |
| 트리거 연동 | 통합 테스트 — `clubs` INSERT 후 `club_members` 행 존재 확인 |
| 화면 컴포넌트 | `@testing-library/react-native` 컴포넌트 테스트 |
| 통합 플로우 | 통합 테스트 (생성 → host 가입 확인 → 진도 동기화 → 상태 관리) |
| RLS 거부 에러 | PostgREST 0 rows 응답 모킹, SPEC-API-001 에러 처리 연동 검증 |
