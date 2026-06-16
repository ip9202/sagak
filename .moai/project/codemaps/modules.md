# Sa-gak Module Catalog

상세 모듈 목록 — 경로, 계층, 목적, 주요 익스포트, SPEC 참조

## Presentation Layer (`app/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트/특징 | SPEC 참조 |
|------|------|------|------|------------------|-----------|
| Root Layout | `app/_layout.tsx` | Presentation | 루트 레이아웃, 테마/인증 제공자 설정 | ThemeProvider, AuthProvider, Stack (headerShown: false) | AUTH-001, NAV-001 |
| Entry Branching | `app/index.tsx` | Presentation | 진입점 분기 로직 (useSession 기반) | 인증/온보딩 상태에 따른 라우팅 | NAV-001 REQ-NAV-020 |
| Dev Demo | `app/_dev.tsx` | Presentation | 개발 전용 데모 화면 | `__DEV__` 게이트됨 | - |
| Auth Group Layout | `app/(auth)/_layout.tsx` | Presentation | 인증 그룹 레이아웃 + G5 가드 | 인증 가드, 스택 구성 | AUTH-001, NAV-001 |
| Login Screen | `app/(auth)/login.tsx` | Presentation | 로그인 화면 (래퍼) | `src/auth/login.tsx` 재내보냄 | AUTH-001 |
| Onboarding Screen | `app/(auth)/onboarding.tsx` | Presentation | 온보딩 화면 (래퍼) | `src/auth/onboarding.tsx` 재내보냄 | AUTH-001 |
| OAuth Callback | `app/(auth)/auth/callback.tsx` | Presentation | OAuth 딥링크 콜백 핸들러 | useLocalSearchParams, useSession 기반 리다이렉트 | NAV-001 REQ-NAV-031 |
| Tabs Layout | `app/(tabs)/_layout.tsx` | Presentation | 4탭 내비게이터 + 가드 | 인증/온보딩 가드, 탭 구성 | NAV-001 REQ-NAV-001/022/023 |
| Home Tab | `app/(tabs)/index.tsx` | Presentation | 홈 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| Library Tab | `app/(tabs)/library.tsx` | Presentation | 도서관 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| Clubs Tab | `app/(tabs)/clubs.tsx` | Presentation | 클럽 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| My Page Tab | `app/(tabs)/my.tsx` | Presentation | 마이페이지 탭 (플레이스홀더) | 빈 컨테이너 | NAV-001 REQ-NAV-002 |
| Book Detail | `app/(tabs)/[bookId].tsx` | Presentation | 도서 상세 동적 라우트 | 동적 세그먼트 `bookId` | NAV-001 REQ-NAV-010 |
| Club Detail | `app/(tabs)/clubs/[clubId].tsx` | Presentation | 클럽 상세 중첩 동적 라우트 | 동적 세그먼트 `clubId` | NAV-001 REQ-NAV-011 |

## Business Logic Layer (`src/`)

### Authentication (`src/auth/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Auth Context | `src/auth/AuthContext.tsx` | Business | 인증 상태 관리, OAuth 토큰 교환 | AuthContext, AuthProvider, onAuthStateChange | AUTH-001 REQ-AUTH-010 |
| Session Hook | `src/auth/useSession.ts` | Business | 세션 훅 (사용자/프로필/상태) | useSession (반환: session, user, profile, loading, isAuthenticated, isOnboarded, signInWithProvider, signOut, refreshProfile) | AUTH-001 REQ-AUTH-030~033 |
| Auth Types | `src/auth/types.ts` | Business | 인증 타입 정의 | AuthProvider ('kakao'\|'apple'\|'google'), UserProfile, AuthContextValue | AUTH-001 |
| OAuth Utils | `src/auth/oauth.ts` | Business | OAuth 리다이렉트 URI 생성 | getOAuthRedirectUri | AUTH-001 REQ-AUTH-002 |
| Login Screen | `src/auth/login.tsx` | Business | 로그인 화면 구현 | OAuth 버튼, 폼 | AUTH-001 |
| Onboarding Screen | `src/auth/onboarding.tsx` | Business | 온보딩 화면 구현 | 닉네임 입력, 프로필 설정 | AUTH-001 |

### Theming (`src/theme/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Theme Provider | `src/theme/theme.tsx` | Business | 테마 제공자, 훅 | ThemeProvider, useTheme, useManualMode (light/dark) | UI-001 |
| Design Tokens | `src/theme/tokens.ts` | Business | 디자인 토큰 (색상/간격/타이포그래피) | colors, spacing, typography | UI-001 |
| Dark Tokens | `src/theme/darkTokens.ts` | Business | 다크 모드 토큰 | 다크 모드 색상 오버라이드 | UI-001 |

