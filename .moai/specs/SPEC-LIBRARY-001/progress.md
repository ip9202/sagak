## SPEC-LIBRARY-001 Progress

- Started: 2026-06-16
- development_mode: tdd (manager-tdd, RED-GREEN-REFACTOR)
- execution_mode: solo + standard harness
- branch: feature/SPEC-LIBRARY-001-library

## Phase 기록

- **Phase 0 (사전 블로커 해소)**: gen-types 실행 — `src/types/supabase.ts` 816라인 타입 생성, package.json 스크립트 최신화. 커밋 `7e12e3e`. tsc 0 에러 검증. (2026-06-16)
- **Phase 1 complete**: manager-strategy 실행계획 수립. 10 태스크 분해, 18 파일 예상(신규 11/수정 7), 도메인 2. 숨은 의존성 2건 발견(QueryClientProvider 부재, [bookId] UUID 전용). ISBN 매핑 설계안 (b) resolveBookId 채택. 사용자 승인(Decision Point 1). (2026-06-16)
- **Phase 2 시작**: manager-tdd 데이터 계층(M0+M1, TASK-001~006) 위임.

## 마일스톤 진척

- **M0 (QueryClientProvider + resolveBookId + search 통합)**: 완료 (0198dc5) — 검증: tsc 0, jest PASS
- **M1 (libraryApi CRUD + mutation + 진도률)**: 완료 (d154997) — 검증: tsc 0, jest 498/498 PASS, library/ 커버리지 86.66%
- **M2 (useLibrary 훅)**: 완료 — 검증: tsc 0, jest 545/545 PASS
- **M3 (LibraryScreen)**: 완료
- **M4-6 (BookDetail 확장)**: 완료

## Phase 2 완료 (2026-06-16)

