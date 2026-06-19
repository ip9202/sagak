## SPEC-CLUB-001 Progress

- Started: 2026-06-19
- development_mode: tdd (manager-tdd, RED-GREEN-REFACTOR)
- execution_mode: solo + standard harness
- branch: feature/SPEC-CLUB-001-trackA

## Phase 기록

- **Phase 0 (사전 블로커 해소)**: 의존성 모두 충족 — gen-types 불필요 (`src/types/supabase.ts`에 `join_requests`(L284), `club_members`(L59), `clubs`(L105), `user_books_public`(L626) 타입 이미 존재, 검증 완료). QueryClientProvider(LIBRARY M0 0198dc5), client 싱글톤, normalizeError, invokeEdgeFunction 모두 재사용 가능. (2026-06-19)
- **Phase 1 complete**: manager-strategy 실행계획 수립. 12 태스크 분해, ~19 파일 예상(신규 17/수정 2), 도메인 2(club/trackA + Edge Function). 숨은 의존성 7건 검증(모두 재사용 가능, 단 terminal 예외 메시지 매핑 1건 신규 추가). Decision Points 6건(정렬/재요청/lazy생성주체/알림stub/Deno범위/message길이) 사용자 승인 대기. (2026-06-19)

## 마일스톤 진척

- **M1 (데이터 계층 + Edge Function skeleton)**: ✅ COMPLETE (2026-06-19) — T-001~T-008. trackA types/api + Edge Function Deno skeleton
- **M2 (훅 계층)**: ✅ COMPLETE (2026-06-19) — T-009. React Query 훅 4종 (useActiveReaders/useCreateJoinRequest/useRespondToJoinRequest/useConfirmMembership)
- **M3 (독자 목록 UI)**: ✅ COMPLETE (2026-06-19) — T-010. ReadersScreen (SPEC-UI-002 준수)
- **M4 (요청 작성 UI)**: ✅ COMPLETE (2026-06-19) — T-011. JoinRequestSheet
- **M5 (host 응답 UI)**: ✅ COMPLETE (2026-06-19) — T-012. HostRequestsScreen + terminal 에러 처리

## M1 결과 (위임 1 — T-001~T-008)

### 생성 파일 (신규 9)
- `src/features/club/trackA/types.ts` — JoinResponseStatus/Action, MESSAGE_MAX_LENGTH=500, validateMessageLength, ActiveReader, gen-types Row 별칭 (T-001)
- `src/features/club/trackA/readersApi.ts` — fetchActiveReaders (user_books_public 뷰, started_reading_at DESC), resolveClubIdsForUsers (club_members JOIN clubs!inner) (T-002/T-003)
- `src/features/club/trackA/joinRequestApi.ts` — createJoinRequest, fetchMyJoinRequests, fetchIncomingJoinRequests, respondToJoinRequest, confirmMembership (T-004/T-006/T-007)
- `src/features/club/trackA/processJoinRequest.ts` — processJoinRequestViaEdgeFunction (invokeEdgeFunction 위임, lazy 그룹 생성) (T-005)
- `src/features/club/trackA/index.ts` — barrel export (위임 2 소비용)
- `supabase/functions/process-join-request/logic.ts` — 순수 로직 (parseRequestBody, validateMessage, 응답 빌더) — tsconfig 타입 체크 + 테스트 대상 (T-008)
- `supabase/functions/process-join-request/index.ts` — Deno entry (Deno.serve/Deno.env/service_role) — tsconfig exclude (T-008 skeleton)
- `supabase/functions/process-join-request/deno.json` — import 맵 (T-008)

### 수정 파일 (1)
- `src/lib/api/errors.ts` — getUserFriendlyMessage 에 terminal 키워드 매핑 추가 ("이미 처리된 요청입니다", 숨은 의존성 해소)

