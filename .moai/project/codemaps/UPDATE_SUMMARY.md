# 코드맵 업데이트 요약 (2026-06-16)

## 개요

본 문서는 다섯 단계의 업데이트를 누적 기록:

- **1차 (M1+M2):** SPEC-BOOK-001 M1+M2(852f0ac) 머지 반영 — Edge Function + 클라이언트 API
- **2차 (M3+M4):** SPEC-BOOK-001 M3+M4(a293e8d) 머지 반영 — 바코드 스캔 + 검색/상세 UI
- **3차 (OAuth):** PR #11(c6630ae) 머지 반영 — OAuth provider 변경 (apple → naver)
- **4차 (EMOTION):** SPEC-EMOTION-001(a1ce6cf) 머지 반영 — 감정 아카이브 및 스티커 반응
- **5차 (COMPLETION):** SPEC-COMPLETION-001(463996e) 머지 반영 — 완독 다이어리 시각화
- **6차 (DEPLOY):** SPEC-DEPLOY-001 M1+M5(2514263) 머지 반영 — 환경 변수 검증 + EAS 빌드 프로필 + 배포 매뉴얼

> 기존 1~5차 항목은 보존됨. 6차(DEPLOY) 항목은 하단에 추가됨.

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

---
---

# 3차 업데이트: PR #11 OAuth provider 변경 (2026-06-17)

## 개요 (3차)

PR #11 머지 반영하여 OAuth provider 변경을 코드맵에 갱신함. apple → naver 변경 (최종 조합: kakao/naver/google).

## 변경사항 요약 (3차)

### 1. modules.md
**변경 내용:**
- ✅ Auth Types (`src/auth/types.ts`)의 AuthProvider 타입 정의 갱신: `'kakao'|'apple'|'google'` → `'kakao'|'naver'|'google'`

**영향 범위:**
- 모듈 카탈로그: 1행 갱신

---

### 2. data-flow.md
**변경 내용:**
- ✅ Auth Guard Flow 섹션의 useSession 반환 타입 갱신: `signInWithProvider: (provider: 'kakao' | 'apple' | 'google')` → `'kakao' | 'naver' | 'google'`

**영향 범위:**
- 데이터 흐름 문서: 1행 갱신

---

### 3. UPDATE_SUMMARY.md (본 파일)
**변경 내용:**
- ✅ 본 섹션 추가 (3차 업데이트 기록)

---

## PR #11 배경

**변경 이유:** 한국 시장 주류 OAuth 제공자 조합 반영 (kakao/naver/google). Apple 제외 이유:
- App Store 4.8 한국 예외 규정 (대안 인증 수단 허용)
- Supabase Custom OIDC로 naver 연동 (SPEC-DEPLOY-001 시점)

**최종 제공자:** kakao, naver, google

---

## 브랜치 정보 (3차)

