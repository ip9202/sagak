# Sa-gak Dependency Graph

모듈 간 의존성 분석 — app/ → src/ 임포트, @MX:ANCHOR 후보 식별, 순환 의존성 검증

## Dependency Overview

```mermaid
graph TB
    subgraph "Presentation Layer (app/)"
        A1[app/_layout.tsx]
        A2[app/index.tsx]
        A3[app/(tabs)/_layout.tsx]
        A4[app/(auth)/_layout.tsx]
        A5[app/(auth)/auth/callback.tsx]
        A6[app/(auth)/login.tsx]
        A7[app/(auth)/onboarding.tsx]
    end

    subgraph "Business Logic (src/)"
        B1[src/auth/useSession.ts<br/>@MX:ANCHOR]
        B2[src/auth/AuthContext.tsx]
        B3[src/auth/login.tsx]
        B4[src/auth/onboarding.tsx]
        B5[src/theme/theme.tsx<br/>@MX:ANCHOR]
        B6[src/theme/tokens.ts<br/>@MX:ANCHOR]
        B7[src/lib/api/index.ts]
        B8[src/lib/api/edgeFunctions.ts]
        B9[src/features/book/searchApi.ts<br/>@MX:ANCHOR]
        B10[src/features/book/bookDetailApi.ts<br/>@MX:ANCHOR]
        B11[src/features/book/isbn.ts<br/>@MX:ANCHOR]
        B12[src/features/book/debounce.ts<br/>@MX:ANCHOR]
        B13[src/features/book/format.ts<br/>@MX:ANCHOR]
        B14[src/features/book/BarcodeScanner.tsx<br/>@MX:ANCHOR]
        B15[src/features/book/BookSearchScreen.tsx<br/>@MX:ANCHOR]
        B16[src/features/book/BookDetailScreen.tsx<br/>@MX:ANCHOR]
        B17[src/features/book/resolveBookId.ts<br/>@MX:ANCHOR]
        B18[src/features/library/libraryApi.ts<br/>@MX:ANCHOR]
        B19[src/features/library/useLibrary.ts]
        B20[src/features/library/useLibraryItem.ts]
        B21[src/features/library/progressValidation.ts]
        B22[src/features/library/progressRate.ts]
        B23[src/components/SearchResultCard.tsx]
    end

    subgraph "Infrastructure (src/lib/)"
        I1[src/lib/supabase/client.ts<br/>@MX:ANCHOR]
        I2[src/lib/supabase/storageAdapter.ts]
        I3[src/config/env.ts]
        I4[src/lib/query/queryClient.ts<br/>@MX:ANCHOR]
    end

    subgraph "Edge Functions"
        E1[supabase/functions/<br/>kakao-book-search/index.ts]
        E2[cacheManager.ts]
        E3[kakaoClient.ts]
    end

    subgraph "External Services"
        X1[Kakao Book Search API]
        X2[expo-camera<br/>CameraView + useCameraPermissions]
    end

    A1 --> B5
    A1 --> B2
    A2 --> B1
    A3 --> B1
    A3 --> B5
    A4 --> B1
    A5 --> B1
    A6 --> B3
    A7 --> B4
    B1 --> B2
    B2 --> I1
    B5 --> B6
    B7 --> B8
    B8 --> I1
    B9 --> B7
    B9 --> I1
    B10 --> I1
    B14 --> B11
    B14 --> B12
    B14 --> X2
    B14 --> B6
    B15 --> B9
    B15 --> B17
    B15 --> B6
    B16 --> B10
    B16 --> B1
    B16 --> B13
    B16 --> B6
    B17 --> B13
    B17 --> B6
    I1 --> I2
    I1 --> I3
    E1 --> E2
    E1 --> E3
    E3 --> X1
```

## Import Matrix

### From `app/` to `src/auth/`

| 호출자 (app/) | 대상 (src/auth/) | 임포트 | 용도 |
|--------------|------------------|--------|------|
| `app/_layout.tsx` | `src/auth/AuthContext.tsx` | `AuthProvider` | 루트 인증 제공자 |
| `app/index.tsx` | `src/auth/useSession.ts` | `useSession` | 진입점 분기 로직 |
| `app/(tabs)/_layout.tsx` | `src/auth/useSession.ts` | `useSession` | 탭 가드 |
| `app/(auth)/_layout.tsx` | `src/auth/useSession.ts` | `useSession` | 인증 그룹 가드 |
| `app/(auth)/auth/callback.tsx` | `src/auth/useSession.ts` | `useSession` | 콜백 후 리다이렉트 |
| `app/(auth)/login.tsx` | `src/auth/login.tsx` | re-export | 로그인 화면 구현 |
| `app/(auth)/onboarding.tsx` | `src/auth/onboarding.tsx` | re-export | 온보딩 화면 구현 |