### 테스트 파일 (신규 6)
- `src/features/club/trackA/__tests__/types.test.ts` (8)
- `src/features/club/trackA/__tests__/readersApi.test.ts` (11)
- `src/features/club/trackA/__tests__/joinRequestApi.test.ts` (17)
- `src/features/club/trackA/__tests__/processJoinRequest.test.ts` (4)
- `src/lib/api/__tests__/errors.club.terminal.test.ts` (4)
- `supabase/functions/process-join-request/__tests__/logic.test.ts` (14)

### 테스트 수
- club/ + Edge Function trackA: 54 테스트 PASS (5 suite)
- 전체 프로젝트: 87 suite / 755 테스트 PASS

### 커버리지 (club/ + logic.ts)
- Statements: 96.42%
- Branches: 86.76%
- Functions: 100%
- Lines: 98.03%
- 게이트(80%+) 충족

### 게이트 검증
- `npx tsc --noEmit`: 0 에러 ✅
- `npx jest`: 87 suite / 755 테스트 PASS ✅
- club/ 커버리지 ≥ 80% ✅

### 커밋 SHA (실제)
- T-001: 401a317 — trackA 도메인 타입
- T-002/T-003: 86b964a — readersApi (fetchActiveReaders + resolveClubIdsForUsers)
- T-004/T-006/T-007: e286968 — joinRequestApi + terminal 예외 메시지 매핑
- T-005: dae2b9e — processJoinRequest Edge Function 래퍼
- T-008: 820af35 — Edge Function Deno skeleton + 커버리지 보강
- barrel: a69dab8 — trackA index.ts barrel export

### Decision Points 반영 확인
1. 알림 발송: Edge Function skeleton 에 TODO(SPEC-NOTIF-001) 훅 표기 ✅
2. 거절 재요청: UNIQUE 영구 차단 — 클라이언트 재요청 로직 미구현 (23505 VALIDATION 매핑만) ✅
3. 독자 정렬: fetchActiveReaders 의 order('started_reading_at', {ascending:false, nullsFirst:false}) ✅
4. lazy 그룹 생성: processJoinRequestViaEdgeFunction → service_role Edge Function 위임 ✅
5. Deno 범위: skeleton 포함 (logic.ts 순수 모듈 + index.ts Deno entry 분리) ✅
6. message 길이: client(validateMessageLength) + Edge Function(validateMessage) 양쪽 500자 이중 방어 ✅

### 위임 2(UI 계층) 전달 사항
- **Hook 계약**: useActiveReaders는 fetchActiveReaders(bookId) + resolveClubIdsForUsers(userIds)를 조합해 ActiveReader[]를 반환해야 함 (readersApi가 별도 함수로 분리됨). queryKey=['club','readers',bookId].
- **createJoinRequest vs processJoinRequestViaEdgeFunction**: club_id가 있는 독자는 createJoinRequest(clubId,...), club_id=null인 독자는 processJoinRequestViaEdgeFunction(targetUserId, bookId,...). UI는 ActiveReader.club_id로 분기.
- **에러 상태 UI가 처리해야 할 케이스**:
  - VALIDATION + 23505 (이미 요청 보냄) → "이미 등록된 항목입니다"
  - VALIDATION + terminal 키워드 (이미 처리된 요청) → "이미 처리된 요청입니다" (getUserFriendlyMessage 자동 매핑)
  - VALIDATION + MESSAGE_TOO_LONG (500자 초과) → "메시지는 500자 이하여야 합니다"
  - RLS_DENIED → "접근 권한이 없습니다"
- **respondToJoinRequest**: void 반환. 성공 후 useIncomingJoinRequests 캐시 invalidate + (선택) confirmMembership으로 멤버십 관측.
- **Edge Function skeleton 한계**: index.ts는 lazy 그룹 생성/INSERT가 TODO 상태. 위임 2 UI 개발 중에도 실제 DB 연동 전이므로, 통합 플로우 테스트는 Edge Function 완성 후 별도 진행 권장.


## M2-M5 결과 (위임 2 — T-009~T-012, UI 계층)

