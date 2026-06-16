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
        A[app/_layout.tsx<br/>Root Layout]
        B[app/index.tsx<br/>Entry Branching]
        C[app/(auth)/<br/>Auth Group]
        D[app/(tabs)/<br/>Main Tabs]
    end

    subgraph "Business Logic Layer (src/)"
        E[src/auth/<br/>Authentication]
        F[src/theme/<br/>Theming]
        G[src/lib/api/<br/>API Layer]
        H[src/types/<br/>Domain Types]
    end

    subgraph "Infrastructure Layer (src/lib/)"
        I[src/lib/supabase/<br/>Supabase Client]
        J[src/config/env.ts<br/>Environment]
        K[src/errors/<br/>Error Handling]
    end

    subgraph "External Services"
        L[Supabase<br/>Database]
        M[Supabase<br/>Auth]
        N[Supabase<br/>Storage]
        O[OAuth<br/>Providers]
    end

    A --> E
    A --> F
    B --> E
    C --> E
    D --> E
    D --> F
    E --> I
    G --> I
    I --> L
    I --> M
    I --> N
    E --> O
    I --> J
    G --> K
```

## Module Structure

### Presentation Layer (`app/`)
- **역할:** Expo Router 라우팅, 화면 전환, 가드 로직
- **특징:** 얇은 래퍼(thin wrappers), 실제 구현은 `src/`에서 위임받음

### Business Logic Layer (`src/`)
- **도메인별 분리:** `auth/`, `theme/`, `lib/api/`
- **재사용 가능한 컴포넌트:** `src/components/`
- **타입 정의:** `src/types/` (도메인 모델, Supabase 스키마)

### Infrastructure Layer (`src/lib/`)
- **Supabase 클라이언트:** Singleton 패턴, SecureStore/AsyncStorage 세션 어댑터
- **환경 설정:** 타입 안전한 env 변수 접근
- **에러 처리:** 표준화된 에러 분류 및 재시도 전략

## SPEC Coverage

| SPEC ID | Title | Status | Key Components |
|---------|-------|--------|----------------|
| **SPEC-UI-001** | Component System | ✅ Complete | Button, Card, ProgressBar, EmotionRecordCard, StickerReaction |
| **SPEC-DB-001** | Database Schema | ✅ Complete | Book, EmotionRecord, User, Profile 테이블 |
| **SPEC-API-001** | API Layer | ✅ Complete | Edge Functions, 에러 처리, 재시도 로직 |
| **SPEC-AUTH-001** | Authentication | ✅ Complete | OAuth(Kakao/Apple/Google), Session, Onboarding |
| **SPEC-NAV-001** | Navigation System | ✅ Complete | 4-tab navigator, 가드 로직, 딥링크 |

## Current State

**Phase 1: Foundation Complete** (2026-06-16 기준)

- ✅ 인증 시스템: Supabase OAuth 통합, 세션 관리, 온보딩 플로우
- ✅ 내비게이션: 4탭 구조, 인증/온보딩 가드, 딥링크 콜백
- ✅ API 계층: Edge Functions 호출, 에러 처리, 재시도 메커니즘
- ✅ 테마 시스템: 라이트/다크 모드, 디자인 토큰
- ✅ 타입 안전성: TypeScript strict mode, Zod 스키마

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
| `useSession` | 4+ | index, (tabs)/_layout, (auth)/_layout, callback | HIGH |
| `useTheme` | 6+ | All components, layouts | HIGH |
| `tokens` | 3+ | Theme provider, components | MEDIUM |
| `getSupabaseClient` | 임계적 | AuthContext, all API calls | CRITICAL |
| `supabaseStorageAdapter` | 1 | Supabase client init | MEDIUM |

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
└── Zod (Runtime validation)
```

### Backend (Supabase)
```
Supabase JS Client
├── Database (PostgreSQL)
├── Auth (OAuth integration)
├── Storage (File uploads)
└── Edge Functions (Custom API)
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
4. **테스트 커버리지 확대:** 현재 277개 테스트 → 목표 85%+ 커버리지

---

**Last Updated:** 2026-06-16  
**Branch:** develop (82d2031)  
**Maintainer:** MoAI Documentation System
