# Sa-gak Architecture Overview

## Quick Summary

사각(Sa-gak)은 **도서 감상 기반 소셜 네트워킹 앱**으로, React Native + Expo를 기반으로 한 모바일 애플리케이션입니다. 도메인 주도 설계(DDD) 패턴을 따르며, 얇은 라우터 래퍼(app/)와 구현 계층(src/)의 분리를 특징으로 합니다.

**기술 스택:**
- **프레임워크:** React Native 0.83.2 + Expo SDK 55
- **라우팅:** Expo Router ~5 (File-based routing)
- **상태 관리:** React Context (Auth, Theme)
- **인증:** Supabase OAuth (Kakao, Apple, Google)
- **백엔드:** Supabase (Database, Auth, Storage, Edge Functions)
- **언어:** TypeScript 5.9 (strict mode)
- **테스트:** jest-expo + @testing-library/react-native

## Architecture Layers

```mermaid
graph TB
    subgraph "Presentation Layer (app/)"
        A[app/_layout.tsx<br/>Root Layout<br/>Theme+QueryClient+Auth]
        B[app/index.tsx<br/>Entry Branching]
        C[app/(auth)/<br/>Auth Group]
        D[app/(tabs)/<br/>5 Tabs + Hidden]
    end

    subgraph "Business Logic Layer (src/)"
        E[src/auth/<br/>Authentication]
        F[src/theme/<br/>Theming]
        G[src/lib/api/<br/>API Layer]
        H[src/types/<br/>Domain Types]
        Y[src/features/book/<br/>Book Domain M1-M4]
        YY[src/features/book/<br/>BarcodeScanner·ISBN·Debounce]
        YF[src/features/book/<br/>format·resolveBookId]
        L[src/features/library/<br/>Library Domain<br/>libraryApi·useLibrary<br/>progressRate·validation]
    end

    subgraph "Infrastructure Layer (src/lib/)"
        I[src/lib/supabase/<br/>Supabase Client<br/>createClient<Database>]
        Q[src/lib/query/<br/>QueryClient<br/>globalThis 캐시]
        J[src/config/env.ts<br/>Environment]
        K[src/errors/<br/>Error Handling]
    end

    subgraph "Edge Functions (supabase/functions/)"
        Z[kakao-book-search<br/>Kakao API + Cache]
    end

    subgraph "External Services"
        LDB[Supabase<br/>Database<br/>books+user_books]
        M[Supabase<br/>Auth]
        N[Supabase<br/>Storage]
        O[OAuth<br/>Providers]
        AA[Kakao<br/>Book Search API]
        AB[expo-camera<br/>Barcode Scanning]
        XQ[@tanstack/react-query<br/>v5 QueryCache]
    end

    A --> F
    A --> Q
    A --> E
    B --> E
    C --> E
    D --> E
    D --> F
    E --> I
    G --> I
    I --> LDB
    I --> M
    I --> N
    E --> O
    I --> J
    G --> K
    Y --> G
    Y --> I
    YY --> YF
    YY --> AB
    YF --> I
    Z --> AA
    Z --> LDB
    L --> I
    L --> Q
    Q --> XQ
```

## Module Structure

### Presentation Layer (`app/`)
- **역할:** Expo Router 라우팅, 화면 전환, 가드 로직
- **특징:** 얇은 래퍼(thin wrappers), 실제 구현은 `src/`에서 위임받음

### Business Logic Layer (`src/`)
- **도메인별 분리:** `auth/`, `theme/`, `lib/api/`, `features/`
- **재사용 가능한 컴포넌트:** `src/components/`
- **타입 정의:** `src/types/` (도메인 모델, Supabase Database 타입 816행)
- **도메인 모듈:**
  - `features/book/`: 검색, 상세, 바코드 스캔, ISBN→UUID 매핑
  - `features/library/`: 서재 CRUD, 진행률, React Query 훅

### Infrastructure Layer (`src/lib/`)
- **Supabase 클라이언트:** Singleton 패턴, `createClient<Database>` (타입화됨), SecureStore/AsyncStorage 세션 어댑터
- **React Query 싱글톤:** `getQueryClient()` (globalThis 캐시, HMR 안정성), staleTime: 0 (네트워크 우선)
- **환경 설정:** 타입 안전한 env 변수 접근
- **에러 처리:** 표준화된 에러 분류 (`normalizeError`) 및 재시도 전략 (`retryWithBackoff`)

