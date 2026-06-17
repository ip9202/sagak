# Sa-gak Dependency Graph

모듈 간 의존성 분석 — app/ → src/ 임포트, @MX:ANCHOR 후보 식별, 순환 의존성 검증

## Dependency Overview

```mermaid
graph TB
    subgraph "Presentation Layer (app/)"
        A1[app/_layout.tsx<br/>ThemeProvider+QueryClient+Auth]
        A2[app/index.tsx<br/>Entry Branching]
        A3[app/(tabs)/_layout.tsx<br/>Tabs Guard]
        A4[app/(auth)/_layout.tsx<br/>Auth Guard]
        A5[app/(tabs)/search.tsx<br/>BookSearchScreen]
        A6[app/(tabs)/scan.tsx<br/>BarcodeScanner]
        A7[app/(tabs)/[bookId].tsx<br/>BookDetailScreen]
    end

    subgraph "Authentication (src/auth/)"
        B1[src/auth/useSession.ts<br/>@MX:ANCHOR]
        B2[src/auth/AuthContext.tsx]
        B3[src/auth/login.tsx]
        B4[src/auth/onboarding.tsx]
    end

    subgraph "Theming (src/theme/)"
        T1[src/theme/theme.tsx<br/>@MX:ANCHOR]
        T2[src/theme/tokens.ts<br/>@MX:ANCHOR]
    end

    subgraph "Book Domain (src/features/book/)"
        BK1[src/features/book/searchApi.ts<br/>@MX:ANCHOR]
        BK2[src/features/book/bookDetailApi.ts<br/>@MX:ANCHOR]
        BK3[src/features/book/BarcodeScanner.tsx<br/>@MX:ANCHOR]
        BK4[src/features/book/BookSearchScreen.tsx<br/>@MX:ANCHOR]
        BK5[src/features/book/BookDetailScreen.tsx<br/>@MX:ANCHOR]
        BK6[src/features/book/isbn.ts<br/>@MX:ANCHOR]
        BK7[src/features/book/debounce.ts<br/>@MX:ANCHOR]
        BK8[src/features/book/format.ts<br/>@MX:ANCHOR]
        BK9[src/features/book/resolveBookId.ts<br/>@MX:ANCHOR]
    end

    subgraph "Library Domain (src/features/library/)"
        LIB1[src/features/library/libraryApi.ts<br/>@MX:ANCHOR]
        LIB2[src/features/library/useLibrary.ts<br/>@MX:ANCHOR]
        LIB3[src/features/library/useLibraryItem.ts<br/>@MX:ANCHOR]
        LIB4[src/features/library/progressValidation.ts]
        LIB5[src/features/library/progressRate.ts]
    end

    subgraph "Query Infrastructure (src/lib/query/)"
        Q1[src/lib/query/queryClient.ts<br/>@MX:ANCHOR]
    end

    subgraph "API Layer (src/lib/api/)"
        API1[src/lib/api/edgeFunctions.ts]
        API2[src/lib/api/errors.ts]
        API3[src/lib/api/retry.ts]
    end

    subgraph "Supabase Client (src/lib/supabase/)"
        SB1[src/lib/supabase/client.ts<br/>@MX:ANCHOR]
        SB2[src/lib/supabase/storageAdapter.ts]
    end

    subgraph "Types (src/types/)"
        TP1[src/types/supabase.ts<br/>Database 816 lines]
        TP2[src/types/book.ts]
    end

    subgraph "Components (src/components/)"
        C1[src/components/BookCard.tsx]
        C2[src/components/SearchResultCard.tsx]
        C3[src/components/ProgressBar.tsx]
        C4[src/components/EmotionRecordCard.tsx]
        C5[src/components/StickerReaction.tsx]
    end

    subgraph "Emotion Domain (src/features/emotion/)"
        EMO1[src/features/emotion/types.ts]
        EMO2[src/features/emotion/emotionApi.ts]
        EMO3[src/features/emotion/stickerApi.ts]
        EMO4[src/features/emotion/useEmotionRecords.ts]
        EMO5[src/features/emotion/useStickerReaction.ts]
        EMO6[src/features/emotion/questionPrompts.ts]
        EMO7[src/features/emotion/EmotionInputScreen.tsx]
        EMO8[src/features/emotion/TimelineScreen.tsx]
    end

    subgraph "External Services"
        X1[@tanstack/react-query v5]
        X2[@supabase/supabase-js]
        X3[expo-camera]
        X4[Kakao Book API]
    end

    %% Layout Dependencies
    A1 --> T1
    A1 --> Q1
    A1 --> B2
    A2 --> B1
    A3 --> B1
    A4 --> B1

    %% Auth Dependencies
    B1 --> B2
    B2 --> SB1
    B3 --> B2
    B4 --> B2

    %% Theme Dependencies
    T1 --> T2

    %% Book Domain Dependencies
    BK1 --> API1
    BK1 --> SB1
    BK2 --> SB1
    BK3 --> BK6
    BK3 --> BK7
    BK3 --> X3
    BK3 --> T1
    BK4 --> BK1
    BK4 --> BK9
    BK4 --> T1
    BK5 --> BK2
    BK5 --> B1
    BK5 --> BK8
    BK5 --> BK9
    BK5 --> T1
    BK5 --> C3
    BK5 --> LIB2
    BK9 --> SB1

    %% Library Domain Dependencies
    LIB1 --> SB1
    LIB1 --> API2
    LIB1 --> LIB4
    LIB2 --> Q1
    LIB2 --> LIB1
    LIB3 --> Q1
    LIB3 --> LIB1
    LIB4 --> TP2
    LIB5 --> TP2

    %% Query Infrastructure
    Q1 --> X1

    %% API Layer
    API1 --> SB1
    API2 --> SB1
    API3 --> API2

    %% Supabase Client
    SB1 --> X2
    SB1 --> TP1

    %% Types
    TP2 --> TP1

    %% Components
    C1 --> T1
    C2 --> T1
    C3 --> T1
    C4 --> T1
    C5 --> T1

    %% Emotion Domain Dependencies
    EMO1 --> TP1
    EMO2 --> API2
    EMO2 --> SB1
    EMO3 --> API2
    EMO3 --> SB1
    EMO4 --> Q1
    EMO4 --> EMO2
    EMO5 --> Q1
    EMO5 --> EMO3
    EMO6 --> EMO1
    EMO7 --> EMO4
    EMO7 --> EMO6
    EMO7 --> T1
    EMO7 --> C4
    EMO7 --> C5
    EMO8 --> EMO4
    EMO8 --> T1
    EMO8 --> C4
    EMO8 --> C5
```