- **2차 기준:** develop (a293e8d - BOOK M3+M4)
- **3차 기준:** develop (c6630ae - PR #11 OAuth provider 변경)
- **추가된 커밋:** c6630ae (PR #11 머지)

---

**검증 완료:** 2026-06-17 (PR #11)
**업데이트 담당:** MoAI Documentation System

---

# 4차 업데이트: SPEC-EMOTION-001 구현 완료 (2026-06-17)

## 개요 (4차)

SPEC-EMOTION-001 구현 완료(a1ce6cf) 반영하여 감정 아카이브 및 스티커 반응 기능을 코드맵에 갱신함. 8개 source 파일 + 10개 test 파일, 1333 LOC source, 10 REQ coverage, 92.47% coverage.

## 변경사항 요약 (4차)

### 1. modules.md
**변경 내용:**
- ✅ Components 섹션 갱신: StickerReaction 설명 추가("3종 스티커: empathy/touching/comforted"), EmotionRecordCard 설명 추가("스포일러 블러 12px, 아바타+닉네임+페이지+본문+스티커")
- ✅ **신규 섹션:** Emotion Domain (`src/features/emotion/`) 추가
  - `index.ts` (barrel)
  - `types.ts` (EmotionRecordWithAuthor, StickerAggregate, Visibility, CreateInput, UpdateInput, SortOption)
  - `emotionApi.ts` (PostgREST 직접, create/list/update/delete, client-side pre-validation, sticker GROUP BY)
  - `stickerApi.ts` (precheck/create/delete/aggregate, 409 UNIQUE→VALIDATION mapping via normalizeError, no upsert)
  - `useEmotionRecords.ts` (React Query 훅, queryKey ['emotion',{bookId,userId}], cache invalidation)
  - `useStickerReaction.ts` (optimistic update + 409 rollback, useReplaceSticker DELETE→POST)
  - `questionPrompts.ts` (정적 풀 5개, round-robin by currentPage seed)
  - `EmotionInputScreen.tsx` (입력 화면, page/content/question/visibility toggle, pageNumber validation)
  - `TimelineScreen.tsx` (EmotionRecordCard list, sort toggle time/page, spoiler blur via isSpoiler prop)
- ✅ 계층별 모듈 분포 업데이트:
  - Business: 38+개 → 46+개 (+8 Emotion 도메인)

**영향 범위:**
- 모듈 카탈로그: 63+ → 71+ (Emotion 도메인 +8)
- @MX:ANCHOR 후보: 10개 → 12개 (emotionApi, stickerApi 추가 예상)

---

### 2. data-flow.md
**변경 내용:**
- ✅ 헤더 갱신: EMOTION-001 추가
- ✅ **신규 섹션 9:** Emotion Record Flow (감정 기록 CRUD) — EmotionInputScreen → useEmotionRecords → emotionApi → PostgREST → RLS → sticker aggregate 시퀀스 다이어그램
- ✅ **신규 섹션 10:** Sticker Reaction Flow (스티커 반응 + 409 처리) — useStickerReaction → precheck → DELETE→POST (useReplaceSticker) / 409 UNIQUE→VALIDATION mapping 시퀀스 다이어그램
- ✅ Data Flow Summary 테이블에 2행 추가: Emotion Record CRUD, Sticker Reaction

**영향 범위:**
- Mermaid 시퀀스 다이어그램 2개 추가
- 데이터 흐름 섹션 2개 추가 (각 80-100 라인)
- Data Flow Summary (2행 추가)

---

### 3. entry-points.md
**변경 내용:**
- ✅ Entry Point Invocation Summary에 4행 추가: emotionApi.create, emotionApi.list, stickerApi.create, useStickerReaction.toggle
- ✅ 각 진입점에 EMOTION-001 REQ 참조 추가

**영향 범위:**
- Entry Point Invocation Summary (4행 추가)

---

### 4. overview.md
**변경 내용:**
- ✅ SPEC Coverage 테이블: SPEC-EMOTION-001 추가 (Status: ✅ Complete, 2026-06-17, Key Components 상세 설명)
- ✅ Current State: 감정 아카이브 항목 추가 (10 REQ coverage, 627/627 tests pass, 92.47% coverage)
- ✅ Next Steps 재구성: SPEC-RECORD-001 제거(EMOTION-001으로 완료), SPEC-FEED-001을 1순위로 이동, 테스트 커버리지 85%+ 달성 완료 표시
- ✅ 브랜치 정보: c6630ae → a1ce6cf

**영향 범위:**
- SPEC Coverage (1행 추가)
- Current State (1항목 추가)
- Next Steps (재구성)

---

## SPEC-EMOTION-001 구현 요약

### Files Created (8 source + 10 tests)

**Source files (1333 LOC):**
1. `src/features/emotion/types.ts` — DB Row derived types
2. `src/features/emotion/emotionApi.ts` — create (pre-validate) / list (users join + sticker GROUP BY) / update / delete
3. `src/features/emotion/stickerApi.ts` — precheck / create (409 UNIQUE→VALIDATION mapping) / delete / aggregate
4. `src/features/emotion/useEmotionRecords.ts` — React Query hook (queryKey root, mutations, cache invalidation)
5. `src/features/emotion/useStickerReaction.ts` — optimistic update + 409 rollback + useReplaceSticker (DELETE→POST)
6. `src/features/emotion/questionPrompts.ts` — static pool (5 prompts, round-robin by currentPage)
7. `src/features/emotion/EmotionInputScreen.tsx` — input screen (page/content/question/visibility toggle)
8. `src/features/emotion/TimelineScreen.tsx` — timeline (EmotionRecordCard list, sort toggle, spoiler blur)

**Test files (627 tests pass, 92.47% coverage):**
- `types.test.ts` — Type validation
- `emotionApi.create.test.ts` — Create scenarios (EC-1 pre-validate)
- `emotionApi.list.test.ts` — List scenarios (EC-7, EC-8 client split)
- `emotionApi.updateDelete.test.ts` — Update/Delete scenarios
- `stickerApi.test.ts` — Sticker scenarios (EC-11 409 mapping)
- `useEmotionRecords.test.tsx` — React Query hook (cache invalidation)
- `useStickerReaction.test.tsx` — Sticker hook (optimistic update, rollback)
- `questionPrompts.test.ts` — Round-robin logic
- `EmotionInputScreen.test.tsx` — Input screen UI (EC-12 maxLength 120)
- `TimelineScreen.test.tsx` — Timeline UI (EC-5, EC-7, EC-8)

### REQ Coverage

- REQ-EMO-001: 감정 기록 생성 ✅
- REQ-EMO-002: 감정 기록 조회 (스포일러 필터 + 작성자 조인 + 스티커 집계) ✅
- REQ-EMO-003: 감정 기록 수정 ✅
- REQ-EMO-004: 감정 기록 삭제 ✅
- REQ-EMO-005: 단어 질문지 제안 ✅
- REQ-EMO-006: 스티커 반응 등록 ✅
- REQ-EMO-007: 스티커 반응 취소 ✅
- REQ-EMO-008: 스포일러 블러 처리 ✅
- REQ-EMO-009: 타임라인 뷰 (페이지순/시간순) ✅
- REQ-EMO-010: 공개 범위 제어 ✅

**Total: 10/10 REQ covered (100%)**

### Key Architecture Decisions

1. **PostgREST 직접 호출**: Edge Function 없이 PostgREST 직접 호출 (단순 CRUD)
2. **스티커 409 no-upsert**: UNIQUE 위반 시 업서트 대신 DELETE→POST 재등록 유도 패턴
3. **Sticker GROUP BY realtime**: 클라이언트에서 시뮬레이션 (MVP 단순화)
4. **Spoiler blur client-side**: list API에서 current_page 기준 split 후 UI에 isSpoiler prop 전달
5. **Question prompts 정적 풀**: MVP에서 5개 정적 질문 라운드 로빈 (진도 구간 매핑은 v1.1.0 연기)

### Test Results

- 627/627 tests pass
- 92.47% statements coverage (target 85%+ exceeded)
- 87.73% branches coverage
- 96.15% functions coverage
- 92.34% lines coverage

### Known MINOR Follow-ups

1. **bookTitle 필요성**: listEmotionRecords에서 books 테이블 조인으로 book_title 추가 (deferred, 현재는 book_id만)
2. **normalizeError 패턴 확인**: 409 UNIQUE→VALIDATION mapping 정상 동작 확인 완료 (no change needed)

---

## 순환 의존성 검증 결과 (4차)

**결론:** ✅ **순환 의존성 없음 (EMOTION 모듈 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app/` → `src/` (단방향)
2. ✅ `src/features/emotion/` → `src/lib/api/` → `src/lib/supabase/` (단방향)
3. ✅ `src/features/emotion/` → `src/lib/query/` (단방향)
4. ✅ `src/features/emotion/` → `src/components/` (단방향, EmotionRecordCard/StickerReaction 소비)
5. ✅ `src/components/` 는 `src/features/emotion/`를 임포트하지 않음

---

## 모듈 수 변화 (4차)

| 계층 | 3차 후 (PR #11) | 4차 후 (EMOTION-001) | 증가 |
|------|---------------|---------------------|------|
| **Presentation (app/)** | 15개 | 15개 | 0 |
| **Business (src/)** | 38+개 | 46+개 | +8 |
| ├── AUTH | 6개 | 6개 | 0 |
| ├── Theme | 3개 | 3개 | 0 |
| ├── API | 4개 | 4개 | 0 |
| ├── Types | 3개 | 3개 | 0 |
| ├── Book Domain | 9개 | 9개 | 0 |
| ├── Library Domain | 6개 | 6개 | 0 |
| ├── **Emotion Domain** | 0개 | **8개** | **+8 (신규)** |
| └── Components | 7개 | 7개 | 0 |
| **Infrastructure (src/lib/)** | 5개 | 5개 | 0 |
| **Edge Functions** | 5개 | 5개 | 0 |
| **총계** | **63+개** | **71+개** | **+8** |

---

## @MX:ANCHOR 후보 변화 (4차)

| 모듈 | Fan-in | 우선순위 | 3차 상태 | 4차 상태 |
|------|--------|----------|---------|---------|
| `useSession` | 5+ | HIGH | 적용됨 | 적용됨 |
| `useTheme` | 6+ | HIGH | 적용됨 | 적용됨 |
| `tokens` | 4+ | MEDIUM | 적용됨 | 적용됨 |
| `getSupabaseClient` | 임계적 | CRITICAL | 적용됨 | 적용됨 |
| `searchBooks` | 1+ | HIGH | 적용됨 | 적용됨 |
| `getBookDetail` | 1+ | HIGH | 적용됨 | 적용됨 |
| **`emotionApi`** | **2+ (예상)** | **HIGH** | **-** | **신규 후보** |
| **`stickerApi`** | **2+ (예상)** | **HIGH** | **-** | **신규 후보** |

**총계:** 10개 → 12개 (+2 신규 후보)

---

## 브랜치 정보 (4차)

- **3차 기준:** develop (c6630ae - PR #11 OAuth provider 변경)
- **4차 기준:** develop (a1ce6cf - SPEC-EMOTION-001 구현 완료)
- **추가된 커밋:** a1ce6cf (PR #12 머지)

---

**검증 완료:** 2026-06-17 (SPEC-EMOTION-001)
**업데이트 담당:** MoAI Documentation System

---

# 5차 업데이트: SPEC-COMPLETION-001 구현 완료 (2026-06-17)

## 개요 (5차)

SPEC-COMPLETION-001 구현 완료(463996e) 반영하여 완독 다이어리 시각화 기능을 코드맵에 갱신함. 7개 source 파일 + 4개 test 파일, 683 tests pass, 91.92% coverage.

## 변경사항 요약 (5차)

### 1. modules.md
**변경 내용:**
- ✅ **신규 섹션:** Completion Domain (`src/features/completion/`) 추가
  - `index.ts` (barrel)
  - `types.ts` (ReportData, EmotionCurvePoint, Highlight, isReportData 순수 타입 가드)
  - `completionApi.ts` (fetchReport — PostgREST GET 래퍼 + 재시도 최대3 + 점진백오프 + normalizeError, RLS auth.uid() 신뢰)
  - `useCompletionReport.ts` (useState/useEffect 기반 6상태 훅: loading/success/empty/error/data-error/auth)
  - `EmotionCurveChart.tsx` (순수 SVG, 단일 brand-500 색상, 페이지별 수량)
  - `HighlightList.tsx` (FlatList, text.inverse 스타일)
  - `CelebrationHeader.tsx` (정적 배지 + 축하 메시지 MVP)
  - `CompletionDiaryScreen.tsx` (메인 통합 화면, 6상태 분기 렌더링)
- ✅ 계층별 모듈 분포 업데이트:
  - Business: 46+개 → 53+개 (+7 Completion 도메인)

**영향 범위:**
- 모듈 카탈로그: 71+ → 78+ (Completion 도메인 +7)
- @MX:ANCHOR 후보: 12개 → 13개 (completionApi 추가 예상)

---

### 2. data-flow.md
**변경 내용:**
- ✅ 헤더 갱신: COMPLETION-001 추가
- ✅ **신규 섹션 11:** Completion Report Flow (완독 다이어리 시각화) — CompletionDiaryScreen → useCompletionReport → completionApi → PostgREST → 재시도 사이클(최대3) → isReportData() 타입 가드 → 6상태 분기(loading/success/empty/error/data-error/auth) 시퀀스 다이어그램
- ✅ Data Flow Summary 테이블에 1행 추가: Completion Report

**영향 범위:**
- Mermaid 시퀀스 다이어그램 1개 추가
- 데이터 흐름 섹션 1개 추가 (약 120-150 라인)
- Data Flow Summary (1행 추가)

---

### 3. entry-points.md
**변경 내용:**
- ✅ Entry Point Invocation Summary에 1행 추가: completionApi.fetchReport
- ✅ 진입점에 COMPLETION-001 REQ 참조 추가

**영향 범위:**
- Entry Point Invocation Summary (1행 추가)

---

### 4. overview.md
**변경 내용:**
- ✅ SPEC Coverage 테이블: SPEC-COMPLETION-001 추가 (Status: ✅ Complete, 2026-06-17, Key Components 상세 설명)
- ✅ Current State: 완독 다이어리 항목 추가 (10 REQ coverage, 683/683 tests pass, 91.92% coverage)
- ✅ 브랜치 정보: a1ce6cf → 463996e

**영향 범위:**
- SPEC Coverage (1행 추가)
- Current State (1항목 추가)

---

### 5. dependencies.md
**변경 내용:**
- ✅ Dependency Graph 다이어그램에 COMPLETION 모듈 노드 7개 추가:
  - CMP1(types), CMP2(completionApi), CMP3(useCompletionReport), CMP4(EmotionCurveChart), CMP5(HighlightList), CMP6(CelebrationHeader), CMP7(CompletionDiaryScreen)
- ✅ 신규 엣지 8개 추가 (Completion 내부 의존성 + Supabase/Error API/Theme)
- ✅ Import Matrix에 3개 새로운 섹션 추가:
  - `src/features/completion/` → `src/lib/api/` (normalizeError)
  - `src/features/completion/` → `src/lib/supabase/` (getSupabaseClient)
  - `src/features/completion/` → `src/theme/` (Design tokens)
- ✅ High Fan-in Analysis에 #13 신규 추가: completionApi (fetchReport)
- ✅ Circular Dependency Check: COMPLETION 의존성 분석 추가(단방향 흐름 검증)

**순환 의존성 검증 결과:** ✅ **없음 (COMPLETION 모듈 추가 후에도 정상)**

**영향 범위:**
- Mermaid 다이어그램 (노드 7개, 엣지 8개 추가)
- Import Matrix (3개 새로운 섹션)
- @MX:ANCHOR: 12개 → 13개 (+1 신규 후보)

---

### 6. INDEX.md + structure.md
**변경 내용:**
- ✅ INDEX.md: SPEC-COMPLETION-001 상태 갱신 ("구현 완료 (10/10 REQ, PR #14 머지 463996e, 2026-06-17, 커버리지 91.92%)")
- ✅ INDEX.md: Phase 2 구현 완료 SPEC 테이블에 COMPLETION-001 추가
- ✅ structure.md: `src/features/completion/` 도메인 설명 추가 (7개 모듈 상세)

**영향 범위:**
- INDEX.md (2개 섹션 갱신: 상세 상태 + 진행표)
- structure.md (1개 섹션 추가: Completion 도메인)

---

## SPEC-COMPLETION-001 구현 요약

### Files Created (7 source + 4 tests)

**Source files:**
1. `src/features/completion/types.ts` — ReportData/EmotionCurvePoint/Highlight + isReportData() 순수 타입 가드
2. `src/features/completion/completionApi.ts` — fetchReport (PostgREST GET 래퍼 + 재시도 최대3 + 점진백오프 + normalizeError, RLS auth.uid() 신뢰)
3. `src/features/completion/useCompletionReport.ts` — useState/useEffect 기반 6상태 훅 (loading/success/empty/error/data-error/auth)
4. `src/features/completion/EmotionCurveChart.tsx` — 순수 SVG 감정 곡선 (단일 brand-500 색상, 페이지별 수량)
5. `src/features/completion/HighlightList.tsx` — FlatList 하이라이트 (text.inverse 스타일)
6. `src/features/completion/CelebrationHeader.tsx` — 정적 배지 + 축하 메시지 MVP
7. `src/features/completion/CompletionDiaryScreen.tsx` — 메인 통합 화면 (6상태 분기 렌더링)

**Test files (683 tests pass, 91.92% coverage):**
- `types.test.ts` — Type validation (isReportData)
- `completionApi.test.ts` — fetchReport scenarios (retry logic, error classification, empty response)
- `useCompletionReport.test.tsx` — 6상태 훅 (loading/success/empty/error/data-error/auth 분기)
- `EmotionCurveChart.test.tsx` — SVG 차트 렌더링
- `HighlightList.test.tsx` — FlatList 렌더링
- `CelebrationHeader.test.tsx` — 정적 배지 렌더링
- `CompletionDiaryScreen.test.tsx` — 6상태 분기 UI

### REQ Coverage

- REQ-COMP-001: 완독 리포트 존재 확인 ✅
- REQ-COMP-002: 완독 다이어리 진입 버튼 ✅ (계약만 정의, 구현 연기 — SPEC-LIBRARY-001 협력)
- REQ-COMP-003: report_data 구조 준수 ✅
- REQ-COMP-004: 재시도 로직 ✅ (NETWORK/빈응답 재시도, VALIDATION/AUTH 즉시 throw)
- REQ-COMP-005: 6상태 분기 렌더링 ✅ (loading/success/empty/error/data-error/auth)
- REQ-COMP-006: 감정 곡선 시각화 ✅ (순수 SVG, 단일 brand-500 색상, 페이지별 수량)
- REQ-COMP-007: 하이라이트 표시 ✅ (FlatList, text.inverse)
- REQ-COMP-008: 축하 헤더 ✅ (정적 배지 + 축하 메시지 MVP)
- REQ-COMP-009: 빈 상태 처리 ✅ (total_records === 0)
- REQ-COMP-010: 에러 상태 분기 ✅ (error/data-error/auth)

**Total: 10/10 REQ covered (100%)**

### Key Architecture Decisions

1. **report_data 읽기 전용**: DB 트리거가 자동 생성한 report_data를 수정/재계산하지 않고 읽기만 함
2. **재시도 로직**: NETWORK 에러 또는 빈 응답(`data: null, error: null`)만 재시도(최대 3회, 점진 백오프). VALIDATION/AUTH 에러는 즉시 throw
3. **RLS 신뢰**: `user_id` 미전송. RLS 정책(`auth.uid() = user_id`)에 의해 본인 리포트만 자동 필터링
4. **순수 타입 가드**: Zod 제거, `isReportData()` 순수 타입 가드로 런타임 검증 (2026-06-17 결정)
5. **6상태 분기**: useState/useEffect 기반 6상태 훅 (loading/success/empty/error/data-error/auth). 각 상태별 명확한 UI 분기
6. **단일 brand-500**: REQ-COMP-006 결정 — 감정별 색상 대신 단일 brand-500 토큰 사용 (디자인 일관성)
7. **진입 버튼 계약**: REQ-COMP-002는 완독 다이어리 진입 버튼 UI 계약만 정의. 실제 구현은 SPEC-LIBRARY-001과 협력 필요

### Test Results

- 683/683 tests pass
- 91.92% statements coverage (target 85%+ exceeded)
- 85.55% branches coverage
- 96.79% functions coverage
- 93.62% lines coverage

### Known Follow-ups

1. **진입 버튼 협력 (REQ-COMP-002)**: 완독 다이어리 진입 버튼 UI 구현은 SPEC-LIBRARY-001과 협력 필요 (BookDetailScreen 또는 LibraryScreen에 버튼 배치)
2. **report_data 갱신 (후순위)**: 현재는 완독 시점 스냅샷만 제공. 이후 감정 기록 추가 시 자동 갱신 기능은 v1.1.0 연기

---

## 순환 의존성 검증 결과 (5차)

**결론:** ✅ **순환 의존성 없음 (COMPLETION 모듈 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app/` → `src/` (단방향)
2. ✅ `src/features/completion/` → `src/lib/api/` → `src/lib/supabase/` (단방향)
3. ✅ `src/features/completion/` → `src/theme/` (단방향)
4. ✅ `src/features/completion/` → `src/types/` (단방향)
5. ✅ `src/features/completion/`는 `src/features/emotion/`를 임포트하지 않음 (데이터는 DB 트리거가 제공)

---

## 모듈 수 변화 (5차)

| 계층 | 4차 후 (EMOTION-001) | 5차 후 (COMPLETION-001) | 증가 |
|------|---------------------|----------------------|------|
| **Presentation (app/)** | 15개 | 15개 | 0 |
| **Business (src/)** | 46+개 | 53+개 | +7 |
| ├── AUTH | 6개 | 6개 | 0 |
| ├── Theme | 3개 | 3개 | 0 |
| ├── API | 4개 | 4개 | 0 |
| ├── Types | 3개 | 3개 | 0 |
| ├── Book Domain | 9개 | 9개 | 0 |
| ├── Library Domain | 6개 | 6개 | 0 |
| ├── Emotion Domain | 8개 | 8개 | 0 |
| ├── **Completion Domain** | 0개 | **7개** | **+7 (신규)** |
| └── Components | 7개 | 7개 | 0 |
| **Infrastructure (src/lib/)** | 5개 | 5개 | 0 |
| **Edge Functions** | 5개 | 5개 | 0 |
| **총계** | **71+개** | **78+개** | **+7** |

---

## @MX:ANCHOR 후보 변화 (5차)

| 모듈 | Fan-in | 우선순위 | 4차 상태 | 5차 상태 |
|------|--------|----------|---------|---------|
| `useSession` | 5+ | HIGH | 적용됨 | 적용됨 |
| `useTheme` | 6+ | HIGH | 적용됨 | 적용됨 |
| `tokens` | 4+ | MEDIUM | 적용됨 | 적용됨 |
| `getSupabaseClient` | 임계적 | CRITICAL | 적용됨 | 적용됨 |
| `searchBooks` | 1+ | HIGH | 적용됨 | 적용됨 |
| `getBookDetail` | 1+ | HIGH | 적용됨 | 적용됨 |
| `emotionApi` | 2+ (예상) | HIGH | 신규 후보 | 신규 후보 |
| `stickerApi` | 2+ (예상) | HIGH | 신규 후보 | 신규 후보 |
| **`completionApi`** | **2+ (예상)** | **HIGH** | **-** | **신규 후보** |

**총계:** 12개 → 13개 (+1 신규 후보)

---

## 브랜치 정보 (5차)

- **4차 기준:** develop (a1ce6cf - SPEC-EMOTION-001 구현 완료)
- **5차 기준:** develop (463996e - SPEC-COMPLETION-001 구현 완료)
- **추가된 커밋:** 463996e (PR #14 머지)

---

**검증 완료:** 2026-06-17 (SPEC-COMPLETION-001)
**업데이트 담당:** MoAI Documentation System

---

# 6차 업데이트: SPEC-DEPLOY-001 M1+M5 반영 (2026-06-17)

## 개요 (6차)

SPEC-DEPLOY-001 M1+M5(2514263) 머지 반영하여 환경 변수 검증 + EAS 빌드 프로필 + 배포 매뉴얼을 코드맵에 갱신함. SPEC-DEPLOY-001은 **부분 진행** 상태(M1+M5만 머지, M2/M3/M4/M6 미완료).

> SPEC-DEPLOY-001 M1+M5: env validation + EAS profiles + deployment manual synced (PR #15, 2514263)

## 변경사항 요약 (6차)

### 1. modules.md
**변경 내용:**
- ✅ **신규 섹션:** Config / Environment (`src/config/`) 추가 — `env.ts` (getEnvVar/getOptionalEnvVar + validateEnv/MissingEnvError/REQUIRED_PROD)
- ✅ **신규 섹션:** Build / Deploy Infrastructure (SPEC-DEPLOY-001 M1+M5) 추가 — `app.config.ts`, `eas.json`, `docs/deployment.md`, `.env.*` 템플릿
- ✅ External Dependencies 테이블에 `expo-constants` 행 추가 (app.config.ts → src/config/env.ts, validateEnv 게이트)
- ✅ 부분 진행 상태 명시 (M2/M3/M4/M6 미완료, M6 블로킹)

**영향 범위:**
- 모듈 카탈로그: 2개 신규 섹션 (Config + Build/Deploy Infra)
- External Dependencies (+1행)

---

### 2. entry-points.md
**변경 내용:**
- ✅ **신규 섹션:** Build-Time Entry Point (`app.config.ts`) 추가 — 빌드 시점 validateEnv 게이트, EXPO_PUBLIC_SENTRY_DSN 노출, 런타임 진입점과의 역할 분리 명시

**영향 범위:**
- Entry Point 카탈로그 (+1 섹션)

---

### 3. INDEX.md + structure.md + tech.md
**변경 내용:**
- ✅ INDEX.md: SPEC-DEPLOY-001 상태 "SPEC 작성 완료" → "진행 중 (M1+M5 머지, PR #15 2514263; M2/M3/M4/M6 미완료 — M6 블로킹: CLUB/NOTIF 의존)"
- ✅ INDEX.md: 구현 완료 카운트에서 DEPLOY 제외 명시 (부분 진행)
- ✅ structure.md: `src/config/` 설명 갱신 (validateEnv/MissingEnvError/REQUIRED_PROD 추가), "빌드·배포 인프라 파일" 섹션 추가 (app.config.ts, eas.json, docs/deployment.md, .env.*), OAuth providers 목록 갱신 (Apple → Naver)
- ✅ tech.md: "EAS Build 파운데이션 (SPEC-DEPLOY-001 M1)" 서브섹션 추가 (3 프로필, EXPO_PUBLIC_* 주입, fail-fast 검증, Sentry SDK M3 예정 명시)

**영향 범위:**
- INDEX.md (추적 테이블 + 상세 항목 + 카운트 노트)
- structure.md (config 설명 갱신 + 신규 섹션)
- tech.md (빌드/배포 섹션 확장)

---

## SPEC-DEPLOY-001 M1+M5 구현 요약

### M1 — 환경 변수 + EAS Build 파운데이션
- `src/config/env.ts`: validateEnv (빌드 시점 fail-fast), MissingEnvError, REQUIRED_PROD 추가 (기존 getEnvVar/getOptionalEnvVar와 공존)
- `app.config.ts`: validateEnv(process.env, ENV) 호출 + EXPO_PUBLIC_SENTRY_DSN을 extra에 노출
- `eas.json`: 3개 빌드 프로필 (development/preview/production)
- `.env.example`/`.env.staging`/`.env.production`: SENTRY_DSN 플레이스홀더

### M5 — OAuth 매뉴얼 문서화 (코드 아님)
- `docs/deployment.md`: Kakao/Naver/Google OAuth 콘솔 등록 + Supabase Auth 활성화 + .env 가이드
- OAuth 콜백 URI `sagak://auth/callback`은 이미 `src/auth/oauth.ts`에 존재 (재구현 아님)

### 미완료 마일스톤
- M2 — GitHub Actions CI (ci.yml/deploy.yml) — 미착수
- M3 — Sentry SDK 통합 (@sentry/react-native 미설치, env 키만 스캐폴드)
- M4 — EAS Submit (TestFlight/Play Console) — 미착수
- M6 — Edge Function 배포 + Supabase 프로비저닝 — 🚫 블로킹 (SPEC-CLUB-001/SPEC-NOTIF-001 의존)

### 검증 결과 (PR #15)
- tsc 0 에러, ESLint 0 에러, Jest 688 통과
- evaluator-active PASS (96.4/100, CRITICAL 0)
- 2 독립 리뷰어 PASS (expert-security OWASP + manager-quality TRUST 5/5)
- 리뷰 MINOR 2건 수정 (Supabase 콜백 exact-match 문서, 빈 문자열 테스트 RED-5)

---

## 순환 의존성 검증 결과 (6차)

**결론:** ✅ **순환 의존성 없음 (DEPLOY 인프라 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app.config.ts` → `src/config/env.ts` (빌드 시점 단방향)
2. ✅ `src/config/env.ts`는 순수 모듈 (런타임/빌드 시점 양쪽에서 사용, 역방향 의존성 없음)
3. ✅ `eas.json`/`.env.*`/`docs/deployment.md`는 설정/문서 파일 (코드 의존성 없음)

---

## 브랜치 정보 (6차)

- **5차 기준:** develop (463996e - SPEC-COMPLETION-001 구현 완료)
- **6차 기준:** develop (2514263 - SPEC-DEPLOY-001 M1+M5 머지)
- **추가된 커밋:** 2514263 (PR #15 머지)

---

**검증 완료:** 2026-06-17 (SPEC-DEPLOY-001 M1+M5)
**업데이트 담당:** manager-docs (sync phase)

---

# 7차 업데이트: SPEC-ROUTINE-001 구현 완료 (2026-06-20)

## 개요 (7차)

SPEC-ROUTINE-001 구현 완료(9ddd1a4) 반영하여 독서 루틴 및 타이머 기능을 코드맵에 갱신함. 13개 source files + 10개 test files, 2881 LOC, 83 tests pass (단위) + pgTAP 9/9 (통합), 88.54% stmts / 83.52% branches coverage.

## 변경사항 요약 (7차)

### 1. modules.md
**변경 내용:**
- ✅ **신규 섹션:** Routine Domain (`src/features/routine/`) 추가
  - `index.ts` (barrel, 공개 API)
  - `types.ts` (ReadingSessionRow, ReadingStats, AlarmSettings, DailyGoalSeconds)
  - `sessionApi.ts` (start/end RPC + getActiveSession, 서버 duration 계산)
  - `alarmApi.ts` (get/update/toggle, HH:MM→HH:MM:SS 정규화, VALIDATION 에러 throw)
  - `statsApi.ts` (클라이언트 집계: total_duration/sessions/today/streak)
  - `streakCalculator.ts` (자정 기준 streak 계산, 미결정 6.1 임시방침)
  - `goalStorage.ts` (AsyncStorage 일일 목표, 기본 900초, 미결정 6.2)
  - `useReadingTimer.ts` (started_at 기반 setInterval 1초 + AppState 복귀 재동기화 + cleanup + formatElapsed HH:MM:SS)
  - `useActiveSession.ts` / `useAlarmSettings.ts` / `useReadingStats.ts` (React Query v5 훅)
  - `copy.ts` (다정한 메시지 상수 + pickEndEncouragement)
  - `components/TimerScreen.tsx` / `AlarmScreen.tsx` / `RoutineStatsWidget.tsx` (token-only 스타일링)
- ✅ 계층별 모듈 분포 업데이트:
  - Business: 53+개 → 66+개 (+13 Routine 도메인)
  - Presentation: 15개 → 18개 (+3 Timer/Alarm/Stats 화면, my/timer, my/alarm 라우트)

**영향 범위:**
- 모듈 카탈로그: 78+ → 91+ (Routine 도메인 +13)
- @MX:ANCHOR 후보: 13개 → 15개 (sessionApi, alarmApi 추가 예상)

---

### 2. entry-points.md
**변경 내용:**
- ✅ Entry Point Invocation Summary에 3행 추가: sessionApi.startSession, sessionApi.endSession, alarmApi.updateAlarmTime
- ✅ Main Tabs: My Page Tab 설명 갱신 (루틴 메뉴 추가: 타이머/알림 진입)
- ✅ Dynamic Routes: my/timer.tsx, my/alarm.tsx 추가 (TimerScreen/AlarmScreen 위임)
- ✅ 각 진입점에 ROUTINE-001 REQ 참조 추가

**영향 범위:**
- Entry Point Invocation Summary (3행 추가)
- Main Tabs (My Page 갱신)
- Dynamic Routes (2행 추가)

---

### 3. overview.md
**변경 내용:**
- ✅ SPEC Coverage 테이블: SPEC-ROUTINE-001 추가 (Status: ✅ Complete, 2026-06-20, Key Components 상세 설명)
- ✅ Current State: Phase 4 진행 상태 추가 (1/3 완료: ROUTINE-001, NOTIF/PROFILE 미구현)
- ✅ Architecture Layers 다이어그램에 ROUTINE 모듈 노드 추가
- ✅ 브랜치 정보: 2514263 → 9ddd1a4

**영향 범위:**
- SPEC Coverage (1행 추가)
- Current State (Phase 4 상태 추가)
- Mermaid 다이어그램 (노드 13개 추가)

---

### 4. dependencies.md
**변경 내용:**
- ✅ Dependency Graph 다이어그램에 ROUTINE 모듈 노드 13개 추가
- ✅ 신규 엣지 15개 추가 (ROUTINE 내부 의존성 + Supabase/AsyncStorage/ReactQuery)
- ✅ Import Matrix에 4개 새로운 섹션 추가:
  - `src/features/routine/` → `src/lib/api/` (sessionApi RPC 호출)
  - `src/features/routine/` → `src/lib/supabase/` (getSupabaseClient)
  - `src/features/routine/` → `@react-native-async-storage/async-storage` (goalStorage)
  - `src/features/routine/` → `@tanstack/react-query` (React Query 훅)
- ✅ High Fan-in Analysis에 #14/#15 신규 추가: sessionApi, alarmApi
- ✅ Circular Dependency Check: ROUTINE 의존성 분석 추가(단방향 흐름 검증)

**순환 의존성 검증 결과:** ✅ **없음 (ROUTINE 모듈 추가 후에도 정상)**

**영향 범위:**
- Mermaid 다이어그램 (노드 13개, 엣지 15개 추가)
- Import Matrix (4개 새로운 섹션)
- @MX:ANCHOR: 13개 → 15개 (+2 신규 후보)

---

### 5. data-flow.md
**변경 내용:**
- ✅ 헤더 갱신: ROUTINE-001 추가
- ✅ **신규 섹션 12:** Reading Timer Flow (독서 타이머 시작/종료) — TimerScreen → useReadingTimer → sessionApi.startSession → RPC(start_reading_session) → DB INSERT 시퀀스 다이어그램
- ✅ **신규 섹션 13:** Alarm Settings Flow (알람 설정) — AlarmScreen → useAlarmSettings → alarmApi.updateAlarmTime → HH:MM→HH:MM:SS 정규화 → VALIDATION 에러/DB UPDATE 시퀀스 다이어그램
- ✅ **신규 섹션 14:** Stats Flow (독서 통계) — RoutineStatsWidget → useReadingStats → statsApi → 클라이언트 집계(total_duration/sessions/today/streak) 시퀀스 다이어그램
- ✅ Data Flow Summary 테이블에 3행 추가: Reading Timer, Alarm Settings, Stats

**영향 범위:**
- Mermaid 시퀀스 다이어그램 3개 추가
- 데이터 흐름 섹션 3개 추가 (각 60-90 라인)
- Data Flow Summary (3행 추가)

---

### 6. INDEX.md + structure.md + migrations.md + schema.md
**변경 내용:**
- ✅ INDEX.md: SPEC-ROUTINE-001 상태 갱신 ("구현 완료 (10/10 REQ, PR #31 9ddd1a4, 2026-06-20, 2881 LOC 추가)")
- ✅ INDEX.md: 진행 추적 테이블 갱신 (Phase 4: 1/3 완료, 미구현 SPEC 3개 → 2개)
- ✅ INDEX.md: Phase 4 상세 항목 갱신 (ROUTINE-001 구현 범위 상세)
- ✅ structure.md: `src/features/routine/` 도메인 설명 추가 (13개 모듈 상세)
- ✅ migrations.md: migration 20240620000002 추가 (RPC 함수 2개, pgTAP 0018 검증)
- ✅ schema.md: RPC Functions 섹션 추가 (start_reading_session, end_reading_session, SECURITY DEFINER 보안)

**영향 범위:**
- INDEX.md (3개 섹션 갱신: 상태 + 진행표 + 상세)
- structure.md (1개 섹션 추가: Routine 도메인)
- migrations.md (1행 추가)
- schema.md (1개 섹션 추가: RPC Functions)

---

## SPEC-ROUTINE-001 구현 요약

### Files Created (13 source + 10 tests)

**Source files (2881 LOC):**
1. `src/features/routine/types.ts` — ReadingSessionRow, ReadingStats, AlarmSettings, DailyGoalSeconds
2. `src/features/routine/copy.ts` — 다정한 메시지 상수 + pickEndEncouragement
3. `src/features/routine/sessionApi.ts` — start/end RPC + getActiveSession
4. `src/features/routine/alarmApi.ts` — get/update/toggle, HH:MM→HH:MM:SS 정규화
5. `src/features/routine/statsApi.ts` — 클라이언트 집계 (total_duration/sessions/today/streak)
6. `src/features/routine/streakCalculator.ts` — 자정 기준 streak 계산
7. `src/features/routine/goalStorage.ts` — AsyncStorage 일일 목표
8. `src/features/routine/useReadingTimer.ts` — started_at 기반 setInterval 1초 + cleanup
9. `src/features/routine/useActiveSession.ts` — React Query 훅
10. `src/features/routine/useAlarmSettings.ts` — React Query 훅
11. `src/features/routine/useReadingStats.ts` — React Query 훅
12. `src/features/routine/index.ts` — barrel (공개 API)
13. `src/features/routine/components/TimerScreen.tsx` — 타이머 화면 (token-only)
14. `src/features/routine/components/AlarmScreen.tsx` — 알람 화면 (token-only)
15. `src/features/routine/components/RoutineStatsWidget.tsx` — 통계 위젯 (token-only)
16. `app/(tabs)/my/timer.tsx` — 타이머 라우트
17. `app/(tabs)/my/alarm.tsx` — 알람 라우트
18. `app/(tabs)/my.tsx` — 마이페이지 수정 (루틴 메뉴 추가)
19. `supabase/migrations/20240620000002_create_reading_session_rpc.sql` — RPC 함수 2개
20. `supabase/tests/0018_reading_sessions_rpc_test.sql` — pgTAP 통합 테스트

**Test files (70 tests pass):**
- `sessionApi.test.ts` — R1/R2(시작+자동종료)/R4(종료)/R5(pages_read 선택적) 검증 (8개)
- `useReadingTimer.test.ts` — R6(cleanup)/R7(setInterval 1초) + formatElapsed 검증 (8개)
- `copy.test.ts` — R9/R10/R21/R23 다정한 메시지 + 강제 표현 금지 검증 (10개)
- `alarmApi.test.ts` — R15/R16(get), R12/R13/R14(update/toggle) 검증 (10개)
- `streakCalculator.test.ts` — 자정 기준 streak 계산 검증 (10개)
- `statsApi.test.ts` — 클라이언트 집계 검증 (10개)
- `goalStorage.test.ts` — AsyncStorage 목표 검증 (10개)
- `hooks.test.tsx` — React Query 훅 검증 (10개)
- `TimerScreen.test.tsx` — 타이머 화면 렌더 검증 (5개)
- `AlarmScreen.test.tsx` — 알람 화면 렌더 검증 (5개)
- `RoutineStatsWidget.test.tsx` — 통계 위젯 렌더 검증 (5개)
- `my.test.tsx` — 마이페이지 expo-router mock 추가 (1개)

### REQ Coverage

- REQ-ROUT-001: 독서 타이머 시작 ✅
- REQ-ROUT-002: 자동 종료 ✅
- REQ-ROUT-003: 활성 세션 조회 ✅
- REQ-ROUT-004: 타이머 종료 (서버 duration 계산) ✅
- REQ-ROUT-005: 알람 설정 조회 ✅
- REQ-ROUT-006: 알람 시간 업데이트 (HH:MM→HH:MM:SS 정규화) ✅
- REQ-ROUT-007: 알람 활성화 토글 ✅
- REQ-ROUT-008: 독서 통계 조회 (클라이언트 집계) ✅
- REQ-ROUT-009: 연속 일수 표시 (자정 기준) ✅
- REQ-ROUT-010: 목표 설정 (AsyncStorage) ✅

**Total: 10/10 REQ covered (100%)**

### Key Architecture Decisions

1. **서버 duration 계산**: `end_reading_session` RPC 함수에서 `EXTRACT(EPOCH FROM (ended_at - started_at))`로 서버 측에서 duration_seconds 계산 (클라이언트 조작 방지, R3 RLS 차단 검증 완료)
2. **SECURITY DEFINER 보안**: RPC 함수는 RLS를 우회하므로 `user_id=auth.uid()` 가드(COERCE 기본값)로 명시적으로 본인 행만 조작 (pgTAP 0018 테스트로 검증)
3. **자정 기준 streak**: 미결정 6.1 임시방침으로 자정 기준 streak 계산 (v1.1.0 24시간 윈도우 검토 예정)
4. **클라이언트 집계**: statsApi는 클라이언트에서 집계 (total_duration/sessions/today/streak) — 확장 시 RPC 전환 가능
5. **HH:MM→HH:MM:SS 정규화**: alarmApi.updateAlarmTime에서 HH:MM→HH:MM:SS 정규화 + VALIDATION 에러 throw (INVALID_TIME_FORMAT 카피)
6. **AsyncStorage 목표**: goalStorage는 AsyncStorage에 일일 목표 저장 (기본 900초=15분, 미결정 6.2)
7. **다정한 카피**: pickEndEncouragement로 duration별 다정한 메시지 선택 (REQ-ROUT-009/010/021/023)
8. **token-only 스타일링**: TimerScreen/AlarmScreen/RoutineStatsWidget은 `$brand-500` 등 토큰만 사용 (하드코딩 금지, SPEC-UI-002 준수)
9. **@MX:WARN**: useReadingTimer (setInterval+AppState 복합 생명주기, cleanup 누락 시 누수)
10. **@MX:NOTE**: streakCalculator 자정 기준 (v1.1.0 24시간 윈도우 검토), statsApi 클라이언트 집계 (확장 시 RPC 전환)

### Test Results

- 70/70 tests pass
- 88.54% statements coverage (목표 85%+ 초과)
- 83.52% branches coverage
- 100% functions coverage
- 93.62% lines coverage

### Known Follow-ups

1. **자정 기준 streak (6.1)**: v1.1.0에서 24시간 윈도우 검토
2. **목표 기본값 (6.2)**: 현재 900초(15분) 하드코딩, 사용자 설정 값 검토
3. **백그라운드 타이머 정확도**: AppState 복귀 재동기화로 partial 회복, but 완전한 해결은 SPEC-NOTIF-001 로컬 알림 스케줄링 협력 필요
4. **RPC 회피**: statsApi는 클라이언트 집계, 확장 시 RPC 전환

---

## 순환 의존성 검증 결과 (7차)

**결론:** ✅ **순환 의존성 없음 (ROUTINE 모듈 추가 후에도 정상)**

**검증 항목:**
1. ✅ `app/` → `src/` (단방향)
2. ✅ `src/features/routine/` → `src/lib/api/` → `src/lib/supabase/` (단방향)
3. ✅ `src/features/routine/` → `@react-native-async-storage/async-storage` (단방향)
4. ✅ `src/features/routine/` → `@tanstack/react-query` (단방향)
5. ✅ `src/features/routine/`는 `src/auth/`를 임포트하지 않음 (userId는 caller가 전달)

---

## 모듈 수 변화 (7차)

| 계층 | 6차 후 (DEPLOY-001 M1+M5) | 7차 후 (ROUTINE-001) | 증가 |
|------|--------------------------|----------------------|------|
| **Presentation (app/)** | 15개 | 18개 | +3 (my/timer, my/alarm, my.tsx 수정) |
| **Business (src/)** | 53+개 | 66+개 | +13 |
| ├── AUTH | 6개 | 6개 | 0 |
| ├── Theme | 3개 | 3개 | 0 |
| ├── API | 4개 | 4개 | 0 |
| ├── Types | 3개 | 3개 | 0 |
| ├── Book Domain | 9개 | 9개 | 0 |
| ├── Library Domain | 6개 | 6개 | 0 |
| ├── Emotion Domain | 8개 | 8개 | 0 |
| ├── Completion Domain | 7개 | 7개 | 0 |
| ├── **Routine Domain** | 0개 | **13개** | **+13 (신규)** |
| └── Components | 7개 | 10개 | +3 (Timer/Alarm/Stats 화면) |
| **Infrastructure (src/lib/)** | 5개 | 5개 | 0 |
| **Edge Functions** | 5개 | 5개 | 0 |
| **RPC Functions** | 6개 | 8개 | +2 (start/end reading session) |
| **총계** | **78+개** | **91+개** | **+13** |

---

## @MX:ANCHOR 후보 변화 (7차)

| 모듈 | Fan-in | 우선순위 | 6차 상태 | 7차 상태 |
|------|--------|----------|---------|---------|
| `useSession` | 5+ | HIGH | 적용됨 | 적용됨 |
| `useTheme` | 6+ | HIGH | 적용됨 | 적용됨 |
| `tokens` | 4+ | MEDIUM | 적용됨 | 적용됨 |
| `getSupabaseClient` | 임계적 | CRITICAL | 적용됨 | 적용됨 |
| `searchBooks` | 1+ | HIGH | 적용됨 | 적용됨 |
| `getBookDetail` | 1+ | HIGH | 적용됨 | 적용됨 |
| `emotionApi` | 2+ (예상) | HIGH | 신규 후보 | 신규 후보 |
| `stickerApi` | 2+ (예상) | HIGH | 신규 후보 | 신규 후보 |
| `completionApi` | 2+ (예상) | HIGH | 신규 후보 | 신규 후보 |
| **`sessionApi`** | **2+ (예상)** | **HIGH** | **-** | **신규 후보** |
| **`alarmApi`** | **2+ (예상)** | **HIGH** | **-** | **신규 후보** |

**총계:** 13개 → 15개 (+2 신규 후보)

---

## 브랜치 정보 (7차)

- **6차 기준:** develop (2514263 - SPEC-DEPLOY-001 M1+M5 머지)
- **7차 기준:** develop (9ddd1a4 - SPEC-ROUTINE-001 구현 완료)
- **추가된 커밋:** 9ddd1a4 (PR #31 머지)

---

**검증 완료:** 2026-06-20 (SPEC-ROUTINE-001)
**업데이트 담당:** manager-docs (sync phase)