### API Layer (`src/lib/api/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| API Barrel | `src/lib/api/index.ts` | Business | API 계층 barrel | 모든 API 모듈 재내보냄 | API-001 |
| Error Handling | `src/lib/api/errors.ts` | Business | 에러 정규화, 분류 | normalizeError, classifyError, ERROR_CATEGORIES | API-001 REQ-API-011~015 |
| Retry Logic | `src/lib/api/retry.ts` | Business | 재시도 전략 (백오프) | retryWithBackoff | API-001 REQ-API-003 |
| Edge Functions | `src/lib/api/edgeFunctions.ts` | Business | Edge Function 호출 래퍼 | invokeEdgeFunction | API-001 REQ-API-004 |

### Types (`src/types/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Domain Types | `src/types/index.ts` | Business | 도메인 타입 정의 | Book, EmotionRecord, StickerType | DB-001 |
| Supabase Types | `src/types/supabase.ts` | Business | Supabase DB 타입 | Database 타입 (gen-types pending) | API-001 REQ-API-007 |

### Components (`src/components/`)

| 모듈 | 경로 | 계층 | 목적 | SPEC 참조 |
|------|------|------|------|-----------|
| Button | `src/components/Button.tsx` | Presentation | 재사용 가능한 버튼 컴포넌트 | UI-001 |
| Card | `src/components/Card.tsx` | Presentation | 카드 컨테이너 | UI-001 |
| BookCard | `src/components/BookCard.tsx` | Presentation | 도서 카드 | UI-001 |
| EmotionRecordCard | `src/components/EmotionRecordCard.tsx` | Presentation | 감정 기록 카드 | UI-001 |
| ProgressBar | `src/components/ProgressBar.tsx` | Presentation | 진행률 바 | UI-001 |
| StickerReaction | `src/components/StickerReaction.tsx` | Presentation | 스티커 반응 선택기 | UI-001 |

## Infrastructure Layer (`src/lib/`)

### Supabase (`src/lib/supabase/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Supabase Client | `src/lib/supabase/client.ts` | Infrastructure | Supabase 클라이언트 싱글톤 | getSupabaseClient | API-001 REQ-API-001/002 |
| Storage Adapter | `src/lib/supabase/storageAdapter.ts` | Infrastructure | 세션 저장소 어댑터 (SecureStore/AsyncStorage) | supabaseStorageAdapter | API-001 REQ-API-002 |
| Realtime | `src/lib/supabase/realtime.ts` | Infrastructure | Realtime 구독 관리 | subscribeToTable, unsubscribe | - |

### Configuration (`src/config/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Environment | `src/config/env.ts` | Infrastructure | 환경 변수 검증 접근 | getEnvVar, getOptionalEnvVar | API-001 REQ-API-016~019 |

### Error Handling (`src/errors/`)

| 모듈 | 경로 | 계층 | 목적 | 주요 익스포트 | SPEC 참조 |
|------|------|------|------|-------------|-----------|
| Error Constants | `src/errors/index.ts` | Infrastructure | 에러 상수 정의 | 에러 코드, 메시지 | API-001 |

## High Fan-in Modules (@MX:ANCHOR)

| 모듈 | 호출자 수 | 호출자 목록 | 우선순위 | 비고 |
|------|-----------|------------|----------|------|
| `useSession` | 4+ | `app/index.tsx`, `app/(tabs)/_layout.tsx`, `app/(auth)/_layout.tsx`, `app/(auth)/auth/callback.tsx` | **HIGH** | @MX:ANCHOR 후보 - 4개 라우트에서 사용 |
| `useTheme` | 6+ | 모든 컴포넌트, 레이아웃 | **HIGH** | @MX:ANCHOR 후보 - 전역 테마 접근 |
| `tokens` | 3+ | ThemeProvider, 다수 컴포넌트 | **MEDIUM** | 디자인 토큰 참조 |
| `getSupabaseClient` | 임계적 | AuthContext, 모든 API 호출 | **CRITICAL** | @MX:ANCHOR 필수 - 싱글톤 클라이언트 |
| `supabaseStorageAdapter` | 1 | Supabase 클라이언트 초기화 | **MEDIUM** | 세션 지속성 어댑터 |

## 계층별 모듈 분포

```
Presentation: 13개 (app/)
├── 레이아웃: 4개 (_layout.tsx files)
├── 스크린: 7개 (index, login, onboarding, 4 tabs, callback)
└── 동적 라우트: 2개 ([bookId], [clubId])

Business: 20+개 (src/)
├── 인증: 6개 (AuthContext, useSession, types, oauth, login, onboarding)
├── 테마: 3개 (theme, tokens, darkTokens)
├── API: 4개 (index, errors, retry, edgeFunctions)
├── 타입: 2개 (domain, supabase)
└── 컴포넌트: 6개 (Button, Card, BookCard, EmotionRecordCard, ProgressBar, StickerReaction)

Infrastructure: 5개 (src/lib/)
├── Supabase: 3개 (client, storageAdapter, realtime)
├── 환경 설정: 1개 (env.ts)
└── 에러: 1개 (index.ts)
```

---

**Last Updated:** 2026-06-16  
**Branch:** develop (82d2031)