## SPEC Coverage

| SPEC ID | Title | Status | Key Components |
|---------|-------|--------|----------------|
| **SPEC-UI-001** | Component System | ✅ Complete | Button, Card, ProgressBar, EmotionRecordCard, StickerReaction |
| **SPEC-DB-001** | Database Schema | ✅ Complete | Book, EmotionRecord, User, Profile, user_books 테이블 (RLS 포함) |
| **SPEC-API-001** | API Layer | ✅ Complete | Edge Functions, 에러 처리, 재시도 로직, Supabase 클라이언트(createClient<Database>) |
| **SPEC-AUTH-001** | Authentication | ✅ Complete | OAuth(Kakao/Apple/Google), Session, Onboarding |
| **SPEC-NAV-001** | Navigation System | ✅ Complete | 4-tab navigator, 가드 로직, 딥링크 |
| **SPEC-BOOK-001** | Book Search & Detail | ✅ Complete M1~M4 | M1 Edge function(kakao-book-search) + M2 클라이언트 API + M3 바코드 스캔(BarcodeScanner/ISBN/Debounce) + M4 검색·상세 화면(BookSearchScreen/BookDetailScreen/SearchResultCard/format) |
| **SPEC-LIBRARY-001** | Library & Progress | ✅ Complete | Library CRUD API, React Query v5 QueryClient 싱글톤, useLibrary/useLibraryItem 훅, resolveBookId(ISBN→UUID, @MX:ANCHOR), progressValidation/progressRate 유틸, BookDetailScreen 서재 통합 |
| **SPEC-LIBRARY-001** | Library & Progress | ✅ Complete | Library CRUD API, React Query v5 QueryClient 싱글톤, useLibrary/useLibraryItem 훅, resolveBookId(ISBN→UUID, @MX:ANCHOR), progressValidation/progressRate 유틸, BookDetailScreen 서재 통합 |
| **SPEC-LIBRARY-001** | Library & Progress | ✅ Complete | Library CRUD API(getLibrary/addBook/deleteBook/updateProgress/updateStatus/updateVisibility), React Query QueryClient 싱글톤, useLibrary/useLibraryItem 훅, resolveBookId(ISBN→UUID), progressValidation/progressRate 유틸, BookDetailScreen 서재 통합(진행률 표시 + mutations) |

## Current State

**Phase 1: Foundation Complete** (2026-06-16 기준)

- ✅ 인증 시스템: Supabase OAuth 통합, 세션 관리, 온보딩 플로우
- ✅ 내비게이션: 4탭 구조, 인증/온보딩 가드, 딥링크 콜백
- ✅ API 계층: Edge Functions 호출, 에러 처리, 재시도 메커니즘
- ✅ 테마 시스템: 라이트/다크 모드, 디자인 토큰
- ✅ 타입 안전성: TypeScript strict mode, Zod 스키마
- ✅ 도서 검색: Kakao Book Search API 통합, Edge Function 캐싱, 정규화/매퍼 (M1+M2 완료)
- ✅ 바코드 스캔: BarcodeScanner(expo-camera), ISBN 체크디짓 검증, 중복 스캔 디바운스 (M3 완료)
- ✅ 검색/상세 UI: BookSearchScreen(빈 쿼리 차단/빈 결과 안내), BookDetailScreen(useSession 가드), SearchResultCard, formatPublishedMonth 공유 유틸 (M4 완료)
- ✅ 서재 모듈: Library CRUD API, React Query QueryClient 싱글톤(globalThis 캐시), useLibrary/useLibraryItem 훅(staleTime 0, optimistic updates), resolveBookId(ISBN→UUID 매핑, @MX:ANCHOR), progressValidation/progressRate 유틸, BookDetailScreen 서재 통합(진행률 표시 + 진도/상태/공개 mutations) (LIBRARY-001 완료)

## Key Patterns

### 1. Domain-Driven + Thin Wrappers
- `src/{domain}/` = 실제 구현 (재사용 가능한 비즈니스 로직)
- `app/{group}/` = 라우팅 전용 얇은 래퍼 (라우터 설정만 담당)
- **예시:** `app/(auth)/login.tsx`는 `src/auth/login.tsx`를 재내보냄