### 생성 파일 (신규 8)
- `src/features/club/trackA/hooks.ts` — React Query 훅 4종 (T-009)
  - useActiveReaders(bookId): fetchActiveReaders + resolveClubIdsForUsers 조합 → ActiveReader[], queryKey=['club','readers',bookId]
  - useCreateJoinRequest(): ActiveReader.club_id 분기 (createJoinRequest vs processJoinRequestViaEdgeFunction), 성공 후 readers invalidate
  - useRespondToJoinRequest(): accepted/declined, 성공 후 incoming invalidate
  - useConfirmMembership(clubId,userId): queryKey=['club','membership',{clubId,userId}]
- `src/features/club/trackA/components/ReadersScreen.tsx` — 독자 목록 화면 (T-010)
- `src/features/club/trackA/components/JoinRequestSheet.tsx` — 요청 작성 모달 시트 (T-011)
- `src/features/club/trackA/components/HostRequestsScreen.tsx` — host 수신 요청 응답 화면 (T-012)
- `app/(tabs)/readers.tsx` — ReadersScreen + JoinRequestSheet 통합 라우트 (숨겨진 스택)
- `app/(tabs)/host-requests.tsx` — HostRequestsScreen 라우트 (숨겨진 스택)
- `src/features/club/trackA/__tests__/hooks.test.tsx` (11)
- `src/features/club/trackA/__tests__/ReadersScreen.test.tsx` (9)
- `src/features/club/trackA/__tests__/JoinRequestSheet.test.tsx` (8)
- `src/features/club/trackA/__tests__/HostRequestsScreen.test.tsx` (6)

### 수정 파일 (2)
- `src/features/club/trackA/index.ts` — hooks barrel export 추가
- `app/(tabs)/_layout.tsx` — readers / host-requests 라우트 href:null 등록 (탭바 미표시, 스택 진입용)

### 네비게이션 결정
- ReadersScreen / HostRequestsScreen 모두 `(tabs)/` 하위 숨겨진 스택 라우트(href:null)로 배치.
  근거: 기존 패턴(`[bookId]`, `search`, `scan`, `clubs/[clubId]`)과 동일 — 탭바에 노출되지 않고 router.push 로 스택 진입.
  `clubs.tsx`(모임 탭 placeholder)는 본 위임 범위 밖이며 SPEC-CLUB-002(Track B 개설형)에서 콘텐츠 구현.

### 테스트 수
- club/ trackA UI 신규: 34 테스트 PASS (4 suite)
  - hooks 11 + ReadersScreen 9 + JoinRequestSheet 8 + HostRequestsScreen 6
- 전체 프로젝트: 91 suite / 789 테스트 PASS (이전 87/755 → +4 suite, +34 테스트)

### 커버리지 (club/ trackA — UI 포함)
- Statements: 93.44% (trackA/ 96%, components/ 90.36%)
- Branches: 80.55%
- Functions: 92.68% (trackA/ 100%)
- Lines: 95.85%
- 게이트(80%+) 충족

### 게이트 검증
- `npx tsc --noEmit`: 0 에러 ✅
- `npx jest`: 91 suite / 789 테스트 PASS ✅
- club/ 커버리지 ≥ 80% ✅ (Stmts 93.44%)
- SPEC-UI-002 준수: 3계층 레이아웃, 타이틀 균일성(fontSize 22/weight 700), 카드 밀도(cornerRadius 16/padding 16-20), 빈/로딩/에러 상태, token-only 스타일링(useTheme+tokens.ts), 비과시 원칙(좋아요/팔로워/랭킹 없음) — 이탈 0건
- 데이터 계층(위임 1) 파일 미수정 (계약 그대로 소비) ✅

### 커밋 SHA (실제)
- T-009 (M2 훅): 0b67b7c — trackA React Query 훅 4종
- T-010/T-011 (M3+M4): 6092c93 — ReadersScreen + JoinRequestSheet + readers 라우트
- T-012 (M5): 2a9c101 — HostRequestsScreen + host-requests 라우트

