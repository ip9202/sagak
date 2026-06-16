# 코드맵 업데이트 요약 (2026-06-16)

## 개요

본 문서는 두 단계의 업데이트를 누적 기록:

- **1차 (M1+M2):** SPEC-BOOK-001 M1+M2(852f0ac) 머지 반영 — Edge Function + 클라이언트 API
- **2차 (M3+M4):** SPEC-BOOK-001 M3+M4(a293e8d) 머지 반영 — 바코드 스캔 + 검색/상세 UI

> 기존 M1/M2 항목은 보존됨. 2차(M3/M4) 항목은 하단에 추가됨.

---


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

**검증 완료:** 2026-06-16 (M1/M2)
**업데이트 담당:** MoAI Documentation System

---
---

# 2차 업데이트: SPEC-BOOK-001 M3+M4 반영 (2026-06-16)

## 개요 (2차)

SPEC-BOOK-001 M3+M4(a293e8d) 머지 반영하여 6개 코드맵 파일을 증분 갱신함. M1/M2(API 계층) 위에 M3(바코드 스캔)과 M4(검색·상세 UI) delta를 추가 — 기존 내용 보존.

## 변경사항 요약 (2차)

### 1. overview.md
**변경 내용:**
- ✅ Architecture Layers 다이어그램에 BOOK 도메인 노드 확장: `BarcodeScanner · ISBN · Debounce`, `format 유틸`
- ✅ External Services에 `expo-camera` 추가 (Barcode Scanning)
- ✅ SPEC Coverage: SPEC-BOOK-001 상태 "M1+M2" → "M1~M4" (M3 바코드 스캔, M4 검색/상세 UI 포함)
- ✅ Foundation Complete에 바코드 스캔(M3), 검색/상세 UI(M4) 항목 추가
- ✅ High Fan-in Modules 테이블 확장: searchBooks/getBookDetail fan_in "3+ 예상" → "1 현재 → 3+ 예상", 신규 4개 항목 추가(formatPublishedMonth, isValidIsbn, shouldSuppressDuplicate, useSession 호출자 +1)
- ✅ Next Steps 재구성: M3/M4 완료로 제거, SPEC-LIBRARY-001(known-issue 해결)을 1순위로 이동
- ✅ 브랜치 정보: 852f0ac → a293e8d

**영향 범위:**
- Mermaid 다이어그램 (노드 3개 추가)
- SPEC Coverage (1행 갱신)
- Foundation Complete (2항목 추가)
- High Fan-in (4개 항목 추가/갱신)
- Next Steps (재구성)

---

### 2. modules.md
**변경 내용:**
- ✅ Presentation Layer: Library Tab 설명 갱신(검색 진입 CTA), 신규 라우트 2개 추가(Search Route href:null, Scan Route href:null)
- ✅ Book Detail 라우트 설명 갱신: SPEC-NAV-001 stub → BookDetailScreen 통합 교체
- ✅ Tabs Layout 설명 갱신: 숨김 라우트 등록
- ✅ Book Domain 섹션에 M3/M4 모듈 7개 추가:
  - `BarcodeScanner.tsx` (Presentation, REQ-BOOK-006~009)
  - `isbn.ts` (Business 순수함수, REQ-BOOK-007)
  - `debounce.ts` (Business 순수함수, REQ-BOOK-009)
  - `format.ts` (Business 순수함수, REQ-BOOK-014/015)
  - `BookSearchScreen.tsx` (Presentation, REQ-BOOK-005/016)
  - `BookDetailScreen.tsx` (Presentation, REQ-BOOK-015)
  - `__tests__/__mocks__/expo-camera.tsx` (Infrastructure Test)
- ✅ Components 섹션에 `SearchResultCard.tsx` 추가 (M4, BookCard와 분리)
- ✅ High Fan-in Modules: searchBooks/getBookDetail 상태 "예상" → "현재 1, 적용됨", 신규 3개 항목 추가(formatPublishedMonth, isValidIsbn, shouldSuppressDuplicate)
- ✅ 계층별 모듈 분포 업데이트:
  - Presentation: 13개 → 15개 (+2 숨김 라우트)
  - Business: 24개 → 33개 (+7 Book 도메인 M3/M4, +1 SearchResultCard, +1 테스트 인프라)

