# 코드맵 업데이트 요약 (2026-06-16)

## 개요

SPEC-BOOK-001 M1+M2(852f0ac) 머지 반영하여 5개 코드맵 파일을 BOOK 모듈 추가 사항으로 업데이트함.

## 변경사항 요약

### 1. overview.md
**변경 내용:**
- ✅ SPEC-BOOK-001을 SPEC Coverage 테이블에 추가 (M1+M2 완료, M3/M4 deferred 명시)
- ✅ Architecture Layers 다이어그램에 `src/features/book/` (BOOK 모듈)과 `supabase/functions/kakao-book-search/` (Edge Function) 레이어 추가
- ✅ External Services에 `Kakao Book Search API` 추가
- ✅ Phase 1 Foundation Complete 상태에 "도서 검색" 항목 추가
- ✅ Next Steps에 SPEC-BOOK-001 M3/M4 추가 (검색/상세 화면, 바코드 스캔)
- ✅ 브랜치 정보 업데이트 (4424251 → 852f0ac)

**영향 범위:**
- Mermaid 다이어그램 (노드 4개 추가)
- SPEC Coverage 테이블 (1행 추가)
- Foundation Complete 상태 (1항목 추가)
- Next Steps (3항목 추가)

---

### 2. modules.md
**변경 내용:**
- ✅ Types 섹션에 `src/types/book.ts` 추가 (SearchResult, BookRow, SearchTarget, 타입 가드)
- ✅ **신규 섹션:** Book Domain (`src/features/book/`) 추가
  - `index.ts` (barrel)
  - `searchApi.ts` (searchBooks, 빈 쿼리 차단, Edge Function 호출)
  - `bookDetailApi.ts` (getBookDetail, PostgREST 직접 조회, PGRST116→NOT_FOUND)
- ✅ **신규 섹션:** Edge Functions (`supabase/functions/kakao-book-search/`) 추가
  - `index.ts` (Entry Handler, DI 컨테이너, Deno 서빙 셸)
  - `normalizer.ts` (Kakao 응답 정규화)
  - `mapper.ts` (정규화 → books 테이블 매핑)
  - `cacheManager.ts` (캐시 조회/업서트, service_role 의존성 주입)
  - `kakaoClient.ts` (Kakao API 클라이언트, 타임아웃 8000ms)
- ✅ High Fan-in Modules 테이블에 `searchBooks`, `getBookDetail` 추가 (fan_in 3+ 예상, @MX:ANCHOR 후보)
- ✅ 계층별 모듈 분포 업데이트
  - Business: 20개 → 24개 (+3 Book 도메인, +1 book.ts 타입)
  - Edge Functions: 0개 → 5개 (kakao-book-search 하위 모듈 5개)

**영향 범위:**
- 모듈 카탈로그: 20+ → 29+ (Book 도메인 3개, Edge Functions 5개, 타입 1개 추가)
- @MX:ANCHOR 후보: 5개 → 7개 (searchBooks, getBookDetail 추가)

---

### 3. dependencies.md
**변경 내용:**
- ✅ Dependency Graph 다이어그램에 BOOK 모듈 노드 추가
  - `src/features/book/searchApi.ts` (@MX:ANCHOR)
  - `src/features/book/bookDetailApi.ts` (@MX:ANCHOR)
- ✅ Edge Functions 서브그래프 추가 (`kakao-book-search/index.ts`, `cacheManager.ts`, `kakaoClient.ts`)
- ✅ External Services에 `Kakao Book Search API` 추가
- ✅ Import Matrix에 새로운 섹션 추가
  - `src/features/book/` → `src/lib/api/` (invokeEdgeFunction)
  - `src/features/book/` → `src/lib/supabase/` (getSupabaseClient)
- ✅ High Fan-in Analysis에 #6 `searchBooks`, #7 `getBookDetail` 추가
- ✅ Circular Dependency Check 업데이트
  - BOOK 모듈 의존성 분석 추가
  - `src/features/book/` → `src/lib/api/` → `src/lib/supabase/` 단방향 흐름 검증
  - BOOK 모듈은 AUTH/NAV와 독립적 (역방향 의존성 없음)

**순환 의존성 검증 결과:** ✅ **없음**
- BOOK → API → supabase-js (단방향)
- BOOK does not import AUTH/NAV (독립적)

**영향 범위:**
- Mermaid 다이어그램 (노드 4개, 엣지 3개 추가)
- Import Matrix (2개 새로운 섹션)
- @MX:ANCHOR 후보: 5개 → 7개

---

### 4. entry-points.md
**변경 내용:**
- ✅ Entry Point Invocation Summary 테이블에 Edge Function 진입점 추가
  - `POST /functions/v1/kakao-book-search` → handleSearchRequest → Kakao API/캐시 → 응답

**영향 범위:**
- Entry Point Invocation Summary 테이블 (1행 추가)

---

### 5. data-flow.md
**변경 내용:**
- ✅ **신규 섹션:** 5. Book Search Flow 추가 (SPEC-BOOK-001 M1+M2)
  - 전체 흐름 다이어그램 (UI → searchBooks → Edge Function → Cache/Kakao → DB)
  - 빈 쿼리 차단 로직 (REQ-BOOK-005)
  - 캐시 히트/미스 분기 (REQ-BOOK-010)
  - Security Boundary 표 (클라이언트 vs Edge Function 권한)
- ✅ **신규 섹션:** 6. Book Detail Flow 추가 (SPEC-BOOK-001 M1+M2)
  - 전체 흐름 다이어그램 (UI → getBookDetail → PostgREST → DB)
  - 성공/0행/RLS 거부 분기
  - Error Classification 표 (PGRST116→NOT_FOUND, 42501→RLS_DENIED)
