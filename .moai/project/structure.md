# 시스템 구조 — 사각 (Sa-gak)

## 플랫폼

iOS/Android 모바일 앱 (React Native + Expo SDK 55 + React 19.2)

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React Native + Expo)             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 인증/온보딩 │  │ 도서 서재   │  │ 감정 기록   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 모임 관리   │  │ 독서 루틴   │  │ 보상/알림   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Supabase)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │ PostgREST   │  │ Edge Functions│        │
│  │ (데이터)     │  │ (API)       │  │ (비즈니스 로직)│       │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Realtime    │  │ Storage     │  │ Auth        │        │
│  │ (실시간 동기)│  │ (파일 저장) │  │ (인증)      │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│               External Services                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Kakao Book  │  │ OAuth       │  │ Expo        │        │
│  │ (도서 검색) │  │ (카카오/애플/ │  │ (Push)      │        │
│  └─────────────┘  │  구글)      │  └─────────────┘        │
│                   └─────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## 주요 모듈

- **인증/온보딩**: 사용자 가입, 로그인, 온보딩 플로우, 프로필 설정
- **도서 검색·서재 관리**: 바코드 스캔, 카카오 도서 API 연동, 책 등록, 진도 추적, 서재 관리
- **감정 기록 아카이브**: 페이지별 감정 입력, 단어/한 줄 기록, 타임라인 뷰, 완독 다이어리
- **연결 시스템**: Track A (합류형 요청), Track B (개설형 모임), 매칭 알고리즘, 메시징
- **모임 관리**: 모임 생성/가입, 진도 동기화, 스포일러 방지 피드, 참가자 관리
- **독서 루틴·알림**: 다정한 알림 설정, 독서 타이머, 습관 추적, 목표 설정
- **보상·아카이빙**: 기록 누적 보상, 성취 배지, 아카이브 시각화, 데이터 내보내기
- **마이페이지·설정**: 사용자 프로필, 알림 설정, 개인정보 처리, 이용약관

> **참고**: 본 데이터 모델은 기획 문서(`.booktalk/pages_06_ERD.md`) 기반으로 설계되었으며, SPEC-DB-001 구현(15개 migration, 272 테스트 통과)으로 `.moai/project/db/` 메타데이터가 동기화 완료되었습니다 (2026-06-14). 상세 스키마·ERD·RLS 정책은 `db/schema.md`·`db/erd.mmd`·`db/rls-policies.md` 참조.

## 클라이언트/프론트엔드 아키텍처

클라이언트 아키텍처는 Expo Router 기반의 파일 시스템 네비게이션을 중심으로 구성되며, Supabase 백엔드와 병행하여 작동합니다.

### 핵심 구조

- **`app/`** (Expo Router 라우팅): `_layout.tsx` (AuthProvider + ThemeProvider로 전체 앱 감싸기, `(tabs)`/`(auth)` 그룹 라우트 포함 — SPEC-NAV-001), `index.tsx` (인증 상태 기반 진입 분기: `(tabs)` 또는 `(auth)` 리다이렉트 — SPEC-NAV-001), `_dev.tsx` (컴포넌트 데모 및 dark 토글 기능, `__DEV__` 게이트)
- **`app/(tabs)/`** (4개 탭 네비게이션 — SPEC-NAV-001): `_layout.tsx` (Tabs 네비게이터, Feather 아이콘, 디자인 토큰 스타일링, 인증 가드, SPEC-BOOK-001 M4 search/scan href:null 등록), `index.tsx` (홈 탭 placeholder), `library.tsx` (서재 탭 — SPEC-BOOK-001 M4 검색 진입 CTA "책 검색하기" + 헤더 검색 아이콘), `clubs.tsx` (모임 탭 placeholder), `my.tsx` (마이 탭 placeholder), `[bookId].tsx` (도서 상세 스택 라우트 — SPEC-BOOK-001 M4 BookDetailScreen 통합), `search.tsx` (SPEC-BOOK-001 M4 검색 화면 라우트, href:null, ISBN 자동 전환 param 지원), `scan.tsx` (SPEC-BOOK-001 M4 바코드 스캔 화면 라우트, href:null), `clubs/[clubId].tsx` (모임 상세 스택 라우트)
- **`app/(auth)/`** (인증 라우트 그룹): `_layout.tsx` (인증 가드 — 인증 사용자의 접근 시 `(tabs)` 리다이렉트 — SPEC-NAV-001), `login.tsx` (로그인 화면 — `src/auth/login.tsx` 리익스포트), `onboarding.tsx` (온보딩 화면 — `src/auth/onboarding.tsx` 리익스포트), `auth/callback.tsx` (OAuth 콜백 라우트 — SPEC-NAV-001), `__tests__/` (인증 화면 테스트)
- **`src/auth/`** (인증 모듈 — SPEC-AUTH-001):
  - `AuthContext.tsx` (AuthProvider + 인증 상태 관리: session, user, profile, loading, onAuthStateChange, getSession, signInWithProvider, signOut, refreshProfile, fetchProfile 캐싱)
  - `useSession.ts` (인증 훅: `null` 반환 시 loading, `{ isAuthenticated, isOnboarded, ... }` 객체 반환 시 authenticated/unauthenticated — SPEC-NAV-001 인증 가드에서 소비)
  - `types.ts` (AuthProvider 유니온 타입: `'kakao' | 'apple' | 'google'`, UserProfile 인터페이스, AuthContextValue 타입)
  - `oauth.ts` (OAuth 딥링크 처리: getOAuthRedirectUri — expo-linking 래퍼)
  - `login.tsx` (LoginScreen — 카카오/애플/구글 OAuth 버튼)
  - `onboarding.tsx` (OnboardingScreen — 닉네임 검증(1~20자), avatar 선택, UPDATE 요청, refreshProfile 호출)