**영향 범위:**
- 모듈 카탈로그: 29+ → 38+ (Book 도메인 +7, 컴포넌트 +1, 라우트 +2)
- @MX:ANCHOR 적용 상태: 7개 후보 → 10개 (5개 M3/M4 신규 ANCHOR 적용)

---

### 3. dependencies.md
**변경 내용:**
- ✅ Dependency Graph 다이어그램에 M3/M4 노드 7개 추가:
  - B11(isbn), B12(debounce), B13(format), B14(BarcodeScanner), B15(BookSearchScreen), B16(BookDetailScreen), B17(SearchResultCard)
- ✅ External Services에 `expo-camera` 노드 추가
- ✅ 신규 엣지 9개 추가 (BarcodeScanner→isbn/debounce/expo-camera, BookSearchScreen→searchApi/SearchResultCard, BookDetailScreen→bookDetailApi/useSession/format, SearchResultCard→format)
- ✅ Import Matrix에 6개 새로운 섹션 추가:
  - `src/features/book/` 내부 (BarcodeScanner→isbn/debounce 등)
  - `app/(tabs)/` → `src/features/book/` (숨김 라우트 위임)
  - `src/features/book/` → `src/auth/` (BookDetailScreen→useSession 가드)
  - `src/features/book/` → `src/theme/` (4개 UI 컴포넌트)
  - `app/(tabs)/library.tsx` → expo-router (검색 CTA)
  - `src/features/book/` → expo-camera (외부)
- ✅ High Fan-in Analysis 재구성: #6/#7 상태 "예상"→"현재 1, 적용됨", #8~#10 신규(formatPublishedMonth, isValidIsbn, shouldSuppressDuplicate)
- ✅ Circular Dependency Check: BOOK M3/M4 의존성 분석 추가(순수함수 계층, BookDetailScreen→useSession 정방향)
- ✅ Recommendations: @MX:ANCHOR 적용 상태 10개로 갱신, known-issue(ISBN→bookId 매핑) 추가

**순환 의존성 검증 결과:** ✅ **없음 (M3/M4 추가 후에도 정상)**

**영향 범위:**
- Mermaid 다이어그램 (노드 8개, 엣지 9개 추가)
- Import Matrix (6개 새로운 섹션)
- @MX:ANCHOR: 7개 → 10개 (5개 신규 적용)

---

### 4. entry-points.md
**변경 내용:**
- ✅ Main Tabs 설명 갱신: "4 Tabs" → "4 Visible Tabs + 3 Hidden Routes"
- ✅ Library Tab: 검색 진입 CTA(router.push('/search')) 명시
- ✅ Dynamic Routes: [bookId] 설명 갱신(통합/가드), 신규 Hidden Routes 섹션 추가(/search, /scan)
- ✅ Entry Point Invocation Summary에 3행 추가: /search, /scan, /book/{bookId}
- ✅ Entry Point Dependency Graph에 Library→/search→/scan→/book 플로우 추가

**영향 범위:**
- Main Tabs (재구성)
- Dynamic Routes (갱신 + Hidden Routes 섹션 추가)
- Invocation Summary (3행 추가)
- Dependency Graph (Library 분기 추가)

---

### 5. data-flow.md
**변경 내용:**
- ✅ 헤더 갱신: M1/M2 API + M3/M4 UI 명시
- ✅ Data Flow Health Check에 3행 추가: Manual Search (M4), Barcode Scan (M3), Book Detail UI (M4)
- ✅ **신규 섹션 7:** Manual Search Flow (M4) — BookSearchScreen → searchBooks → SearchResultCard → onSelectBook → /book/{isbn} 시퀀스 다이어그램
- ✅ **신규 섹션 8:** Barcode Scan Flow (M3) — BarcodeScanner 권한 게이트 3상태 → ISBN 검증 → 디바운스(2000ms) → 자동 검색 전환 시퀀스 다이어그램
- ✅ **신규 섹션 9:** Book Detail UI Flow (M4) — BookDetailScreen → useSession 가드 → getBookDetail → BookRow/NOT_FOUND(S20)/RLS_DENIED(S22) 3상태 분기 시퀀스 다이어그램
- ✅ 각 섹션에 Permission States 표, Key Implementation, known-issue(ISBN→bookId 매핑) 참조 포함