### From `app/` to `src/theme/`

| 호출자 (app/) | 대상 (src/theme/) | 임포트 | 용도 |
|--------------|------------------|--------|------|
| `app/_layout.tsx` | `src/theme/theme.tsx` | `ThemeProvider` | 루트 테마 제공자 |
| `app/(tabs)/_layout.tsx` | `src/theme/theme.tsx` | `useTheme` | 탭 내비게이터 스타일링 |
| `app/(auth)/_layout.tsx` | `src/theme/theme.tsx` | `useTheme` | 인증 화면 스타일링 |

### From `src/auth/` to `src/lib/supabase/`

| 호출자 (src/auth/) | 대상 (src/lib/supabase/) | 임포트 | 용도 |
|-------------------|------------------------|--------|------|
| `src/auth/AuthContext.tsx` | `src/lib/supabase/client.ts` | `getSupabaseClient` | 인증 상태 관리, OAuth 토큰 교환 |

### From `src/lib/api/` to `src/lib/supabase/`

| 호출자 (src/lib/api/) | 대상 (src/lib/supabase/) | 임포트 | 용도 |
|---------------------|------------------------|--------|------|
| `src/lib/api/edgeFunctions.ts` | `src/lib/supabase/client.ts` | `getSupabaseClient` | Edge Function 호출 |

### From `src/features/book/` to `src/lib/api/`

| 호출자 (src/features/book/) | 대상 (src/lib/api/) | 임포트 | 용도 |
|---------------------------|-------------------|--------|------|
| `src/features/book/searchApi.ts` | `src/lib/api/edgeFunctions.ts` | `invokeEdgeFunction` | kakao-book-search Edge Function 호출 |

### From `src/features/book/` to `src/lib/supabase/`

| 호출자 (src/features/book/) | 대상 (src/lib/supabase/) | 임포트 | 용도 |
|---------------------------|------------------------|--------|------|
| `src/features/book/bookDetailApi.ts` | `src/lib/supabase/client.ts` | `getSupabaseClient` | PostgREST 직접 조회 (books 테이블) |

### From `src/features/book/` to `src/features/book/` (내부 도메인)

| 호출자 | 대상 | 임포트 | 용도 |
|--------|------|--------|------|
| `BarcodeScanner.tsx` | `isbn.ts` | `isValidIsbn` | 스캔된 ISBN 체크디짓 검증 (REQ-BOOK-007) |
| `BarcodeScanner.tsx` | `debounce.ts` | `shouldSuppressDuplicate` | 중복 스캔 디바운스 (REQ-BOOK-009) |
| `BookSearchScreen.tsx` | `searchApi.ts` | `searchBooks` | 도서 검색 (빈 쿼리 차단) |
| `BookDetailScreen.tsx` | `bookDetailApi.ts` | `getBookDetail` | 도서 상세 조회 |
| `BookDetailScreen.tsx` | `format.ts` | `formatPublishedMonth` | 출판월 포맷 |
| `SearchResultCard.tsx` | `format.ts` | `formatPublishedMonth` | 검색 결과 출판월 포맷 (REQ-BOOK-014) |

### From `app/(tabs)/` to `src/features/book/` (숨김 라우트)

| 호출자 (app/) | 대상 (src/features/book/) | 임포트 | 용도 |
|--------------|---------------------------|--------|------|
| `app/(tabs)/search.tsx` | `BookSearchScreen.tsx` | default | 검색 라우트(href:null) |
| `app/(tabs)/scan.tsx` | `BarcodeScanner.tsx` | default | 스캔 라우트(href:null, 풀스크린) |
| `app/(tabs)/[bookId].tsx` | `BookDetailScreen.tsx` | default | 상세 동적 라우트 (SPEC-NAV-001 stub → 통합 교체) |

### From `src/features/book/` to `src/auth/`

| 호출자 (src/features/book/) | 대상 (src/auth/) | 임포트 | 용도 |
|---------------------------|------------------|--------|------|
| `BookDetailScreen.tsx` | `useSession.ts` | `useSession` | RLS 거부 시 가드(S22) — 인증 상태 확인 |

### From `src/features/book/` to `src/theme/`