### 2. React Context for State
- **AuthContext:** 인증 상태, 사용자 프로필, OAuth 메서드
- **ThemeContext:** 테마 모드, 토큰 접근, 수동 모드 전환
- **장점:** 글로벌 상태 공유, 하위 컴포넌트에서 간단한 훅 접근

### 3. Guard-Based Navigation
```
useSession() → null(loading) | {isAuthenticated, isOnboarded, ...}
├── null → ActivityIndicator
├── !auth → login screen
├── auth && !onboarded → onboarding screen
└── auth && onboarded → render children
```

### 4. Secure Session Persistence
- **SecureStore:** 민감한 토큰 저장 (iOS/Android)
- **AsyncStorage:** 폴백 (웹/개발 환경)
- **어댑터 패턴:** `supabaseStorageAdapter`가 Supabase 클라이언트에 주입

## High Fan-in Modules (@MX:ANCHOR Candidates)

| Module | Fan-in | Callers | Priority |
|--------|--------|---------|----------|
| `useSession` | 7+ | index, (tabs)/_layout, (auth)/_layout, callback, BookDetailScreen, login, onboarding | HIGH |
| `useTheme` | 8+ | All components, layouts, BarcodeScanner, BookSearchScreen, BookDetailScreen | HIGH |
| `tokens` | 5+ | Theme provider, components, BarcodeScanner, BookSearchScreen, BookDetailScreen | MEDIUM |
| `getSupabaseClient` | 10+ | AuthContext, searchApi, bookDetailApi, libraryApi, resolveBookId, all API calls | CRITICAL |
| `getQueryClient` | 5+ | _layout.tsx (QueryClientProvider), useLibrary, useLibraryItem (mutations), tests | HIGH |
| `resolveBookId` | 3+ | BookSearchScreen (검색 결과 선택), BookDetailScreen (ISBN→UUID), libraryApi.addBook (서재 등록), tests | HIGH |
| `libraryApi` (CRUD) | 4+ | useLibrary, useLibraryItem (4 mutations), tests | HIGH |
| `normalizeError` | 5+ | retry, bookDetailApi, libraryApi, Supabase client, tests | MEDIUM |
| `searchBooks` | 2+ | BookSearchScreen, tests | HIGH |
| `getBookDetail` | 2+ | BookDetailScreen, tests | HIGH |
| `formatPublishedMonth` | 2 | SearchResultCard, BookDetailScreen | MEDIUM |
| `isValidIsbn` | 2 | BarcodeScanner, resolveBookItem (검증), tests | MEDIUM |
| `shouldSuppressDuplicate` | 1 | BarcodeScanner | LOW |

## Tech Stack Details

### Frontend
```
React Native 0.83.2
├── Expo SDK 55
│   ├── Expo Router ~5 (File-based routing)
│   ├── Expo SecureStore
│   └── AsyncStorage
├── React 19.2
├── TypeScript 5.9 (strict)
├── @tanstack/react-query v5 (Caching, optimistic updates)
└── Zod (Runtime validation)
```

### Backend (Supabase)
```
Supabase JS Client
├── Database (PostgreSQL, createClient<Database>)
│   ├── books (ISBN UNIQUE, title, author, cover_url, total_pages)
│   ├── user_books (FK→books, progress tracking, RLS)
│   └── Database type (816 lines auto-generated)
├── Auth (OAuth integration)
├── Storage (File uploads)
└── Edge Functions (Custom API)
    └── kakao-book-search (Kakao Book API + cache)
```

### Development Tools
```
jest-expo (Testing)
├── @testing-library/react-native
└── React Test Renderer

ESLint (Linting)
├── @typescript-eslint
└── Expo plugin

Prettier (Formatting)
```

## Next Steps

1. **SPEC-RECORD-001:** 감정 기록 기능 구현 (EmotionRecord API + UI)
2. **SPEC-SOCIAL-001:** 소셜 기능 추가 (팔로우, 댓글, 좋아요)
3. **SPEC-NOTIF-001:** 알림 시스템 (Push notifications, In-app notifications)
4. **테스트 커버리지 확대:** 현재 462+ 테스트 → 목표 85%+ 커버리지

---

**Last Updated:** 2026-06-16  
**Branch:** develop (20e2574 SPEC-LIBRARY-001 merged + sync)  
**Maintainer:** MoAI Documentation System