- **`src/components/`** (7가지 커스텀 컴포넌트): `Button.tsx`, `Card.tsx`, `ProgressBar.tsx`, `BookCard.tsx` (서재용, 진행률 표시), `SearchResultCard.tsx` (SPEC-BOOK-001 M4 검색 결과용, Pencil x8zuOu 기반, BookCard와 분리), `EmotionRecordCard.tsx`, `StickerReaction.tsx`
- **`src/theme/`** (디자인 시스템): `tokens.ts` (light 모드 토큰), `darkTokens.ts` (dark 모드 토큰), `theme.tsx` (ThemeProvider + useTheme + useManualMode 패턴)
- **`src/types/`** (타입 정의): `book.ts` (BookRow, SearchResult, SearchTarget + type guards, M2 완료), `EmotionRecord.ts`, `StickerType.ts` 도메인 타입 정의
- **`src/config/`** (환경 변수 검증 및 접근): `env.ts` — 기존 `getEnvVar`/`getOptionalEnvVar`(런타임 검증)에 더해 SPEC-DEPLOY-001 M1에서 `validateEnv`(빌드 시점 fail-fast 검증), `MissingEnvError`(전용 에러 클래스), `REQUIRED_PROD`(프로덕션 필수 키 목록)가 추가됨
- **`src/features/book/`** (도서 검색·스캔·화면, M1~M4 완료): `searchApi.ts` (searchBooks, 빈 쿼리 차단), `bookDetailApi.ts` (getBookDetail, PGRST116→NOT_FOUND), `isbn.ts` (M3 — isValidIsbn/isValidIsbn13/isValidIsbn10, ISBN 체크디지트 검증), `debounce.ts` (M3 — shouldSuppressDuplicate 순수 함수, DUPLICATE_DEBOUNCE_MS=2000), `format.ts` (M4 — formatPublishedMonth 공유 유틸), `BarcodeScanner.tsx` (M3 — CameraView/useCameraPermissions, 권한 게이트 3상태, ISBN 바코드 타입 필터), `BookSearchScreen.tsx` (M4 — 검색 메인 화면, Pencil F06-Search), `BookDetailScreen.tsx` (M4 — 도서 상세 화면, useSession 세션 가드), `resolveBookId.ts` (ISBN→UUID 변환 — books.isbn UNIQUE lookup, @MX:ANCHOR), `index.ts` (통합 진입점 — searchBooks, getBookDetail, BarcodeScanner, isValidIsbn* barrel)
- **`src/features/library/`** (서재 관리, SPEC-LIBRARY-001 완료 — 2026-06-16): `libraryApi.ts` (getLibrary, addLibraryItem, updateProgress, updateStatus, deleteItem — PostgREST API 레이어), `useLibrary.ts` (서재 목록 훅 — React Query useQuery), `useLibraryItem.ts` (단일 항목 훅 — useMutation, optimistic update, invalidateQueries), `types.ts` (LibraryItem, ProgressInput, StatusInput 타입 정의), `progressValidation.ts` (진도 검증 — 페이지 상한, 음수 차단), `progressRate.ts` (진도률 계산 — (current_page / total_pages) * 100), `index.ts` (통합 진입점)
- **`src/features/emotion/`** (감정 기록, SPEC-EMOTION-001 완료 — 2026-06-17): `types.ts` (EmotionRecordWithAuthor, StickerAggregate, Visibility, CreateInput, UpdateInput, SortOption — DB Row derived), `emotionApi.ts` (create/list/update/delete — PostgREST 직접, client-side pre-validation, users 조인 + sticker GROUP BY, spoiler split), `stickerApi.ts` (precheck/create/delete/aggregate — 409 UNIQUE→VALIDATION mapping via normalizeError, no upsert), `useEmotionRecords.ts` (React Query 훅 — queryKey ['emotion',{bookId,userId}], cache invalidation), `useStickerReaction.ts` (optimistic update + 409 rollback, useReplaceSticker DELETE→POST), `questionPrompts.ts` (정적 풀 5개, round-robin by currentPage), `EmotionInputScreen.tsx` (입력 화면 — page/content/question/visibility toggle, pageNumber validation), `TimelineScreen.tsx` (타임라인 화면 — EmotionRecordCard list, sort toggle time/page, spoiler blur via isSpoiler prop), `index.ts` (통합 진입점)
- **`src/features/completion/`** (완독 다이어리, SPEC-COMPLETION-001 완료 — 2026-06-17): `types.ts` (ReportData/EmotionCurvePoint/Highlight + 순수 타입 가드 isReportData()), `completionApi.ts` (fetchReport — PostgREST GET 래퍼 + 재시도 최대3 + 점진백오프 + normalizeError, RLS auth.uid() 신뢰), `useCompletionReport.ts` (useState/useEffect 기반 6상태 훅: loading/success/empty/error/data-error/auth), `EmotionCurveChart.tsx` (순수 SVG 감정 곡선, 단일 brand-500 색상, 페이지별 수량), `HighlightList.tsx` (FlatList 하이라이트), `CelebrationHeader.tsx` (정적 배지 + 축하 메시지 MVP), `CompletionDiaryScreen.tsx` (메인 통합 화면, 6상태 분기 렌더링), `index.ts` (통합 진입점)
- **`src/lib/query/`** (React Query v5 인프라): `queryClient.ts` (QueryClient 싱글톤 — defaultOptions 3분간 staleTime, retry 1회, mutations retry 없음)
- **`src/lib/supabase/`** (Supabase 클라이언트): `client.ts` (getSupabiceClient 싱글톤), `storageAdapter.ts` (SecureStore/AsyncStorage 폴백 세션 저장소 어댑터)
- **`src/lib/api/`** (API 레이어): `errors.ts` (AppError 계층 구조 + normalizeError/classifyError), `retry.ts` (retryWithBackoff), `edgeFunctions.ts` (invokeEdgeFunction), `index.ts` (통합 진입점)
- **`src/errors/`** (공통 에러 처리): `AppError.ts` (AppError 기본 클래스 + 7개 서브클래스 + ErrorCategory 타입)

