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

---

## PR 후속 #3 (2026-06-30)

### PR #102 (350e7f0) — 정책 5.5 reading 단일 정책 구현

**문맥**: 기존 시스템은 사용자가 도서별로 reading 상태를 복수 보유 가능(서재 기본값 'reading'). 정책 5.5로 reading 단일 보장 요구 — 한 사용자는 동시에 최대 1개의 reading만 허용.

**구현 내용 (DB 마이그레이션 + 클라이언트 수정)**:
- **migration 20240630000001_enforce_single_reading_policy.sql**:
  1. **다중 reading 정리**: 사용자별 updated_at DESC 최신 1개만 reading 유지, 나머지는 shelved로 전환. 정전 결과 보장(deterministic) — id DESC tie-breaker.
  2. **부분 UNIQUE 인덱스**: `user_books_one_reading_per_user(user_id WHERE status='reading')` — 동시성 경쟁 시 23505 unique_violation 최종 방어.
  3. **status 기본값 변경**: 'reading' → 'shelved' (서재 추가는 보관 상태로 시작).
  4. **enforce_single_reading() 트리거**: BEFORE INSERT OR UPDATE OF status, FOR EACH ROW. 새 reading 발생(INSERT reading 또는 비-reading→reading UPDATE) 시 기존 reading을 shelved로 배타 전환. 트리거 이름 `enforce_single_reading`은 알파벳순 실행 규칙에 의해 기존 `on_user_books_update`/`trg_user_books_updated_at`보다 선행 실행 보장.
  5. **MX 태그**: @MX:ANCHOR — DB 단일 진실 원천, 트리거 이름 변경 금지(실행 순서 의존). @MX:REASON — 부분 UNIQUE 검사 전에 기존 reading을 전환하지 않으면 정상 배타 전환이 23505로 오작동.

- **클라이언트 수정** (`src/features/library/`):
  - **addBook 기본값**: status 'shelved'로 명시적 전달(기존 'reading' 제거).
  - **useAddBook UI 피드백**: reading 전환 시 "이미 읽고 있는 책이 있습니다. 기존 reading은 보관함으로 이동됩니다." 안내 메시지 추가 (AppError 사용자 메시지).

**검증 상태**:
- **tsc 0, jest 1321 PASS** (1221→1321, 시나리오 A-E 테스트 추가).
- **시나리오 A (배타 전환)**: 기존 reading A → 새 책 B reading → A 자동 shelved 검증.
- **시나리오 B (동시성 방어)**: 동시 reading 전환 시 한쪽 23505 unique_violation, 클라이언트 AppError(VALIDATION) 분류 검증.
- **시나리오 C (no-op)**: 이미 reading인 행을 다시 reading으로 UPDATE 시 무의미한 자기 갱신/재귀 방지 검증(트리거 내 `OLD.status IS DISTINCT FROM 'reading'` 가드).
- **시나리오 D (completion_reports 회귀 없음)**: reading→shelved 트리거 시 `generate_completion_report_trigger`(AFTER UPDATE OF status)가 미발동 검증(reading→completed만 감지하도록 조건 있음).
- **시나리오 E (정리 결정성)**: 다중 reading 정리(updated_at DESC, id DESC)가 실행 순서 무관하게 동일 결과 보장 검증.

**리뷰**:
- **manager-quality 독립 리뷰**: Critical 0, W2(Spec 통일성), S1(MX:ANCHOR 누락 복구), W3(사용자 메시지) 수정. W1(수정 권장)은 오탐으로 직접 검증 후 반영 무효화.

**SPEC 정책 5.5 추가**: spec.md에 정책 5.5 문서화 완료(reading 단일 보장, 기존 reading 자동 shelved 배타 전환, 동시성 23505 방어).

**회귀 맥락**: 기존 reading 복수 보유 → 정책 5.5로 단일 강제, 정리 마이그레이션으로 기존 데이터 보존(updated_at DESC 최신 1개).