## Import Matrix

### app/ → src/ Imports

| From | To | Module | Purpose |
|------|----|----|---------|
| `app/_layout.tsx` | `src/theme/theme.tsx` | ThemeProvider | 테마 제공 |
| `app/_layout.tsx` | `src/lib/query/queryClient.ts` | getQueryClient | QueryClient 주입 |
| `app/_layout.tsx` | `src/auth/AuthContext.tsx` | AuthProvider | 인증 상태 |
| `app/index.tsx` | `src/auth/useSession.ts` | useSession | 진입 분기 |
| `app/(tabs)/_layout.tsx` | `src/auth/useSession.ts` | useSession | 탭 가드 |
| `app/(tabs)/search.tsx` | `src/features/book/BookSearchScreen.tsx` | BookSearchScreen | 검색 화면 |
| `app/(tabs)/scan.tsx` | `src/features/book/BarcodeScanner.tsx` | BarcodeScanner | 스캔 화면 |
| `app/(tabs)/[bookId].tsx` | `src/features/book/BookDetailScreen.tsx` | BookDetailScreen | 상세 화면 |

### src/ Internal Imports

| From | To | Module | Purpose |
|------|----|----|---------|
| `src/auth/useSession.ts` | `src/auth/AuthContext.tsx` | useContext | 세션 접근 |
| `src/auth/AuthContext.tsx` | `src/lib/supabase/client.ts` | getSupabaseClient | Supabase 클라이언트 |
| `src/features/book/searchApi.ts` | `src/lib/api/edgeFunctions.ts` | invokeEdgeFunction | 카카오 검색 |
| `src/features/book/searchApi.ts` | `src/lib/supabase/client.ts` | getSupabaseClient | Edge Function 호출 |
| `src/features/book/bookDetailApi.ts` | `src/lib/supabase/client.ts` | getSupabaseClient | PostgREST 조회 |
| `src/features/book/BookSearchScreen.tsx` | `src/features/book/searchApi.ts` | searchBooks | 검색 API |
| `src/features/book/BookSearchScreen.tsx` | `src/features/book/resolveBookId.ts` | resolveBookId | ISBN→UUID |
| `src/features/book/BookDetailScreen.tsx` | `src/features/book/bookDetailApi.ts` | getBookDetail | 상세 조회 |
| `src/features/book/BookDetailScreen.tsx` | `src/features/book/resolveBookId.ts` | resolveBookId | ISBN→UUID |
| `src/features/book/BookDetailScreen.tsx` | `src/features/library/useLibrary.ts` | useLibrary | 서재 통합 |
| `src/features/library/libraryApi.ts` | `src/lib/supabase/client.ts` | getSupabaseClient | PostgREST CRUD |
| `src/features/library/libraryApi.ts` | `src/lib/api/errors.ts` | normalizeError | 에러 정규화 |
| `src/features/library/useLibrary.ts` | `src/lib/query/queryClient.ts` | useQuery | React Query |
| `src/features/library/useLibrary.ts` | `src/features/library/libraryApi.ts` | getLibrary | API 호출 |
| `src/features/library/useLibraryItem.ts` | `src/lib/query/queryClient.ts` | useMutation | React Query |
| `src/features/library/useLibraryItem.ts` | `src/features/library/libraryApi.ts` | * mutations | API 호출 |
| `src/features/library/progressValidation.ts` | `src/types/book.ts` | BookRow | 타입 참조 |
| `src/features/library/progressRate.ts` | `src/types/book.ts` | BookRow | 타입 참조 |
| `src/features/emotion/types.ts` | `src/types/supabase.ts` | Database | DB Row derived |
| `src/features/emotion/emotionApi.ts` | `src/lib/api/errors.ts` | normalizeError | 에러 정규화 |
| `src/features/emotion/emotionApi.ts` | `src/lib/supabase/client.ts` | getSupabaseClient | PostgREST 직접 호출 |
| `src/features/emotion/stickerApi.ts` | `src/lib/api/errors.ts` | normalizeError | 409 UNIQUE→VALIDATION mapping |
| `src/features/emotion/stickerApi.ts` | `src/lib/supabase/client.ts` | getSupabaseClient | PostgREST 직접 호출 |
| `src/features/emotion/useEmotionRecords.ts` | `src/lib/query/queryClient.ts` | useQuery/useMutation | React Query |
| `src/features/emotion/useEmotionRecords.ts` | `src/features/emotion/emotionApi.ts` | * API 호출 | CRUD operations |
| `src/features/emotion/useStickerReaction.ts` | `src/lib/query/queryClient.ts` | useMutation | React Query |
| `src/features/emotion/useStickerReaction.ts` | `src/features/emotion/stickerApi.ts` | * API 호출 | precheck/create/delete |
| `src/features/emotion/EmotionInputScreen.tsx` | `src/features/emotion/useEmotionRecords.ts` | useEmotionRecords | CRUD mutations |
| `src/features/emotion/EmotionInputScreen.tsx` | `src/features/emotion/questionPrompts.ts` | getQuestionPrompt | 질문지 유도 |
| `src/features/emotion/TimelineScreen.tsx` | `src/features/emotion/useEmotionRecords.ts` | useEmotionRecords | list query |
| `src/components/EmotionRecordCard.tsx` | `src/theme/tokens.ts` | Design tokens | Styling |
| `src/components/StickerReaction.tsx` | `src/theme/tokens.ts` | Design tokens | Styling |