| 호출자 (src/features/book/) | 대상 (src/theme/) | 임포트 | 용도 |
|---------------------------|------------------|--------|------|
| `BarcodeScanner.tsx` | `tokens.ts` / `theme.tsx` | `useTheme` | 스캔 UI 스타일링 |
| `BookSearchScreen.tsx` | `tokens.ts` / `theme.tsx` | `useTheme` | 검색 화면 스타일링 |
| `BookDetailScreen.tsx` | `tokens.ts` / `theme.tsx` | `useTheme` | 상세 화면 스타일링 |
| `SearchResultCard.tsx` | `tokens.ts` / `theme.tsx` | `useTheme` | 결과 카드 스타일링 |

### From `app/(tabs)/library.tsx` to expo-router

| 호출자 | 대상 | 임포트 | 용도 |
|--------|------|--------|------|
| `app/(tabs)/library.tsx` | `expo-router` | `useRouter` | 검색 진입 CTA: `router.push('/search')` |

### From `src/features/book/` to external (expo-camera)

| 호출자 | 대상 | 임포트 | 용도 |
|--------|------|--------|------|
| `BarcodeScanner.tsx` | `expo-camera` | `CameraView`, `useCameraPermissions`, `barcodeScannerSettings` | 바코드 스캔 카메라 + 권한 게이트 (REQ-BOOK-006~009) |

### From `src/lib/supabase/` to `src/config/`

| 호출자 (src/lib/supabase/) | 대상 (src/config/) | 임포트 | 용도 |
|---------------------------|-------------------|--------|------|
| `src/lib/supabase/client.ts` | `src/config/env.ts` | `getEnvVar` | Supabase URL/키 초기화 |

## High Fan-in Analysis (@MX:ANCHOR Candidates)

### 1. `useSession` (Fan-in: 4+)

**호출자:**
- `app/index.tsx` - 진입점 분기
- `app/(tabs)/_layout.tsx` - 탭 가드
- `app/(auth)/_layout.tsx` - 인증 그룹 가드
- `app/(auth)/auth/callback.tsx` - 콜백 리다이렉트

**의존성:**
```typescript
import { useSession } from '@/auth/useSession'
```

**중요도:** HIGH - 모든 라우팅 분기 로직의 핵심

**@MX:ANCHOR 권장:** ✅ - 4개 라우트에서 사용, 인터페이스 변경 영향도 높음

---

### 2. `useTheme` (Fan-in: 6+)

**호출자:**
- `app/_layout.tsx` - 루트 테마 제공자
- `app/(tabs)/_layout.tsx` - 탭 스타일링
- `app/(auth)/_layout.tsx` - 인증 화면 스타일링
- 모든 컴포넌트 (Button, Card, 등)

**의존성:**
```typescript
import { useTheme, ThemeProvider } from '@/theme/theme'
import tokens from '@/theme/tokens'
```

**중요도:** HIGH - 전역 스타일링 인터페이스

**@MX:ANCHOR 권장:** ✅ - 반환값 구조(theme, colorScheme, etc.) 변경 시 영향도 광범위

---

### 3. `tokens` (Fan-in: 3+)

**호출자:**
- `src/theme/theme.tsx` - ThemeProvider
- 다수 컴포넌트 (Button, Card, etc.)

**의존성:**
```typescript
import tokens from '@/theme/tokens'
```

**중요도:** MEDIUM - 디자인 토큰 참조

**@MX:ANCHOR 권장:** ⚠️ - 토큰 구조 변경 시 컴포넌트 스타일링 영향

---

### 4. `getSupabaseClient` (Fan-in: CRITICAL)

**호출자:**
- `src/auth/AuthContext.tsx` - 인증 상태 관리
- `src/lib/api/edgeFunctions.ts` - Edge Function 호출
- 모든 Supabase 직접 호출 (추후 추가될 API 계층)

**의존성:**
```typescript
import { getSupabaseClient } from '@/lib/supabase/client'
```

**중요도:** **CRITICAL** - Supabase 클라이언트 싱글톤

**@MX:ANCHOR 권장:** ✅ 필수 - 클라이언트 초기화 로직 변경 시 모든 데이터 접근 영향

---

### 5. `supabaseStorageAdapter` (Fan-in: 1)

**호출자:**
- `src/lib/supabase/client.ts` - 클라이언트 초기화 시 주입

**의존성:**
```typescript
import { supabaseStorageAdapter } from '@/lib/supabase/storageAdapter'
```

**중요도:** MEDIUM - 세션 지속성 어댑터

**@MX:ANCHOR 권장:** ⚠️ - 저장소 인터페이스 변경 시 클라이언트 초기화 영향

---

