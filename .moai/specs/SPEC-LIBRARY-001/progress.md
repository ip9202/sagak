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
  - `src/features/library/useAddBook.ts` 신규 작성.
  - `addBook` 뮤테이션 호출 후 409 중복 처리(`books.isbn UNIQUE` 제약조건 위반).
  - 중복 시 "이미 서재에 있는 책입니다" 메시지 표시.
  - 성공 시 BookDetailScreen의 `libraryItem` state 갱신하여 "서재에 추가됨" 상태 반영.
- **libraryItem null 분기**: BookDetailScreen에서 `libraryItem === null`일 때만 "서재에 추가" 버튼 표시. 이미 서재에 있으면 버튼 숨김.

**REQ-LIB-001 준수**:
- 서재에 추가 진입점(BookDetailScreen) 구현.
- 중복 책 처리(409 Conflict) UX 구현.
- state 갱신으로 즉시 피드백 제공.

**검증 상태**:
- jest 통과(useAddBook 테스트 추가).
- 실기기 테스트 통과(서재 추가 → 중복 메시지 → state 갱신 확인).

**회귀 맥락**: M1~M4에서 서재 추가 진입점 누락 → 사용자 피드백으로 PR #69 반영.

### SPEC 완료 상태 (최종 갱신 2026-06-25)
- M1~M4 전부 develop 머지 완료 → SPEC-LIBRARY-001 status: completed
- REQ-LIB-001(서재에 추가 진입점) PR #69로 완료.
- **최신 PR**: PR #69 (fe21bd0, 2026-06-25 머지).
