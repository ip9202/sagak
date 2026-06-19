## Task Decomposition
SPEC: SPEC-CLUB-001 (Track A — 합류형 요청)
development_mode: tdd | mode: solo standard | updated: 2026-06-19

Source: manager-strategy Phase 1 분석 (Decision Points 승인 대기)

### 핵심 설계 원칙

1. **DB 주도 상태 기계 소비**: 클라이언트는 트리거 무결성을 재검증하지 않는다. `guard_join_request_status_trigger`(BEFORE UPDATE)와 `join_request_accept_trigger`(AFTER UPDATE, SECURITY DEFINER)가 단독 보장. 클라이언트는 예외를 `normalizeError`로 변환만 수행.
2. **RLS 단일 신뢰 경계**: 클라이언트 권한 검사 없음. `join_requests_insert_own`, `join_requests_update_host`, `club_members_select_same_club`(`fn_user_in_club`)에 의존.
3. **`user_books_public` 보안 뷰 소비**: 베이스 테이블 `user_books` 직조회 금지 (RLS가 자기 행만 반환).
4. **Edge Function 위임 (lazy 그룹 생성)**: `process-join-request`가 `service_role`로 원자적 lazy 그룹 생성 + 요청 INSERT 수행. 클라이언트는 2단계 트랜잭션 관리 안 함.

### 마일스톤 구조

| 마일스톤 | 범위 | 태스크 |
|-----------|------|--------|
| M1 (데이터 계층) | trackA api + types + Edge Function Deno skeleton | T-001 ~ T-008 |
| M2 (훅 계층) | React Query 훅 (조회 + mutation + invalidate) | T-009 |
| M3 (독자 목록 UI) | ReadersScreen + 빈/로딩/에러 상태 | T-010 |
| M4 (요청 작성 UI) | JoinRequestSheet (message 입력, 중복/에러) | T-011 |
| M5 (host 응답 UI) | HostRequestsScreen (승인/거절 + terminal 에러) | T-012 |

> M0(인프라) 불필요 — QueryClientProvider, client 싱글톤, normalizeError, invokeEdgeFunction가 모두 SPEC-LIBRARY-001/SPEC-API-001에서 완료됨. gen-types(supabase.ts)에 `join_requests`, `club_members`, `clubs`, `user_books_public` 타입 이미 존재 (검증 완료).

### 태스크 분해표

| Task ID | Description | REQ coverage | Dependencies | Planned Files (N/M) | Status |
|---------|-------------|--------------|--------------|---------------------|--------|
| T-001 | trackA 도메인 타입 (JoinRequest, ActiveReader, JoinResponseStatus, JoinResponseAction) | REQ-CLUBA 전제 | - | src/features/club/trackA/types.ts(N) | pending |
| T-002 | fetchActiveReaders(bookId) — `user_books_public` 뷰 소비, started_reading_at DESC 정렬 | REQ-CLUBA-001,002 | T-001 | src/features/club/trackA/api.ts(N), __tests__/api.test.ts(N) | pending |
| T-003 | resolveClubForUser(userId, bookId) — club_id 매핑 (그룹 없으면 null) | REQ-CLUBA-003 | T-001 | api.ts(M), __tests__/api.test.ts(M) | pending |
| T-004 | createJoinRequest(clubId, message?) — INSERT, 23505 UNIQUE→409 VALIDATION 매핑 | REQ-CLUBA-004,005 | T-001 | api.ts(M), __tests__/api.test.ts(M) | pending |
| T-005 | processJoinRequestViaEdgeFunction(targetUserId, bookId, message?) — Edge Function 위임 (lazy 그룹 생성) | REQ-CLUBA-006 | T-001 | api.ts(M), __tests__/api.edge.test.ts(N) | pending |
| T-006 | respondToJoinRequest(requestId, status) — UPDATE, terminal 트리거 예외 VALIDATION 매핑 | REQ-CLUBA-007,008,009 | T-001 | api.ts(M), __tests__/api.test.ts(M) | pending |
| T-007 | confirmMembership(clubId) — club_members 재조회로 트리거 동작 관측 | REQ-CLUBA-010,011,012 | T-001 | api.ts(M), __tests__/api.test.ts(M) | pending |
| T-008 | Edge Function `process-join-request` Deno skeleton (service_role 클라이언트, lazy 그룹 생성, 요청 INSERT) | REQ-CLUBA-006 | T-005 | supabase/functions/process-join-request/{index.ts,deno.json}(N×2) | pending |
| T-009 | trackA 훅: useActiveReaders, useCreateJoinRequest, useRespondToJoinRequest, useConfirmMembership (React Query 캐싱 + invalidate) | REQ-CLUBA 전체 | T-002~T-007 | src/features/club/trackA/hooks.ts(N), __tests__/hooks.test.ts(N) | pending |
| T-010 | ReadersScreen 구현 (독자 목록, SPEC-UI-002 빈/로딩/에러 상태, club_id null 표시) | REQ-CLUBA-001~003 | T-009 | app/(tabs)/club/readers.tsx(N), __tests__/readers.test.tsx(N) | pending |
| T-011 | JoinRequestSheet (bottom sheet/modal, message 입력, 중복 409 + 에러 처리) | REQ-CLUBA-004~006 | T-009 | src/features/club/trackA/components/JoinRequestSheet.tsx(N), __tests__/JoinRequestSheet.test.tsx(N) | pending |
| T-012 | HostRequestsScreen (수신 요청 승인/거절 + terminal "이미 처리된 요청입니다" 에러 처리, 멤버십 확인 표시) | REQ-CLUBA-007~012 | T-009 | app/(tabs)/club/host-requests.tsx(N), __tests__/host-requests.test.tsx(N) | pending |