### 아키텍특 특징

- Expo Router를 통한 파일 시스템 기반 라우팅으로 네비게이션 관리
- **네비게이션 구조 (SPEC-NAV-001)**:
  - 루트 `_layout.tsx`에 `(tabs)`와 `(auth)` 그룹 라우트를 포함하는 Stack 네비게이터
  - 4개 탭 네비게이션(홈/서재/모임/마이) — Feather 아이콘, 디자인 토큰 스타일링, `useTheme()` 연동
  - 인증 가드: `useSession()` 기반 진입 분기(`null` → 스플래시, `isAuthenticated===true` → `(tabs)`, `isAuthenticated===false` → `(auth)`)
  - 양방향 그룹 보호: 인증 사용자의 `(auth)` 접근 차단, 미인증 사용자의 `(tabs)` 접근 차단
  - 스택 네비게이션: `[bookId]`, `clubs/[clubId]` 동적 라우트, 기본 슬라이드 전환
  - 딥링크: `sagak://` 스킴, `auth/callback` OAuth 콜백 라우트
- **인증 아키텍처 (SPEC-AUTH-001)**: 
  - AuthContext가 앱 최상위(`app/_layout.tsx`)에서 ThemeProvider 내부에 배치되어 전역 인증 상태 관리
  - `src/auth/` 모듈에 실제 구현(컴포넌트 분리, 테스트 용이성), `app/(auth)/`는 얇은 리익스포트 레이어(Expo Router 패턴)
  - useSession 훅이 `null`(loading) 또는 `{ isAuthenticated, isOnboarded, ... }`(authenticated/unauthenticated) 반환 — SPEC-NAV-001 인증 가드에서 소비
  - 자동 로그인: getSession()으로 앱 시작 시 세션 복원, onAuthStateChange로 4이벤트 구독(INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)
  - OAuth 플로우: signInWithOAuth(provider, { redirectTo: getOAuthRedirectUri() })로 카카오/애플/구글 로그인 처리