- ✅ Data Flow Health Check 테이블에 Book Search, Book Detail 추가 (모두 ✅ 정상)

**영향 범위:**
- Mermaid 다이어그램 2개 추가 (검색/상세 흐름)
- 데이터 흐름 섹션 2개 추가 (각 150-200 라인)
- Health Check 테이블 (2행 추가)

---

## 순환 의존성 검증 결과

**결론:** ✅ **순환 의존성 없음 (BOOK 모듈 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app/` → `src/` (단방향)
2. ✅ `src/auth/` → `src/lib/supabase/` (단방향)
3. ✅ `src/lib/api/` → `src/lib/supabase/` (단방향)
4. ✅ `src/features/book/` → `src/lib/api/` → `src/lib/supabase/` (단방향)
5. ✅ `src/features/book/` → `src/lib/supabase/` (단방향)
6. ✅ `src/features/book/`는 `AUTH/NAV` 모듈을 임포트하지 않음 (독립적)

**의존성 방향:**
```
app/ (Presentation)
  ↓ imports
src/ (Business Logic)
  ├── src/features/book/ → src/lib/api/ → src/lib/supabase/
  └── src/features/book/ → src/lib/supabase/
  ↓ imports
src/lib/ (Infrastructure)
```

---

## 모듈 수 변화

| 계층 | 업데이트 전 | 업데이트 후 | 증가 |
|------|-----------|------------|------|
| **Presentation (app/)** | 13개 | 13개 | 0 |
| **Business (src/)** | 20+개 | 29+개 | +9 |
| ├── AUTH | 6개 | 6개 | 0 |
| ├── Theme | 3개 | 3개 | 0 |
| ├── API | 4개 | 4개 | 0 |
| ├── Types | 2개 | 3개 | +1 (book.ts) |
| ├── **Book Domain** | 0개 | **3개** | **+3 (신규)** |
| └── Components | 6개 | 6개 | 0 |
| **Infrastructure (src/lib/)** | 5개 | 5개 | 0 |
| **Edge Functions** | 0개 | **5개** | **+5 (신규)** |
| **총계** | **38+개** | **52+개** | **+14** |

---

## @MX:ANCHOR 후보 변화

| 모듈 | Fan-in | 우선순위 | 상태 |
|------|--------|----------|------|
| `useSession` | 4+ | HIGH | 기존 |
| `useTheme` | 6+ | HIGH | 기존 |
| `tokens` | 3+ | MEDIUM | 기존 |
| `getSupabaseClient` | 임계적 | CRITICAL | 기존 |
| `supabaseStorageAdapter` | 1 | MEDIUM | 기존 |
| **`searchBooks`** | **3+ (예상)** | **HIGH** | **신규 (M3 구현 시)** |
| **`getBookDetail`** | **3+ (예상)** | **HIGH** | **신규 (M4 구현 시)** |

**총계:** 5개 → 7개 (+2)

---

## BOOK 모듈 주요 구성 요소

### Client-Side (`src/features/book/`)
1. **searchApi.ts**
   - `searchBooks(query, target)` → `SearchResult[]`
   - 빈 쿼리 차단 (REQ-BOOK-005)
   - `invokeEdgeFunction('kakao-book-search')` 경유

2. **bookDetailApi.ts**
   - `getBookDetail(bookId)` → `BookRow`
   - PostgREST 직접 조회 (Edge Function 경유 없음)
   - `normalizeError` → PGRST116→NOT_FOUND, 42501→RLS_DENIED

3. **types/book.ts**
   - `SearchResult` (Kakao 응답 정규화 스키마)
   - `BookRow` (books 테이블 Row 타입)
   - `SearchTarget` ('title' | 'author' | 'isbn')
   - 타입 가드: `isSearchResult`, `isBookRow`, `isSearchTarget`

### Edge Function (`supabase/functions/kakao-book-search/`)
1. **index.ts**
   - `handleSearchRequest` (의존성 주입 핸들러)
   - `Deno.serve` 셸 (환경 분기)
   - `createServiceRoleClient` (service_role 클라이언트)

2. **cacheManager.ts**
   - `findCachedBook(client, isbn)` → 캐시 히트 조회
   - `upsertBooks(client, rows[])` → 단일 배치 upsert (ON CONFLICT isbn)

3. **kakaoClient.ts**
   - `searchKakaoBooks({query, target, apiKey})`
   - `KakaoClientError` (타임아웃/네트워크/API 에러)
   - AbortController 타임아웃 (8000ms)

4. **normalizer.ts**
   - `normalizeKakaoDocuments` → 필수 필드 검증

5. **mapper.ts**
   - `mapToBookRow` → `authors[]` → `author` join

---

## 브랜치 정보

- **기준 브랜치:** develop (4424251 - AUTH+NAV)
- **현재 브랜치:** develop (852f0ac - AUTH+NAV+BOOK M1+M2)
- **추가된 커밋:** 852f0ac (SPEC-BOOK-001 M1+M2 머지)

---

## 미래 작업 (Deferred)

SPEC-BOOK-001 M3/M4는 아직 구현되지 않음 (코드맵에만 반영):

- **M3:** BookSearchScreen 구현 (검색 화면)
- **M3:** BarcodeScanner 통합 (ISBN 자동 전환)
- **M4:** BookDetailScreen 구현 (상세 화면)

이 모듈들이 구현되면 `searchBooks`, `getBookDetail`의 fan_in이 3+를 충족하여 @MX:ANCHOR 지정이 권장됨.

---

**검증 완료:** 2026-06-16
**업데이트 담당:** MoAI Documentation System