(N=신규, M=수정)

### 위임 분할 (LIBRARY 패턴 미러링)

- **위임 1 (데이터 계층 + Edge Function)**: T-001 ~ T-008 (M1) — trackA types/api/hooks 미만 + Edge Function Deno skeleton
  - 순수 데이터 계층: DB 뷰 소비, INSERT/UPDATE 래퍼, 에러 정규화 매핑, Edge Function 호출
  - 산출: 타입 안전한 api.ts, hooks.ts 기반, Deno skeleton
  - 검증: tsc 0 에러, jest 커버리지 85%+ (trackA/), RLS 격리 시나리오
- **위임 2 (UI 계층)**: T-009 ~ T-012 (M2~M5) — React Query 훅 + ReadersScreen + JoinRequestSheet + HostRequestsScreen
  - 화면 3종 (SPEC-UI-002 화면 패턴 준수: 3계층 레이아웃, 타이틀 균일성, 카드 밀도, 빈/로딩/에러 상태)
  - 산출: 사용자 대면 화면 3종 + 훅 통합
  - 검증: tsc 0 에러, 컴포넌트 테스트, 통합 플로우(독자 선택→요청→host 응답→멤버십 확인)

### 숨은 의존성 (LIBRARY-style 검증 결과)

1. **QueryClientProvider** — `app/_layout.tsx`에서 SPEC-LIBRARY-001 M0가 부트스트랩 완료 (PR #10, 0198dc5). CLUB은 재사용만, 신규 태스크 불필요.
2. **resolveBookId** — CLUB은 `book_id`(UUID)를 직접 사용. ISBN 매핑 불필요. 다만 ReadersScreen 진입 라우트가 UUID를 전달하는지 확인 (LIBRARY search.tsx 통일 안 준수).
3. **Realtime** — 불필요. SPEC-CLUB-001은 비동기 상태 기계 (Realtime은 SPEC-FEED-001 담당). 명시적 비의존성.
4. **gen-types** — `src/types/supabase.ts`에 `join_requests`(L284), `club_members`(L59), `clubs`(L105), `user_books_public`(L626) 타입 이미 존재 (검증 완료). 추가 실행 불필요.
5. **normalizeError** — 23505(UNIQUE)→VALIDATION, 42501(RLS)→RLS_DENIED 매핑 이미 구현 (`src/lib/api/errors.ts` L174-182). 재사용.
6. **terminal 트리거 예외 매핑 (신규 추가 필요)** — DB `RAISE EXCEPTION`은 PostgREST를 통해 HTTP 400 또는 DB 메시지로 전달. `classifyError`가 `status === 400`→VALIDATION으로 분류하므로 카테고리는 자동 처리. 단, `getUserFriendlyMessage`에 "이미 처리된 요청입니다" 한국어 메시지 매핑 추가 필요 (T-006 부수 산출물, `src/lib/api/errors.ts` 수정).
7. **invokeEdgeFunction** — 멱등성 비재시도 정책으로 이미 구현 (`src/lib/api/edgeFunctions.ts`). `process-join-request`도 이 래퍼 경유. 재시도 필요 시 호출부에서 명시.

### 정책 결정 (Decision Points — 사용자 승인 필요)

> 아래 정책은 spec.md 미결정 사항(5.1~5.4)의 구현 시점 기본값이다. 변경 시 tasks.md 업데이트 후 위임 프롬프트에 반영.

- **5.1 알림 발송 (SPEC-NOTIF-001 연동)**: MVP에서 **stub** (no-op 또는 console.log). `join_request_received`/`join_accepted` 발송 메커니즘은 SPEC-NOTIF-001 구현 시 통합. 계약 경계: T-008 Edge Function은 알림 발송 훅(hook)만 남기고 실제 발송은 TODO 표기.
- **5.2 거절 시 재요청**: MVP에서 **UNIQUE 제약으로 영구 차단** 유지. 쿨다운/soft-delete 미도입. Track A UX 테스트 후 재검토.
- **5.3 독자 목록 정렬 기준**: **started_reading_at DESC** (최근 시작 우선, pages_08 7.2 기준). 추후 A/B 테스트로 current_page 근접도 대안 검증.
- **5.4 lazy 그룹 생성 주체**: **Edge Function 위임** (`process-join-request`, service_role). 원자성 + 향후 알림 트리거 통합 용이. 클라이언트 2단계 접근 불채택.
- **Edge Function Deno 구현 범위**: 본 SPEC에 **Deno skeleton 포함** (T-008). service_role 클라이언트 생성 + lazy 그룹 생성 + join_requests INSERT + 알림 훅 TODO. naver-userinfo-proxy 패턴 참조 (`supabase/functions/naver-userinfo-proxy/`).
- **message 길이 제한 (엣지 E4)**: **500자** 제한. T-004 클라이언트 선검증 + T-008 Edge Function 재검증 (이중 방어).

### 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Edge Function Deno 타이핑 (naver Deno entry 이슈 회상) | T-008 구현 지연 | `deno.json` + `import_map.json` 명시, `naver-userinfo-proxy` 패턴 복제, Deno 표준 라이브러리만 사용 (`Deno.serve`) |
| RLS 테스트 — 모킹 금지 | 잘못된 신뢰 (모킹 통과 후 실제 정책 실패) | 통합 테스트는 로컬 Supabase 실제 RLS 정책으로 수행. pgTAP 자체는 SPEC-DB-001이 담당 (272 테스트). CLUB은 클라이언트 소비 패턴 통합 테스트만 추가. |
| terminal 예외 메시지 매핑 누락 | 사용자가 "승인" 반복 시 무의미한 에러 노출 | T-006에서 `getUserFriendlyMessage`에 "이미 처리된 요청입니다" 매핑 추가 (errors.ts 수정) |
| service_role 키 클라이언트 노출 | 보안 침해 | Edge Function 환경에서만 사용, 클라이언트 `.env` 미포함, Deno `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` |
| PostgREST가 DB 예외를 HTTP 400으로 전달 보장 | terminal 예외가 SERVER로 오분류 | classifyError 우선순위 재확인 (status 400 → VALIDATION). 통합 테스트로 실제 트리거 예외 응답 검증. |

### 파일 수 추정

- 신규: ~17 파일
  - src/features/club/trackA/{types.ts, api.ts, hooks.ts, __tests__/×4} (7)
  - src/features/club/trackA/components/JoinRequestSheet.tsx + __tests__ (2)
  - app/(tabs)/club/{readers.tsx, host-requests.tsx} + __tests__/×2 (4)
  - supabase/functions/process-join-request/{index.ts, deno.json} (2)
  - src/features/club/trackA/index.ts barrel (1)
  - __tests__/JoinRequestSheet.test.tsx (위에 포함)
- 수정: ~2 파일
  - src/lib/api/errors.ts (terminal 메시지 매핑 추가)
  - app/(tabs)/_layout.tsx (club 탭/라우트 추가 — SPEC-NAV-001 연동 시)
- 총: ~19 파일 (LIBRARY의 18 파일과 유사 규모)