### 6. `searchBooks` (Fan-in: 1 현재 → 3+ 예상)

**호출자:**
- `BookSearchScreen` (현재, M4) - 도서 검색 화면
- `BarcodeScanner` (예상, M3 확장) - 바코드 스캔 ISBN 자동 전환
- `BookDetailScreen` (예상, M4 확장) - 도서 상세에서 재검색

**의존성:**
```typescript
import { searchBooks } from '@/features/book'
```

**중요도:** HIGH - 도서 검색 공개 API

**@MX:ANCHOR 권장:** ✅ 적용됨 - 빈 쿼리 차단/응답 계약 위반 시 전체 검색 플로우 고장

---

### 7. `getBookDetail` (Fan-in: 1 현재 → 3+ 예상)

**호출자:**
- `BookDetailScreen` (현재, M4) - 도서 상세 조회
- 검색 결과 선택 시 (예상, REQ-BOOK-014) - 검색→상세 이동
- 서재 플로우 (예상, SPEC-LIBRARY-001) - 내 서재 도서 상세

**의존성:**
```typescript
import { getBookDetail } from '@/features/book'
```

**중요도:** HIGH - 도서 상세 조회 공개 API

**@MX:ANCHOR 권장:** ✅ 적용됨 - PGRST116→NOT_FOUND 분류, RLS_DENIED 처리 핵심

---

### 8. `formatPublishedMonth` (Fan-in: 2) — M4 신규

**호출자:**
- `SearchResultCard` - 검색 결과 출판월 포맷
- `BookDetailScreen` - 상세 화면 출판월 포맷

**의존성:**
```typescript
import { formatPublishedMonth } from '@/features/book/format'
```

**중요도:** MEDIUM - 날짜 포맷 공유 유틸 (YYYY.MM)

**@MX:ANCHOR 권장:** ✅ 적용됨 - 포맷 변경 시 두 화면 동시 영향

---

### 9. `isValidIsbn` (Fan-in: 1) — M3 신규

**호출자:**
- `BarcodeScanner` - 스캔된 ISBN 체크디짓 검증

**의존성:**
```typescript
import { isValidIsbn } from '@/features/book/isbn'
```

**중요도:** MEDIUM - ISBN 검증 순수함수

**@MX:ANCHOR 권장:** ⚠️ 후보 - 체크디짓 알고리즘 변경 시 스캔 플로우 영향

---

### 10. `shouldSuppressDuplicate` (Fan-in: 1) — M3 신규

**호출자:**
- `BarcodeScanner` - 중복 스캔 디바운스 (DUPLICATE_DEBOUNCE_MS=2000)

**의존성:**
```typescript
import { shouldSuppressDuplicate } from '@/features/book/debounce'
```

**중요도:** MEDIUM - 디바운스 계약 순수함수

**@MX:ANCHOR 권장:** ⚠️ 후보 - 디바운스 윈도우 변경 시 UX 영향

## Circular Dependency Check

**검증 결과:** ✅ **순환 의존성 없음 (BOOK M3/M4 추가 후에도 정상)**

**검증 방법:**
1. `app/` → `src/` 의존성 (단방향)
2. `src/auth/` → `src/lib/supabase/` 의존성 (단방향)
3. `src/lib/api/` → `src/lib/supabase/` 의존성 (단방향)
4. `src/features/book/` → `src/lib/api/` → `src/lib/supabase/` 의존성 (단방향)
5. `src/features/book/` → `src/lib/supabase/` 의존성 (단방향)
6. `src/lib/supabase/` → `src/config/` 의존성 (단방향)
7. `src/features/book/BarcodeScanner` → `isbn` / `debounce` / `expo-camera` (단방향, 순수함수)
8. `src/features/book/BookDetailScreen` → `src/auth/useSession` (단방향 — 가드 목적)

**의존성 방향:**
```
app/ (Presentation)
  ↓ imports
src/ (Business Logic)
  ├── src/features/book/ → src/lib/api/ → src/lib/supabase/
  ├── src/features/book/ → src/lib/supabase/
  ├── src/features/book/ → src/auth/ (BookDetailScreen → useSession, 가드 전용)
  ├── src/features/book/ → src/theme/ (UI 컴포넌트 토큰)
  └── src/features/book/ 내부: BarcodeScanner → isbn/debounce (순수함수)
  ↓ imports
src/lib/ (Infrastructure)
```