**영향 범위:**
- Mermaid 시퀀스 다이어그램 3개 추가
- 데이터 흐름 섹션 3개 추가 (각 60-90 라인)
- Health Check 테이블 (3행 추가)

---

## 순환 의존성 검증 결과 (2차)

**결론:** ✅ **순환 의존성 없음 (M3/M4 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app/` → `src/` (단방향)
2. ✅ `src/features/book/` → `src/lib/api/` → `src/lib/supabase/` (단방향)
3. ✅ `src/features/book/` 내부 순수함수 계층 (isbn/debounce/format, 외부 의존성 없음)
4. ✅ `BookDetailScreen` → `useSession` (정방향 가드, 역방향 아님)
5. ✅ `expo-camera`는 외부 의존성 (BarcodeScanner만 사용)
6. ✅ `src/auth/`는 `src/features/book/`를 임포트하지 않음

---

## 모듈 수 변화 (2차)

| 계층 | 1차 후 (M1/M2) | 2차 후 (M3/M4) | 증가 |
|------|---------------|---------------|------|
| **Presentation (app/)** | 13개 | 15개 | +2 (search, scan 숨김 라우트) |
| **Business (src/)** | 29+개 | 38+개 | +9 |
| ├── AUTH | 6개 | 6개 | 0 |
| ├── Theme | 3개 | 3개 | 0 |
| ├── API | 4개 | 4개 | 0 |
| ├── Types | 3개 | 3개 | 0 |
| ├── **Book Domain** | 3개 | **9개** | **+6 (M3/M4)** |
| ├── Components | 6개 | 7개 | +1 (SearchResultCard) |
| └── Test Infra | 0개 | 1개 | +1 (expo-camera mock) |
| **Infrastructure (src/lib/)** | 5개 | 5개 | 0 |
| **Edge Functions** | 5개 | 5개 | 0 |
| **총계** | **52+개** | **63+개** | **+11** |

---

## @MX:ANCHOR 적용 변화 (2차)

| 모듈 | Fan-in | 우선순위 | 1차 상태 | 2차 상태 |
|------|--------|----------|---------|---------|
| `useSession` | 5+ | HIGH | 후보 | 적용됨 (BookDetailScreen 호출자 추가) |
| `useTheme` | 6+ | HIGH | 후보 | 적용됨 |
| `tokens` | 4+ | MEDIUM | 후보 | 적용됨 (BarcodeScanner/BookSearchScreen 호출자 추가) |
| `getSupabaseClient` | 임계적 | CRITICAL | 후보 | 적용됨 |
| `searchBooks` | 1 → 3+ 예상 | HIGH | 후보(M3 구현 시) | **적용됨 (M4 완료)** |
| `getBookDetail` | 1 → 3+ 예상 | HIGH | 후보(M4 구현 시) | **적용됨 (M4 완료)** |
| **`formatPublishedMonth`** | 2 | MEDIUM | - | **신규 적용 (M4)** |
| **`isValidIsbn`** | 1 | MEDIUM | - | **신규 후보 (M3)** |
| **`shouldSuppressDuplicate`** | 1 | MEDIUM | - | **신규 후보 (M3)** |
| **`BarcodeScanner.tsx`** | - | - | - | **신규 적용 (M3)** |
| **`BookSearchScreen.tsx`** | - | - | - | **신규 적용 (M4)** |
| **`BookDetailScreen.tsx`** | - | - | - | **신규 적용 (M4)** |
| **`debounce.ts`** | - | - | - | **신규 적용 (M3)** |

**총계:** 7개 후보 → 10개 적용 + 2개 후보 (M3/M4로 5개 신규 적용)

---

## BOOK M3/M4 주요 구성 요소

### M3: 바코드 스캔 계층 (`src/features/book/`)

1. **BarcodeScanner.tsx** (Presentation)
   - `useCameraPermissions` 권한 게이트 3상태 (null/granted/denied)
   - `CameraView` + `barcodeScannerSettings` (expo-camera)
   - `onBarcodeScanned` → ISBN 검증 → 디바운스 → 라우팅

2. **isbn.ts** (Business 순수함수)
   - `isValidIsbn`, `isValidIsbn13`, `isValidIsbn10` 체크디짓 검증 (REQ-BOOK-007)

3. **debounce.ts** (Business 순수함수)
   - `shouldSuppressDuplicate`, `DUPLICATE_DEBOUNCE_MS=2000` (REQ-BOOK-009)

4. **__tests__/__mocks__/expo-camera.tsx** (Test Infra)
   - Jest용 expo-camera 목, `simulateBarcodeScan` 헬퍼

### M4: 검색·상세 UI 계층 (`src/features/book/` + `src/components/`)

1. **BookSearchScreen.tsx** (Presentation)
   - `searchBooks` 연동, 빈 쿼리 차단, 빈 결과 안내 (REQ-BOOK-005/016)

2. **BookDetailScreen.tsx** (Presentation)
   - `getBookDetail` + `useSession` 가드 (S22 RLS 거부 사전 차단) (REQ-BOOK-015)

3. **SearchResultCard.tsx** (Presentation, `src/components/`)
   - 검색 결과 카드 (BookCard와 분리), `formatPublishedMonth` 사용 (REQ-BOOK-014)

4. **format.ts** (Business 순수함수)
   - `formatPublishedMonth` (YYYY.MM) — SearchResultCard, BookDetailScreen 공유

### 라우트 통합 (`app/(tabs)/`)

- `search.tsx` (href:null) → BookSearchScreen 위임
- `scan.tsx` (href:null, 풀스크린) → BarcodeScanner 위임
- `[bookId].tsx` (동적) → SPEC-NAV-001 stub → BookDetailScreen 통합 교체
- `library.tsx` (수정) → 검색 진입 CTA(`router.push('/search')`) 추가
- `_layout.tsx` (수정) → search/scan/[bookId] 스크린 등록

---

## 신규 아키텍처 하이라이트 (M3/M4)

### 1. 분리된 UI 계층

M3/M4는 기존 API 계층(M1/M2) 위에 UI 계층을 분리하여 추가:

```
API 계층 (M1/M2):          UI 계층 (M3/M4):
├── searchApi.ts     ←──── BookSearchScreen.tsx
├── bookDetailApi.ts ←──── BookDetailScreen.tsx
└── (Edge Function)        ├── BarcodeScanner.tsx
                           └── SearchResultCard.tsx
```

UI 컴포넌트는 API를 호출하지만, API는 UI를 모름 — 단방향 의존성 유지.

### 2. 순수함수 모듈화 패턴

검증/포맷/디바운스 로직을 외부 의존성 없는 순수함수로 분리:

```
src/features/book/
├── isbn.ts       (체크디짓 알고리즘 — 테스트 용이)
├── debounce.ts   (중복 스캔 방지 — 시간 기반)
└── format.ts     (날짜 포맷 — 공유 유틸)
```

특징:
- 외부 상태/의존성 없음 (테스트确定性)
- 재사용성 (format은 SearchResultCard, BookDetailScreen 공유)
- @MX:ANCHOR 적용으로 계약 명시

### 3. 권한 게이트 + 가드 패턴

- **카메라 권한:** `useCameraPermissions` 3상태(null/granted/denied) 게이트
- **인증 가드:** `BookDetailScreen` → `useSession` (RLS 거부 S22 사전 차단)
- **디바운스:** `shouldSuppressDuplicate` (2000ms 윈도우 중복 스캔 차단)

---

## known-issue (참고)

- **ISBN→bookId 매핑:** `search.tsx`는 `/book/${isbn}`으로 이동하지만 `[bookId].tsx`는 UUID 기대. 현재 BookDetailScreen 통합 후에도 매항 불일치 잠재. **SPEC-LIBRARY-001**에서 해결 예정.

---

## 브랜치 정보 (2차)

- **1차 기준:** develop (4424251 - AUTH+NAV → 852f0ac - BOOK M1+M2)
- **2차 기준:** develop (852f0ac - BOOK M1+M2 → a293e8d - BOOK M3+M4)
- **추가된 커밋:** a293e8d (SPEC-BOOK-001 M3+M4 머지)

---

**검증 완료:** 2026-06-16 (M3/M4)
**업데이트 담당:** MoAI Documentation System
