## Task Decomposition
SPEC: SPEC-LIBRARY-001
development_mode: tdd | mode: solo standard | updated: 2026-06-16

Source: manager-strategy Phase 1 분석 (Decision Point 1 승인)

| Task ID | Description | Requirement | Dependencies | Planned Files | Status |
|---------|-------------|-------------|--------------|---------------|--------|
| T-001 | QueryClientProvider 부트스트랩 | M0 인프라 (REQ-LIB-013 전제) | - | app/_layout.tsx(M), src/lib/query/queryClient.ts(N), __tests__/queryClient.test.ts(N) | pending |
| T-002 | resolveBookId(isbn) 유틸 (ISBN→UUID) | M0 블로커B 해소 (REQ-LIB-001 전제) | - | src/features/book/resolveBookId.ts(N), __tests__/resolveBookId.test.ts(N), book/index.ts(M) | pending |
| T-003 | search.tsx ISBN→UUID 라우팅 통합 | M0 블로커B 해소 | T-002 | app/(tabs)/search.tsx(M) | pending |
| T-004 | libraryApi 타입 + CRUD 쿼리 함수 | REQ-LIB-001,002,003,004,005,020,021,023,030 | T-002 | src/features/library/types.ts(N), libraryApi.ts(N), __tests__/libraryApi.test.ts(N) | pending |
| T-005 | 진도/상태/공개 mutation + 검증 | REQ-LIB-010,011,020,030 | T-004 | libraryApi.ts(M), progressValidation.ts(N), __tests__×2(N) | pending |
| T-006 | 진도률 파생 계산 순수 함수 | REQ-LIB-012 | - | progressRate.ts(N), __tests__/progressRate.test.ts(N) | pending |
| T-007 | useLibrary 훅 (조회+필터+정렬) | REQ-LIB-003,005 | T-001,T-004 | useLibrary.ts(N), __tests__/useLibrary.test.ts(N) | pending |
| T-008 | mutation 훅 + 낙관적 업데이트/롤백 | REQ-LIB-013,010,020,030 | T-007 | useLibrary.ts(M), __tests__/useLibrary.optimistic.test.ts(N) | pending |
| T-009 | LibraryScreen 구현 (stub 교체) | REQ-LIB-003,032 | T-007,T-008 | app/(tabs)/library.tsx(M), __tests__/library.test.tsx(N) | pending |
| T-010 | BookDetail 확장 (진도/상태/공개/완독/삭제/에지) | REQ-LIB-010,011,013,020,021,022,023,030,031,032 + 에지 | T-008,T-006 | BookDetailScreen.tsx(M), __tests__/BookDetailScreen.library.test.tsx(N), useLibraryItem.ts(N) | pending |

(M=수정, N=신규)

## 위임 분할

- **위임 1 (데이터 계층)**: T-001~006 (M0+M1) — 인프라 + ISBN 매핑 + libraryApi + 순수 함수
- **위임 2 (UI 계층)**: T-007~010 (M2~M6) — useLibrary 훅 + LibraryScreen + BookDetail 확장

## ISBN 매핑 설계 결정 (후보 b 채택)

- `resolveBookId(isbn): Promise<UUID>` — `books.select('id').eq('isbn').maybeSingle()`, 미등록 시 NOT_FOUND
- 책임 경계: 조회 전용, books 생성은 SPEC-BOOK-001 담당
- 라우팅: search.tsx에서 await resolveBookId 후 UUID push (b-1 안)

## 정책 A 가정

- 5.1 완독취소: 허용 + 경고
- 5.2 정렬 기본값: last_progress_at DESC
- 5.3 자식 데이터 삭제: 금지 + 안내
- 5.4 대량 삭제: 제외 (M7 optional 제외)