**BOOK M3/M4 모듈 의존성 분석:**
- ✅ `src/features/book/` → `src/lib/api/` (invokeEdgeFunction)
- ✅ `src/features/book/` → `src/lib/supabase/` (getSupabaseClient)
- ✅ `src/features/book/` → `src/types/book.ts` (타입)
- ✅ `src/features/book/` 내부 순수함수 계층: `isbn.ts`, `debounce.ts`, `format.ts` (외부 의존성 없음)
- ✅ `BookDetailScreen` → `useSession`은 가드 전용 (인증 상태 읽기, 역방향 아님)
- ✅ Edge Function(kakao-book-search)은 Deno 환경으로 완전히 분리
- ✅ `expo-camera`는 외부 의존성 (BarcodeScanner만 사용)

**역방향 의존성 없음:**
- `src/`는 `app/`를 임포트하지 않음
- `src/lib/`는 `src/`를 임포트하지 않음
- `src/auth/`는 `src/features/book/`를 임포트하지 않음 (BookDetailScreen → useSession은 정방향)
- `src/theme/`는 `src/features/book/`를 임포트하지 않음

## Bidirectional Consistency

**검증 항목:**

1. **인증 흐름 일관성**
   - ✅ `useSession` → `AuthContext` → `getSupabaseClient` 체인 일관됨
   - ✅ 모든 라우트에서 동일한 `useSession` 인터페이스 사용

2. **테마 적용 일관성**
   - ✅ `ThemeProvider` → `tokens` → `darkTokens` 체인 일관됨
   - ✅ 모든 컴포넌트에서 `useTheme` 통해 토큰 접근

3. **API 호출 일관성**
   - ✅ `invokeEdgeFunction` → `getSupabaseClient` 체인 일관됨
   - ✅ 에러 처리 → `retryWithBackoff` 통합 일관됨

## Dependency Health Score

| 항목 | 점수 | 비고 |
|------|------|------|
| 순환 의존성 | ✅ 10/10 | 없음 |
| 계층 분리 | ✅ 10/10 | 명확한 Presentation → Business → Infrastructure |
| @MX:ANCHOR 식별 | ✅ 9/10 | 10개 후보 식별 (M3/M4로 5개 추가) |
| 얇은 래퍼 준수 | ✅ 10/10 | app/는 src/를 재내보내거나 호출만 |
| 인터페이스 안정성 | ✅ 8/10 | 고 fan-in 모듈 안정적 |

**총점:** 47/50 (94%)

## Recommendations

1. **@MX:ANCHOR 적용 상태 (M3/M4 반영):**
   - `useSession.ts` - @MX:ANCHOR 적용됨 (HIGH)
   - `useTheme.tsx` - @MX:ANCHOR 적용됨 (HIGH)
   - `getSupabaseClient.ts` - @MX:ANCHOR 적용됨 (CRITICAL)
   - `searchBooks` - @MX:ANCHOR 적용됨 (HIGH, M4 완료)
   - `getBookDetail` - @MX:ANCHOR 적용됨 (HIGH, M4 완료)
   - `formatPublishedMonth` - @MX:ANCHOR 적용됨 (MEDIUM, M4 신규)
   - `BarcodeScanner.tsx` - @MX:ANCHOR 적용됨 (M3)
   - `BookSearchScreen.tsx` - @MX:ANCHOR 적용됨 (M4)
   - `BookDetailScreen.tsx` - @MX:ANCHOR 적용됨 (M4)
   - `debounce.ts` - @MX:ANCHOR 적용됨 (M3)

2. **모듈 경계 강화:**
   - `app/`는 라우팅만 담당, 비즈니스 로직은 `src/`에 위임 (현재 잘 준수됨)
   - `src/lib/`는 인프라만 담당, 도메인 로직은 상위 계층에 (현재 잘 준수됨)
   - `src/features/book/`는 순수함수(isbn/debounce/format)와 UI 컴포넌트의 계층 분리 유지 (M3/M4 패턴)

3. **의존성 모니터링:**
   - 향후 `src/` → `app/` 역방향 임포트 방지 (린트 규칙 권장)
   - `src/lib/` → `src/` 역방향 임포트 방지 (린트 규칙 권장)
   - `src/auth/` → `src/features/book/` 역방향 임포트 방지 (BookDetailScreen → useSession은 정방향 허용)

4. **known-issue:**
   - ISBN→bookId 매핑: `search.tsx`는 `/book/${isbn}`으로 이동하지만 `[bookId].tsx`는 UUID 기대. SPEC-LIBRARY-001에서 해결 예정.

---

**Last Updated:** 2026-06-16  
**Branch:** develop (852f0ac → a293e8d SPEC-BOOK-001 M3+M4 merged)