- ThemeProvider와 useTheme 훅을 통한 테마 관리 시스템 (수동 dark 모드 전환)
- React Context API 기반 상태 관리
- 7가지 재사용 가능 UI 컴포넌트 라이브러리 (SearchResultCard 추가 — SPEC-BOOK-001 M4)
- TypeScript strict 모드를 통한 타입 안정성
- Supabase 백엔드와의 분리된 프론트엔드 아키텍처
- **API 파운데이션 (SPEC-API-001)**: 환경 변수 검증 → app.config.ts extra → Constants.expoConfig.extra → env.ts 검증 → createClient 파이프라인
- **에러 파이프라인 (SPEC-API-001)**: normalizeError → classifyError → retryWithBackoff → getUserFriendlyMessage/logToSentry
- **세션 영속화 (SPEC-API-001)**: SecureStore(iOS Keychain/Android Keystore) → 2KB 초과 시 AsyncStorage 폴백

> **참고**: 이 클라이언트 아키텍처는 SPEC-UI-001에서 구현된 프론트엔드 기반으로, SPEC-API-001(백엔드 통합 파운데이션)이 Supabase 백엔드와 연결되며, SPEC-AUTH-001(OAuth 인증 및 세션 관리)이 인증 시스템을 완성했습니다.

## 데이터 모델

| 엔터티 | 설명 | 주요 관계 |
|-------|------|----------|
| users | 사용자 계정 정보 (인증, 프로필, 설정) | → user_books (1:N), → emotion_records (1:N), → club_members (1:N) |
| books | 책 정보 (ISBN, 제목, 저자, 표지) | → user_books (1:N), → clubs (1:N) |
| user_books | 사용자-책 연결 (진도, 상태, 시작일) | → users (N:1), → books (N:1), → emotion_records (1:N) |
| emotion_records | 감정 기록 (페이지, 단어, 감정, 생성일) | → user_books (N:1), → sticker_reactions (1:N) |
| clubs | 독서 모임 (정보, 진도, 설정) | → books (N:1), → club_members (1:N), → join_requests (1:N) |
| club_members | 모임 멤버 (가입일, 권한) | → users (N:1), → clubs (N:1) |
| join_requests | 가입 요청 (상태, 요청일) | → users (N:1), → clubs (N:1) |
| reading_sessions | 독서 세션 (시작/종료 시간, 지속 시간) | → user_books (N:1) |
| completion_reports | 완독 보고서 (자동 생성된 다이어리) | → user_books (N:1) |
| sticker_reactions | 감정 스티커 반응 (종류, 반응 시간) | → emotion_records (N:1), → users (N:1) |
| point_logs | 포인트 로그 (적립/사용 내역) | → users (N:1) |

> **참고**: 클라이언트는 REST 엔드포인트를 호출하며, 외부 API 연동(Kakao 등)은 Supabase Edge Function이 프록시합니다.

## API 서피스

**Authentication (OAuth)**
- `POST /auth/register` - 사용자 가입
- `POST /auth/login` - 로그인 (카카오/애플/구글 OAuth)
- `POST /auth/logout` - 로그아웃
- `GET /auth/me` - 현재 사용자 정보

**Books (검색/스캔/상세) — M1~M4 구현 완료 (2026-06-16)**
- `searchBooks(query, target)` - 도서 검색 (내부적으로 Edge Function `kakao-book-search` 프록시 호출, `src/features/book/searchApi.ts`)
- `getBookDetail(bookId)` - 책 상세 정보 (`src/features/book/bookDetailApi.ts`)
- `BarcodeScanner` 컴포넌트 - 카메라 ISBN 바코드 스캔 (M3 완료, `src/features/book/BarcodeScanner.tsx`, expo-camera ~55.0.19)
- `isValidIsbn(value)` / `isValidIsbn13` / `isValidIsbn10` - ISBN 체크디지트 검증 (M3 완료, `src/features/book/isbn.ts`)
- `SearchResultCard` 컴포넌트 - 검색 결과 카드 (M4 완료, `src/components/SearchResultCard.tsx`, BookCard와 분리)
- `BookSearchScreen` / `BookDetailScreen` 컴포넌트 - 검색·상세 화면 (M4 완료, Pencil F06-Search/F07 기반)
- `GET /books/{id}/cover` - 책 표지 이미지 (직접 렌더링, Storage 업로드 없음)