- **최종 검증**: jest 545/545 PASS, 59 suites, library coverage 85.92%
- **Evaluator fix cycle**: 1회 iteration (MX 태그 정리, JSDoc 추가)
- **Merge**: b3a5043 (PR #10 squash merge)
- **구현 파일**: 38 files (+4794/-118)
- **주요 산출물**:
  - `src/features/library/` — libraryApi, useLibrary, useLibraryItem, types, progressValidation, progressRate
  - `src/lib/query/queryClient.ts` — QueryClient 싱글톤
  - `src/features/book/resolveBookId.ts` — ISBN→UUID 변환 (books.isbn UNIQUE lookup)
  - gen-types workflow: `npm run gen-types` = `node scripts/gen-types-with-header.js`, local Supabase
  - Supabase client: `createClient<Database>` 제네릭 (REQ-API-007 타입 안전)

## 게이트 결과 (직접 검증 — 교훈 #1)

- tsc --noEmit: 0 에러 (M0+M1 완료 시점 직접 실행)
- jest: 498/498 PASS, 59 suites, 1.6s
- lint: 0 에러 0 워닝 (manager-tdd 보고)
- 커밋 SHA 직접 검증: 0198dc5, d154997 실제 commit 확인 (할루시네이션 교훈 준수)
- LSP "Cannot find module" 진단: 교훈 #1 오탐 확정 (파일 방금 생성, stale 인덱싱)

## implementation_divergence (M0+M1)

- 추가: scripts/gen-types-with-header.js (gen-types 헤더 보존 래퍼), client.ts Database 제네릭 (REQ-API-007)
- 수정: supabase.ts 헤더 복원, supabase.test.ts (7e12e3e gen-types가 깨뜨린 기존 테스트 수정)
- 정당성: 데이터 계층 타입 안전 + 사전 결함(7e12e3e 후속) 수정

## UI 계층으로 넘긴 메모 (manager-tdd 전달)

1. search.tsx NOT_FOUND 처리: 현재 console.warn만 — getUserFriendlyMessage로 사용자 메시지 노출 필요
2. updateProgress totalPages 선택 인자: BookDetailScreen에서 books.total_pages 전달 시 ceiling 검증 활성화
3. calcProgressRate null 반환: UI에서 null 분기 (미정의 진도률 표시)

---

## PR 후속 (2026-06-25)

### PR #69 (fe21bd0) — 서재에 추가 진입점 (BookDetailScreen)

**문맥**: M1~M4 완료 이후, 사용자가 도서 상세 화면(BookDetailScreen)에서 직접 서재에 추가 기능 요구. REQ-LIB-001(서재 추가)이 누락된 상태였음.

**구현 내용**:
- **BookDetailScreen 진입점**: 상세 화면 헤더 우측 또는 하단 CTA로 "서재에 추가" 버튼 추가.
- **useAddBook hook**:
  - `src/features/library/useLibrary.ts` 내 useAddBook (개별 파일 아님 — PR #73 기록 정정).
  - `addBook` 뮤테이션 호출 후 409 중복 처리(`books.isbn UNIQUE` 제약조건 위반).
  - 중복 시 "이미 서재에 있는 책입니다" 메시지 표시.
  - 성공 시 BookDetailScreen의 `libraryItem` state 갱신하여 "서재에 추가됨" 상태 반영.
- **libraryItem null 분기**: BookDetailScreen에서 `libraryItem === null`일 때만 "서재에 추가" 버튼 표시. 이미 서재에 있으면 버튼 숨김.

**REQ-LIB-001 준수**:
- 서재에 추가 진입점(BookDetailScreen) 구현.
- 중복 책 처리(409 Conflict) UX 구현.
- state 갱신으로 즉시 피드백 제공.

**검증 상태**:
- jest 통과.
- 실기기 테스트 통과(서재 추가 → 중복 메시지 → state 갱신 확인).

**회귀 맥락**: M1~M4에서 서재 추가 진입점 누락 → 사용자 피드백으로 PR #69 반영.

### SPEC 완료 상태 (최종 갱신 2026-06-25)
- M1~M4 전부 develop 머지 완료 → SPEC-LIBRARY-001 status: completed
- REQ-LIB-001(서재에 추가 진입점) PR #69로 완료.
- **최신 PR**: PR #73 (8c7122e, 2026-06-25 머지) — 서재 추가 end-to-end 검증 gap 보강.

## PR 후속 #2 (2026-06-25)

### PR #73 (8c7122e) — 서재 추가 end-to-end 검증 gap 보강

**문맥**: 미등록 책 서재 추가 UX 추가 검증 요청. PR #69 구현이 이미 정상임을 확인하되,
SPEC 인수기준(acceptance.md) ↔ 코드/테스트 매핑 결과 빈 구멍 4종 식별. 프로덕션 코드
변경 없이 테스트로 gap 해소.

**식별된 gap (PR #73로 해소)**:
- AC-LIB-001(즉시 표시): 기존 테스트는 "addBook 호출됨"까지만 검증 → 성공 후
  미등록 섹션 → 등록 섹션 UI 전환 렌더링 계약 미검증.
- AC-LIB-003(미인증 차단): 클라이언트 미인증 UI 차단 미검증.
- 로딩 중 점멠(깜빡임) 방지: `libraryItem` 로딩 중 버튼 미노출 계약 미검증.
- useAddBook.onSuccess 캐시 무효화 계약: 이전 섹션엔 "useAddBook 테스트 추가"로
  암시됐으나 실제론 `['library-item']` invalidate 인과 계약이 미검증이었음.

**구현 내용 (테스트만 +147 LOC)**:
- `src/features/book/__tests__/BookDetailScreen.library.test.tsx` (+98):
  - AC-LIB-001: 추가 성공 후 동일 QueryClient + rerender 로 미등록→등록 섹션 전환 검증.
  - AC-LIB-003: 미인증 시 ActivityIndicator + 버튼 미노출 + addBook 미호출 검증.
  - 로딩 중 버튼 미노출(깜빡임 방지) 검증.
- `src/features/library/__tests__/useLibrary.optimistic.test.tsx` (+49):
  - useAddBook.onSuccess 가 `['library', {userId}]` + `['library-item', {bookId,userId}]`
    두 queryKey 를 무효화하는지 단위 테스트 (invalidateSpy).

**검증 상태**:
- BookDetailScreen.library 21/21, useLibrary.optimistic 8/8, 전체 1221/1221.
- tsc --noEmit clean, CI 3/3 green (Lint/Test/Typecheck).

**비고**: 프로덕션 코드 변경 없음. PR #69 구현이 SPEC 인수기준 정상 충족 재확인.

## 홈 "지금 읽는 책" 정렬 버그 fix (2026-06-29)

### 버그 (DB 확정)
홈 "지금 읽는 책"이 readingList?.[0] 인데, getLibrary 는 last_progress_at DESC 정렬.
신규 reading 전환/추가 책은 진행 기록이 없어 last_progress_at=null → 정렬에서 밀려
홈 [0] 에서 누락. DB 실측(강력쓠주먹 naver): updated_at 최신인 신규 reading 책이
홈에 안 뜨고, last_progress_at 과거값인 책이 [0] 표시됨.

### 결정: 정책 5.2 홈/서재 분리 (옵션 E)
- 홈 CurrentBook: updated_at DESC (pickCurrentBook, 클라이언트 재정렬)
- 서재 LibraryScreen: last_progress_at DESC 유지 (getLibrary DB order 변경 없음)

근거: 신규 reading 책(last_progress_at=null)이 홈에 떠야 한다는 사용자 기대 충족.
updated_at 은 status/current_page/visibility 갱신 시 DB가 자동 갱신하므로 "가장
최근에 의미있게 바뀐 책"을 가장 잘 반영. 서재는 기존 동작 유지로 회귀 리스크 최소.

### TDD 산출물
- 신규: src/features/library/pickCurrentBook.ts (홈 CurrentBook 선택 순수 함수)
- 신규 테스트: src/features/library/__tests__/pickCurrentBook.test.ts (5 cases, 100% cov)
- 수정: app/(tabs)/index.tsx (readingList?.[0] → pickCurrentBook(readingList))
- 수정: app/(tabs)/__tests__/index.test.tsx (정렬 회귀 시나리오 추가)
- SPEC 갱신: 정책 5.2 (5.2 서재 정렬 기본값 — 홈/서재 분리 확정)

### 게이트
- tsc --noEmit: 0 에러
- jest 전체: 145 suites / 1326 tests PASS
- 커버리지: pickCurrentBook.ts 100%, index.tsx 100% (lines/funcs)
- lint: 0 에러 0 워닝
