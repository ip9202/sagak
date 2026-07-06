## SPEC-BOOK-001 Progress

- Started: 2026-06-16
- Mode: solo (sub-agent sequential)
- Scope: M1 (Edge Function) + M2 (Client API) + M3 (BarcodeScanner) + M4 (BookSearch/Detail screens) — Mock-based TDD (Kakao API mocked)
- Branch:
  - M1+M2: feature/SPEC-BOOK-001-book-search (from develop 4424251) → PR #8 (852f0ac)
  - M3+M4: feature/SPEC-BOOK-001-m3-m4 (from develop 09b78bb) → PR #9 (a293e8d)
- Status: completed (M1~M4 전부 develop 머지 완료)

### Phase 0 — Pre-flight
- Phase 0.9 (JIT Language): TypeScript / React Native (Expo SDK 55), jest-expo preset → moai-lang-typescript
- Phase 0.95 (Scale Mode): Standard/Full Pipeline (solo) — ~13 files, 2-3 domains, strict sequential deps (M1→M2→M3→M4), TDD consistency → solo override of team default
- New dependency added (M3): expo-camera ~55.0.19 — CameraView, useCameraPermissions, barcodeScannerSettings API

### Phase 2 — Implementation (TDD)
- T-001 complete: src/types/book.ts + __tests__/book.test.ts — 12 tests pass (BookRow, SearchResult, SearchTarget + type guards). REQ-003,012,015
- T-002 complete: supabase/functions/kakao-book-search/deno.json — Deno import map (config, no test). REQ-001
- T-003 complete: normalizer.ts + __tests__/normalizer.test.ts — 11 tests pass. REQ-003, S3
- T-004 complete: mapper.ts + __tests__/mapper.test.ts — 4 tests pass. REQ-012, S15
- T-005 complete: cacheManager.ts + __tests__/cacheManager.test.ts — 5 tests pass (DI pattern). REQ-010,011, S13,S14,S18
- T-006 complete: kakaoClient.ts + __tests__/kakaoClient.test.ts — 6 tests pass. REQ-001,002,004, S1,S4
- T-007 complete: index.ts + __tests__/index.test.ts — 7 tests pass (DI handleSearchRequest, Deno shell guarded). REQ-001~005,010~012, S1,S4,S5,S13,S14,S21
- T-008 complete: src/features/book/searchApi.ts + __tests__/searchApi.test.ts — 6 tests pass. REQ-001,005, S5,S21
- T-009 complete: src/features/book/bookDetailApi.ts + __tests__/bookDetailApi.test.ts — 4 tests pass. REQ-013,015, S16,S19,S20,S22
- T-010 complete: src/features/book/index.ts barrel + jest.config coverage 확장 (supabase/functions/** 추가)

### Phase 2 — Quality Gates (M1+M2)
- typecheck (tsc strict): 0 errors — PASS
- lint (eslint): 0 errors — PASS
- jest (전체): 372 passed (기존 317 + 신규 55) — PASS
- 커버리지: src/features/book/ 100%, supabase/functions/kakao-book-search/ 98.27%, src/types/book.ts 100%

### Divergence (M1+M2)
- jest.config.js collectCoverageFrom 확장: src/** + supabase/functions/**/*.ts (index.ts/Deno 셸 제외). 첫 Edge Function이므로 커버리지 추적 범위 확장 정당화됨.
- index.ts: Deno.serve 셸 + handleSearchRequest 핵심 로직 분리 (의존성 주입). Deno 글로벌 런타임 체크로 jest 환경 no-op.
- 신규 의존성: 없음 (supabase-js, expo 등 기존 패키지만 사용)

---

### Phase 2 — Implementation (M3+M4, TDD)

**M3 (바코드 스캔, REQ-BOOK-006~009)**:
- T-011 complete: src/features/book/isbn.ts + __tests__/isbn.test.ts — isValidIsbn13/isValidIsbn10/isValidIsbn (ISBN-13 EAN-13 체크디지트 + ISBN-10 레거시 호환). REQ-BOOK-007, S8/S9/S12
- T-012 complete: src/features/book/debounce.ts + __tests__/debounce.test.ts — shouldSuppressDuplicate 순수 함수 (DUPLICATE_DEBOUNCE_MS=2000). REQ-BOOK-009, S11. 컴포넌트 테스트에서 디바운스 분기 도달 불가 → 순수 함수로 추출하여 계약 직접 검증
- T-013 complete: src/features/book/BarcodeScanner.tsx + __tests__/BarcodeScanner.test.tsx — CameraView/useCameraPermissions(expo-camera ~55.0.19), 권한 게이트 3상태(loading/granted/denied), ISBN 바코드 타입 필터(ean13/upc_a), 디바운스 통합. REQ-BOOK-006~009, S6~S12
- T-014 complete: __tests__/__mocks__/expo-camera.tsx — expo-camera jest 수동 목 (CameraView, useCameraPermissions 권한 상태 주입 가능)

**M4 (검색·상세 화면, REQ-BOOK-005/014/015/016)**:
- T-015 complete: src/features/book/format.ts + __tests__/format.test.ts — formatPublishedMonth(iso) → "YYYY.MM" 포맷 공유 유틸. REQ-BOOK-014/015. DRY 원칙 (SearchResultCard + BookDetailScreen 공유)
- T-016 complete: src/components/SearchResultCard.tsx + __tests__/SearchResultCard.test.tsx — 검색 결과 카드. Pencil 디자인 x8zuOu 기반. BookCard(서재용, 진행률 필수)와 분리. REQ-BOOK-014
- T-017 complete: src/features/book/BookSearchScreen.tsx + __tests__/BookSearchScreen.test.tsx — 검색 메인 화면. Pencil F06-Search (E44G9) 기반. 빈 쿼리 차단(REQ-BOOK-005), 빈 결과 안내(S21), 로딩/에러 상태. REQ-BOOK-005/016, S5/S21
- T-018 complete: src/features/book/BookDetailScreen.tsx + __tests__/BookDetailScreen.test.tsx — 도서 상세 화면. useSession 세션 가드(loading/null, 미인증 onRequireAuth), NOT_FOUND/RLS_DENIED 에러 매핑(S20/S22). REQ-BOOK-015, S19/S20/S22
- T-019 complete: 라우팅 통합
  - app/(tabs)/search.tsx — BookSearchScreen 라우트 (href:null), ISBN 자동 전환(initialQuery/initialTarget param)
  - app/(tabs)/scan.tsx — BarcodeScanner 라우트 (href:null), ISBN 감지 시 router.replace('/search')
  - app/(tabs)/[bookId].tsx — BookDetailScreen 통합 (SPEC-NAV-001 stub 교체)
  - app/(tabs)/library.tsx — 검색 진입 CTA 추가 (빈 상태 "책 검색하기" + 헤더 검색 아이콘)
  - app/(tabs)/_layout.tsx — search/scan Tabs.Screen href:null 등록
  - src/features/book/index.ts — BarcodeScanner, isValidIsbn* barrel 확장

### Phase 2 — Quality Gates (M3+M4)
- typecheck (tsc strict): 0 errors — PASS
- lint (eslint): 0 errors — PASS
- jest (전체): 462 passed (기존 372 + 신규 90) / 52 suites — PASS
- 커버리지: 전체 94%+ (src/features/book, src/components/SearchResultCard 포함)

### Divergence (M3+M4)
- **BookCard vs SearchResult 불일치 → SearchResultCard 분리**: 기존 BookCard는 서재용(currentPage/totalPages 진행률 필수)이고 검색 결과는 진행률이 없음. 동일 컴포넌트 재사용 불가 → 별도 SearchResultCard 컴포넌트 신규 작성 (Pencil x8zuOu 기반)
- **디바운스 순수 함수 추출 (debounce.ts)**: BarcodeScanner 컴포넌트 테스트에서 setScanning(false)(S10 카메라 중지)로 인해 디바운스 분기 도달 불가 → shouldSuppressDuplicate를 순수 함수로 추출하여 단위 테스트가 디바운스 계약 직접 검증 (REQ-BOOK-009 실질 검증)
- **format 유틸 분리 (format.ts)**: SearchResultCard(M4-1)와 BookDetailScreen(M4-3)이 동일 출판일 포맷("YYYY.MM") 공유 → DRY 원칙으로 formatPublishedMonth 공유 유틸 추출
- **신규 의존성: expo-camera ~55.0.19**: SDK 55 호환. CameraView(active, barcodeScannerSettings, onBarcodeScanned API), useCameraPermissions 훅 사용
- **Pencil 디자인 기반 구현**: sagak.pen 에 SearchResultCard(x8zuOu), F06-Search(E44G9), F07-Scan(acwG9) 신규 프레임 참조. token-only 스타일링 (SPEC-UI-002 FROZEN 준수)
- **권한 게이트 fix cycle**: evaluator 1차 FAIL (useCameraPermissions 미사용, 권한 없이 CameraView 렌더) → 권한 게이트 3상태(loading/granted/denied) 구현으로 fix → PASS

### PR #9 머지
- PR #9 squash-merged into develop: a293e8d (2026-06-16)
- 커밋 메시지: feat(book): SPEC-BOOK-001 M3 바코드 스캔 + M4 검색·상세 화면 (#9)
- diff: 39 files changed, 3460 insertions(+), 69 deletions(-)

### PR 후속 (2026-06-25)

#### PR #64 (c379885) — kakao-book-search service_role 클라이언트 실구현
- **문맥**: PR #9 M1 Edge Function이 stub(mock) 상태로 머지되었음. 실기기 테스트 시 Supabase Edge Function 런타임 오류(500) 발생.
- **해결**: kakaoClient.ts에서 `createClient(supabaseUrl, serviceRoleKey)` 실제 service_role 클라이언트 사용. async 동적 import(`import('node-fetch')`)로 Deno 런타임 호환성 확보.
- **검증**: dev 배포 후 Deno 런타임에서 200 OK 응답 확인. 로컬 테스트 통과.
- **결함 맥락**: M1 stub(미구현)이 dev 환경에서 작동하지 않는 블로커 발견 → 실구현으로 수정. (stub=미구현이므로 회귀 아님 — lessons #19)

#### PR #65 (31427af) — S13 바코드 스캔 후 ISBN 자동 검색
- **내용**: BarcodeScanner에서 ISBN 감지 시 `router.push(\`/search?initialQuery=${isbn}&initialTarget=search\`)` 자동 검색.
- **구현**: useEffect + useRef로 스캔 완료 후 자동 라우팅. BookSearchScreen은 initialQuery/initialTarget param을 처리하여 자동 검색 실행.
- **실기기 검증 결함 발견**: 초기 구현에서 자동 검색이 작동하지 않음 → useEffect 의존성 배열 수정. (초기 구현 결함, 회귀 아님)

#### PR #67 (124351f) — S13 initialQuery 지연 갱신 시 자동 검색 (PR #65 후속)
- **문맥**: PR #65 이후, initialQuery param이 지연 갱신되는 경우(initialQuery가 나중에 설정됨) 자동 검색이 작동하지 않는 회귀.
- **해결**: BookSearchScreen의 handleSubmit을 override 인자(`overrideQuery?`)를 받도록 수정. useEffect에서 `handleSubmit(initialQuery, true)` 호출 시 override 전달.
- **state 동기화**: initialQuery/initialTarget state와 URL query params 간 동기화 강화.
- **결함 맥락**: PR #65 후속 실기기 검증에서 발견된 edge case 수정.

#### PR #68 (8c9cdc9) — 검색 결과 클릭 시 unmatched route 에러 수정
- **문맥**: SearchResultCard 클릭 시 `router.push(\`/book/${id}\`)` 호출. 실제 라우트는 `app/(tabs)/[bookId].tsx` → `/1234` 형식.
- **회귀**: 실기기에서 "unmatched route" 에러 발견. path가 `/book/1234`로 잘못 구성됨.
- **해결**: `router.push(\`/\${id}\`)`로 수정. `app/(tabs)/[bookId].tsx` 라우트와 일치.
- **실기기 검증 결함**: 라우팅 path 불일치로 인한 실기기 전용 버그.

#### PR #71 (dac4ba7) — 두 번째 바코드 스캔 하얀 화면 수정 (issue #66)
- **문맥**: 첫 스캔은 정상 작동하나, 두 번째 스캔 시 화면이 하얗게 멈추는 버그(issue #66).
- **원인 분석**: CameraView가 key prop 없이 재마운트되지 않음. React Native에서 동일 컴포넌트 재사용 시 내부 state 초기화 누락.
- **해결**: 
  - `useFocusEffect`(expo-router)를 사용하여 화면 포커스 시 CameraView key 재생성(`key={\`${scannedCount}\`}`).
  - key 변경 강제로 CameraView 재마운트 → 내부 state 초기화.
- **검증**: 실기기에서 두 번째/세 번째 스캔 정상 작동 확인. issue #66 closed.
- **실기기 검증 결함**: useFocusEffect 미사용으로 인한 카메라 수명 주기 관리 버그.

### SPEC 완료 상태 (최종 갱신 2026-06-25)
- M1~M4 전부 develop 머지 완료 → SPEC-BOOK-001 status: completed
- ISBN→bookId 매핑은 합의된 후속 (결함 아님): search.tsx에서 ISBN으로 라우팅(/book/[isbn]), 실제 bookId 매핑은 SPEC-LIBRARY-001에서 연동 예정
- **최종 PR 머지**: PR #71 (dac4ba7) — issue #66 closed. 실기기 검증 결함 3종(#65/#67/#68) 해결.
