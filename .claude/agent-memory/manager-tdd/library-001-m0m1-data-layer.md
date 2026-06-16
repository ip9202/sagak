---
name: library-001-m0m1-data-layer
description: SPEC-LIBRARY-001 M0+M1 데이터 계층 완료 (2026-06-16) — 다음 UI 계층 위임용 메모
metadata:
  type: project
---

SPEC-LIBRARY-001 M0+M1 데이터 계층 TDD 완료 (2026-06-16).

**Why:** 서재/진행률 기능의 데이터 기반(인프라 + ISBN 매핑 + CRUD + mutations + 순수 함수)을 먼저 완성하여 UI 계층(T-007~010)이 안전하게 의존할 수 있도록 분리 구현.

**How to apply:** 다음 위임(UI 계층)은 library.tsx, BookDetailScreen.tsx, useLibrary.ts 구현. 핵심 의존성:
- `resolveBookId(isbn)` — search.tsx 에서 이미 연결됨 (NOT_FOUND 시 사용자 메시지는 UI 에서 getUserFriendlyMessage 로 처리 필요)
- `libraryApi`: addBook/getLibrary/deleteBook/updateProgress/updateStatus/updateVisibility
- `calcProgressRate(currentPage, totalPages)` — 진행률 바 표시용
- `validatePage(page, totalPages)` — 페이지 입력 폼 검증용
- QueryClientProvider 는 app/_layout.tsx 에서 전역 설정됨

커밋: M0=0198dc5, M1=d154997 (feature/SPEC-LIBRARY-001-library).

**발생한 인프라 수정 (plan 에 없던 것):**
1. gen-types 헤더 보존 래퍼 (scripts/gen-types-with-header.js) — supabase.test.ts 헤더 단언 결함 해결
2. src/lib/supabase/client.ts 에 createClient<Database> 적용 — PostgREST 타입 안전 (REQ-API-007)
3. search.tsx 의 NOT_FOUND 처리는 콘솔 로깅만 — UI 계층에서 사용자 친화적 메시지 통합 필요

[[project-status]]