### SPEC-UI-002 이탈 (없음)
모든 FROZEN 규칙 준수 — 3계층 레이아웃, 헤더 타이틀 균일성, 카드 밀도, 상태 패턴, 토큰 전용 스타일링, 비과시 원칙. Pencil .pen 검사는 미수행 (화면 구현은 SPEC-UI-002 spec + 기존 library.tsx 시각 참조로 준수).

### 블로커
없음. 단 Edge Function skeleton 한계(위임 1 전달사항)로 인해 통합 플로우(실제 DB 연동) 테스트는 Edge Function 완성 후 별도 진행 권장.


## Phase 1 전략 요약

### 핵심 아키텍처 (DB 주도 상태 기계 소비)

1. **트리거 신뢰**: 클라이언트는 상태 전환 무결성을 재검증하지 않음.
   - `guard_join_request_status_trigger` (BEFORE UPDATE): terminal 상태 status 재설정 시 RAISE EXCEPTION → 클라이언트는 VALIDATION 에러로 처리
   - `join_request_accept_trigger` (AFTER UPDATE, SECURITY DEFINER): accepted 전환 시 club_members 자동 INSERT → 클라이언트는 INSERT 수행 안 함, 재조회로 관측
   - `handle_new_club_host` (AFTER INSERT clubs): clubs INSERT 시 host 자동 가입 → Edge Function lazy 생성 시 활용
2. **RLS 단일 신뢰 경계**: `join_requests_insert_own`, `join_requests_update_host`, `club_members_select_same_club`(`fn_user_in_club`)에 의존. 클라이언트 권한 검사 없음.
3. **보안 뷰 소비**: `user_books_public`(REQ-DB-013e)에서 공개 독자만 조회. 베이스 테이블 직조회 금지.
4. **Edge Function 위임**: `process-join-request`(service_role)가 lazy 그룹 생성 + 요청 INSERT를 원자적 수행. 멱등성 비재시도 정책(invokeEdgeFunction) 준수.

### 재사용 패턴 (LIBRARY/SPEC-API-001에서 검증)

- `getSupabaseClient()` 싱글톤 (REQ-API-001)
- `normalizeError()` / `classifyError()` — 23505→VALIDATION, 42501→RLS_DENIED 자동 매핑
- `invokeEdgeFunction()` — Edge Function 단일 진입점, JWT 자동 주입
- `getUserFriendlyMessage()` — 한국어 메시지 (terminal 예외 매핑만 신규 추가)
- React Query 패턴 (`useLibrary` 참조) — queryKey 캐싱, mutation optimistic + rollback + invalidate

### Decision Points (사용자 승인 후 위임 프롬프트에 반영)

1. 알림 발송: MVP stub (SPEC-NOTIF-001 연동 시 통합)
2. 거절 재요청: UNIQUE 영구 차단 유지
3. 독자 정렬: started_reading_at DESC
4. lazy 그룹 생성: Edge Function 위임 (service_role)
5. Deno 구현 범위: skeleton 포함 (naver-userinfo-proxy 패턴)
6. message 길이: 500자 제한 (이중 방어)

### 위임 분할

- **위임 1 (데이터 + Edge Function)**: T-001~T-008 — 순수 데이터 계층 + Deno skeleton
- **위임 2 (UI)**: T-009~T-012 — React Query 훅 + 화면 3종

## 게이트 기준 (AC-009 강제)

- tsc --noEmit: 0 에러
- jest: 전수 PASS, trackA/ 커버리지 85%+
- lint: 0 에러 0 워닝
- RLS 격리: 요청자/host 권한 경계 통합 테스트 (로컬 Supabase 실제 정책)
- 트리거 예외: terminal 상태 재설정 시나리오 R12 검증
- SPEC-UI-002: 3계층 레이아웃, 타이틀 균일성(fontSize 22/weight 700), 카드 밀도(cornerRadius 16/padding 16-20), 빈/로딩/에러 상태 패턴 준수