**Library CRUD (서재 관리)**
- `GET /library` - 내 서재 목록
- `POST /library` - 책 추가 (진도 0)
- `PUT /library/{book_id}` - 진도 업데이트
- `DELETE /library/{book_id}` - 서재에서 삭제

**Records CRUD+sticker (감정 기록)**
- `GET /records/{book_id}` - 특정 책의 감정 기록
- `POST /records` - 새 감정 기록 추가
- `PUT /records/{record_id}` - 기록 수정
- `POST /records/{record_id}/reactions` - 스티커 반응

**Sessions (독서 세션·타이머)**
- `POST /sessions` - 독서 세션 시작
- `PATCH /sessions/{id}/end` - 세션 종료 (지속 시간 기록)
- `GET /sessions/stats` - 독서 통계 (누적 시간, 루틴)

**Clubs CRUD (모임 관리)**
- `GET /clubs` - 내 모임 및 추천 모임
- `POST /clubs` - 새 모임 생성 (Track B)
- `GET /clubs/{id}` - 모임 상세 정보
- `POST /clubs/{id}/join` - 가입 요청 (Track A)
- `PUT /clubs/{id}/progress` - 진도 업데이트
- `GET /clubs/{id}/feed` - 진도별 슬라이딩 피드 (현재 진도 기반 스포일러 블러 처리, Supabase Realtime 구독과 병행)

**Users profile+notifications (사용자 정보)**
- `GET /users/{id}` - 사용자 프로필
- `PUT /users/{id}` - 프로필 업데이트
- `GET /users/{id}/stats` - 독서 통계
- `GET /users/{id}/points` - 포인트 적립/사용 내역 조회 (MVP는 조회 전용, 사용은 후순위)
- `POST /users/{id}/notifications` - 알림 설정

**Edge Functions (카카오 연동, 가입 요청 처리, 완독 보고서)**
- `POST /functions/kakao-book-search` - 카카오 도서 검색 프록시 (M1 구현 완료, 2026-06-16)
- `POST /functions/process-join-request` - 가입 요청 처리
- `POST /functions/generate-completion-report` - 완독 다이어리 생성
- `POST /functions/send-notification` - 푸시 알림 발송

## 외부 연동

**Kakao Book API**
- 도서 검색: ISBN/제목/저자로 도서 정보 검색
- 표지 이미지: 저작권 허용 범위 내 표지 이미지 제공
- 데이터 동기화: 주기적으로 도서 정보 업데이트

**OAuth providers**
- Kakao: 한국 사용자 편의성 강화, 간편 로그인
- Naver: Supabase Custom OIDC 연동 (v1.0.1, 2026-06-17 — Apple 제외, App Store Guideline 4.8 한국 예외 적용)
- Google: Google 계정 연동, 백업 및 복원 지원

## 빌드·배포 인프라 파일 (SPEC-DEPLOY-001 M1+M5, PR #15 2514263)

> 2026-06-17 추가. SPEC-DEPLOY-001의 부분 진행(M1 환경 변수 + EAS 빌드 파운데이션, M5 OAuth 매뉴얼 문서화) 산출물.

**빌드/배포 설정**:
- `app.config.ts` — Expo 앱 설정. SPEC-DEPLOY-001 M1에서 빌드 시점 `validateEnv(process.env, ENV)` 호출(환경 변수 fail-fast 게이트)을 추가하고 `EXPO_PUBLIC_SENTRY_DSN`을 `extra`에 노출
- `eas.json` — EAS Build 설정. 3개 빌드 프로필: `development`(개발), `preview`(스테이징), `production`(프로덕션)
- `.env.example` / `.env.staging` / `.env.production` — 환경 변수 템플릿. `SENTRY_DSN` 플레이스홀더 포함 (M3 Sentry SDK 통합 대비)

**배포 매뉴얼**:
- `docs/deployment.md` — OAuth 콘솔 등록 절차(Kakao/Naver/Google) + Supabase Auth 제공자 활성화 가이드 + `.env` 설정 가이드. OAuth 콜백 URI `sagak://auth/callback`은 이미 `src/auth/oauth.ts`에 존재(본 문서는 절차만 문서화, 재구현 아님)

> **참고**: SPEC-DEPLOY-001의 나머지 마일스톤(M2 GitHub Actions CI, M3 Sentry SDK 통합, M4 EAS Submit, M6 Edge Function 배포)은 미완료. M6은 SPEC-CLUB-001 / SPEC-NOTIF-001 의존으로 블로킹.