### @MX:ANCHOR Candidates (fan_in ≥ 3)

| Module | fan_in | Callers | Why Anchor |
|--------|---------|---------|-----------|
| `src/auth/useSession.ts` | 7+ | app/index.tsx, app/(tabs)/_layout.tsx, app/(auth)/_layout.tsx, src/auth/login.tsx, src/auth/onboarding.tsx, src/features/book/BookDetailScreen.tsx, ... | 인증 상태 조회의 공통 진입점 |
| `src/lib/supabase/client.ts` | 10+ | src/auth/AuthContext.tsx, src/features/book/searchApi.ts, src/features/book/bookDetailApi.ts, src/features/library/libraryApi.ts, src/features/book/resolveBookId.ts, ... | Supabase 클라이언트 싱글톤 |
| `src/lib/query/queryClient.ts` | 5+ | app/_layout.tsx, src/features/library/useLibrary.ts, src/features/library/useLibraryItem.ts, src/features/library/useLibraryItem.ts (mutations) | React Query 캐시 공유 |
| `src/theme/theme.tsx` | 8+ | app/_layout.tsx, src/features/book/BarcodeScanner.tsx, src/features/book/BookSearchScreen.tsx, src/features/book/BookDetailScreen.tsx, src/components/* | 테마 접근 공통 인터페이스 |
| `src/features/book/searchApi.ts` | 3+ | src/features/book/BookSearchScreen.tsx, tests | 검색 API의 공통 진입점 |
| `src/features/book/bookDetailApi.ts` | 3+ | src/features/book/BookDetailScreen.tsx, tests | 상세 조회 API의 공통 진입점 |
| `src/features/book/resolveBookId.ts` | 3+ | src/features/book/BookSearchScreen.tsx, src/features/book/BookDetailScreen.tsx, src/features/library/libraryApi.ts (addBook), tests | ISBN→UUID 매핑의 불변 계약 (books.isbn UNIQUE) |
| `src/features/library/libraryApi.ts` | 4+ | src/features/library/useLibrary.ts, src/features/library/useLibraryItem.ts (4 mutations), tests | 서재 CRUD의 공용 진입점 |
| `src/features/library/useLibrary.ts` | 3+ | src/features/book/BookDetailScreen.tsx, tests | 서재 목록 훅 |
| **`src/features/emotion/emotionApi.ts`** | **2+ (예상)** | **src/features/emotion/useEmotionRecords.ts, tests** | **감정 기록 CRUD 공용 진입점** |
| **`src/features/emotion/stickerApi.ts`** | **2+ (예상)** | **src/features/emotion/useStickerReaction.ts, tests** | **스티커 반응 CRUD 공용 진입점** |
| `src/lib/api/errors.ts` | 5+ | src/lib/api/retry.ts, src/features/book/bookDetailApi.ts, src/features/library/libraryApi.ts, src/lib/supabase/client.ts, src/features/emotion/emotionApi.ts, src/features/emotion/stickerApi.ts, tests | 에러 정규화의 공통 계약 |

## Circular Dependency Check

**Status:** ✅ NO CIRCULAR DEPENDENCIES DETECTED

의존성 방향은 단방향입니다:
- `app/` → `src/` (프레젠테이션 → 비즈니스 로직)
- `src/features/` → `src/lib/` (도메인 → 인프라)
- `src/features/` → `src/types/` (도메인 → 타입)

순환 의존성이 없으므로 모듈 그래프는 DAG (Directed Acyclic Graph)입니다.

## Layer Separation

```
┌─────────────────────────────────────────┐
│         Presentation Layer               │
│              (app/)                      │
│  - Layouts, Routes, Screens              │
└─────────────────┬───────────────────────┘
                  │ imports
┌─────────────────▼───────────────────────┐
│       Business Logic Layer              │
│   (src/features/, src/auth/, src/theme/) │
│  - Domain logic, hooks, screens         │
└─────────────────┬───────────────────────┘
                  │ imports
┌─────────────────▼───────────────────────┐
│      Infrastructure Layer               │
│   (src/lib/api/, src/lib/supabase/,     │
│    src/lib/query/, src/types/)          │
│  - API clients, type definitions        │
└─────────────────────────────────────────┘
```

**특이사항:**
- `resolveBookId.ts`는 `src/features/book/`에 위치하지만, library 도메인에서도 호출되는 공용 API입니다 (SPEC-LIBRARY-001 TASK-002).
- `queryClient.ts`는 `src/lib/query/`에 위치하며, 앱 전역의 React Query 캐시를 관리하는 싱글톤입니다 (SPEC-LIBRARY-001 TASK-001).
