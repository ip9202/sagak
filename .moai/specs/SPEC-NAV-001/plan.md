---
id: SPEC-NAV-001
title: "Navigation & Routing Structure — Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-NAV-001 구현 계획

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 라우트 맵, 마일스톤, 기술 접근, 리스크 정의 | 강력쇠주먹 |

---

## 1. 라우트 맵 (Route Map)

파일 시스템 라우팅 기반의 전체 라우트 구조와 각 라우트의 담당 SPEC 매핑.

### 1.1 전체 디렉토리 구조 (목표 상태)

```
app/
├── _layout.tsx                      # 루트 레이아웃 — ThemeProvider 보존 + (tabs)/(auth) 그룹
├── index.tsx                        # 진입점 — useSession() 기반 리다이렉트
├── _dev.tsx                         # 개발 전용 데모 (기존 유지, __DEV__ 게이트)
├── (auth)/                          # 미인증 그룹
│   ├── _layout.tsx                  # 인증 그룹 레이아웃 (Stack, headerShown 제어)
│   ├── login.tsx                    # 로그인 화면 (OAuth 버튼)
│   ├── onboarding.tsx               # 온보딩/프로필 설정 (최초 1회)
│   └── auth/
│       └── callback.tsx             # OAuth 콜백 수신 라우트 (sagak://auth/callback)
└── (tabs)/                          # 인증 후 그룹
    ├── _layout.tsx                  # 탭 네비게이터 (4개 탭, 디자인 토큰 스타일링)
    ├── index.tsx                    # 홈 탭 (placeholder 셸)
    ├── library.tsx                  # 서재 탭 (placeholder 셸)
    ├── clubs.tsx                    # 모임 탭 (placeholder 셸)
    ├── my.tsx                       # 마이 탭 (placeholder 셸)
    ├── [bookId].tsx                 # 도서 상세 (동적 라우트, placeholder 셸)
    └── clubs/
        └── [clubId].tsx             # 모임 상세 (중첩 동적 라우트, placeholder 셸)
```

### 1.2 라우트 ↔ 화면 ↔ 담당 SPEC 매핑

| 라우트 파일 | URL 경로 | 화면 명칭 | 구현 범위 (본 SPEC) | 콘텐츠 담당 SPEC |
|------------|----------|-----------|-------------------|-----------------|
| `app/_layout.tsx` | (루트) | 루트 레이아웃 | ThemeProvider 보존 + 그룹 라우트 등록 | SPEC-UI-001 (ThemeProvider) |
| `app/index.tsx` | `/` | 진입 분기 | `useSession()` 기반 리다이렉트 로직 | SPEC-AUTH-001 (`useSession`) |
| `app/_dev.tsx` | `/_dev` | 컴포넌트 데모 | 기존 유지, `__DEV__` 게이트 | SPEC-UI-001 |
| `app/(auth)/_layout.tsx` | (그룹) | 인증 그룹 레이아웃 | Stack + 양방향 가드(인증 시 (tabs) 리다이렉트) | 본 SPEC |
| `app/(auth)/login.tsx` | `/login` | 로그인 화면 | placeholder 셸 + OAuth 버튼 자리 | SPEC-AUTH-001 |
| `app/(auth)/onboarding.tsx` | `/onboarding` | 온보딩/프로필 설정 | placeholder 셸 | SPEC-AUTH-001 |
| `app/(auth)/auth/callback.tsx` | `/auth/callback` | OAuth 콜백 | 딥링크 수신 → 세션 처리 위임 → 리다이렉트 | SPEC-AUTH-001 |
| `app/(tabs)/_layout.tsx` | (그룹) | 탭 네비게이터 | 4개 탭 + 디자인 토큰 스타일링 | 본 SPEC |
| `app/(tabs)/index.tsx` | `/` (홈) | 홈 탭 | placeholder 셸 | (홈 도메인 SPEC — 향후 정의) |
| `app/(tabs)/library.tsx` | `/library` | 서재 탭 | placeholder 셸 | SPEC-LIBRARY-001 |
| `app/(tabs)/clubs.tsx` | `/clubs` | 모임 탭 | placeholder 셸 | SPEC-CLUB-001, SPEC-CLUB-002 |
| `app/(tabs)/my.tsx` | `/my` | 마이 탭 | placeholder 셸 | SPEC-PROFILE-001 |
| `app/(tabs)/[bookId].tsx` | `/[bookId]` | 도서 상세 | 동적 라우트 골격 + `bookId` 파라미터 수신 | SPEC-LIBRARY-001, SPEC-EMOTION-001 |
| `app/(tabs)/clubs/[clubId].tsx` | `/clubs/[clubId]` | 모임 상세 | 중첩 동적 라우트 골격 + `clubId` 파라미터 수신 | SPEC-CLUB-001, SPEC-FEED-001 |

> "구현 범위 (본 SPEC)" 열이 본 SPEC의 실제 산출물이다. "콘텐츠 담당 SPEC" 열은 본 SPEC이 라우트 파일 골격만 제공하고 콘텐츠는 위임함을 명시한다.

### 1.3 기존 파일 보존 정책

| 기존 파일 | 처리 방식 | 근거 |
|----------|-----------|------|
| `app/_layout.tsx` | **수정** — ThemeProvider 보존, 하위 Stack에 `(tabs)`/`(auth)` 그룹 추가 | SPEC-UI-001 자산 보존 |
| `app/index.tsx` | **전환** — 데모 콘텐츠 제거, `useSession()` 리다이렉트 로직으로 전환 | 진입 분기 역할 부여 |
| `app/_dev.tsx` | **유지** — `__DEV__` 게이트 추가 (프로덕션 빌드 제외) | SPEC-UI-001 데모 자산 보존 |

---

## 2. 마일스톤 (우선순위 기반)

> 본 계획은 시간 추정을 포함하지 않는다. 우선순위 라벨과 의존성 순서로 마일스톤을 정의한다 (TRUST 5 Trackable 원칙).

### Milestone 1: Primary Goal — 루트 레이아웃 확장 및 진입 분기

**우선순위**: High

**범위**:
- `app/_layout.tsx` 수정 — ThemeProvider 보존 + `(tabs)`/`(auth)` 그룹 라우트 등록
- `app/index.tsx` 전환 — `useSession()` 기반 리다이렉트 로직 (loading/authenticated/unauthenticated 분기)
- `app/_dev.tsx` — `__DEV__` 게이트 추가

**완료 기준**:
- ThemeProvider 래퍼가 보존됨 (SPEC-UI-001 테스트 통과)
- `useSession()` 상태별 리다이렉트가 정상 동작 (acceptance.md 시나리오 G1~G3)

**의존성**: SPEC-AUTH-001 `useSession()` 훅 가용성 (인터페이스만先行 정의 가능)

### Milestone 2: Primary Goal — (tabs) 그룹 및 4개 탭 골격

**우선순위**: High

**범위**:
- `app/(tabs)/_layout.tsx` — 4개 탭 네비게이터 정의, Feather 아이콘, 디자인 토큰 스타일링
- `app/(tabs)/index.tsx` (홈) — placeholder 셸
- `app/(tabs)/library.tsx` (서재) — placeholder 셸
- `app/(tabs)/clubs.tsx` (모임) — placeholder 셸
- `app/(tabs)/my.tsx` (마이) — placeholder 셸

**완료 기준**:
- 4개 탭이 모두 렌더링됨 (acceptance.md 시나리오 T1)
- 탭바 스타일이 pages_11 §10 토큰과 일치 (acceptance.md 시나리오 T2)
- 활성/비활성 탭 색상 분기 정상 동작 (acceptance.md 시나리오 T3)
- 다크모드 전환 시 탭바 스타일 정상 (acceptance.md 시나리오 T4)

**의존성**: Milestone 1 완료, SPEC-UI-001 `useTheme()` + `tokens.ts`

### Milestone 3: Primary Goal — (auth) 그룹 및 인증 가드

**우선순위**: High

**범위**:
- `app/(auth)/_layout.tsx` — 인증 그룹 레이아웃 + 양방향 가드
- `app/(auth)/login.tsx` — placeholder 셸 (OAuth 버튼 자리)
- `app/(auth)/onboarding.tsx` — placeholder 셸
- 인증 가드 로직 — REQ-NAV-020 ~ REQ-NAV-023 (loading 스플래시, authenticated/unauthenticated 리다이렉트, 온보딩 미완료 가드)

**완료 기준**:
- 미인증 사용자가 `(tabs)` 접근 시 `(auth)/login` 리다이렉트 (acceptance.md 시나리오 G4)
- 인증 사용자가 `(auth)` 접근 시 `(tabs)` 리다이렉트 (acceptance.md 시나리오 G5)
- 온보딩 미완료 인증 사용자가 온보딩 화면으로 리다이렉트 (acceptance.md 시나리오 G6)
- loading 상태에서 점멸 없음 (acceptance.md 시나리오 G7)

**의존성**: Milestone 1, Milestone 2 완료, SPEC-AUTH-001 `useSession()` 세션 메타데이터 (온보딩 완료 여부)

### Milestone 4: Secondary Goal — 스택 하위 라우트 골격

**우선순위**: Medium

**범위**:
- `app/(tabs)/[bookId].tsx` — 도서 상세 동적 라우트 골격
- `app/(tabs)/clubs/[clubId].tsx` — 모임 상세 중첩 동적 라우트 골격

**완료 기준**:
- `bookId`/`clubId` 파라미터가 정상 수신됨 (acceptance.md 시나리오 S1, S2)
- 탭 내 하위 화면 진입/복귀 스택 동작 정상 (acceptance.md 시나리오 S3)
- 뒤로 가기 동작 정상 (acceptance.md 시나리오 S4)

**의존성**: Milestone 2 완료

### Milestone 5: Secondary Goal — 딥링크 (OAuth 콜백)

**우선순위**: Medium

**범위**:
- `app.json` / `app.config.js` — 딥링크 스킴 `sagak://` 등록 (iOS + Android)
- `app/(auth)/auth/callback.tsx` — OAuth 콜백 수신 라우트
- 콜백 수신 → 세션 처리 위임 → 리다이렉트 연결

**완료 기준**:
- `sagak://auth/callback` 딥링크가 콜백 라우트로 수신됨 (acceptance.md 시나리오 D1)
- 유효 토큰 수신 시 인증 완료 후 홈/온보딩 리다이렉트 (acceptance.md 시나리오 D2)
- 에러 수신 시 로그인 화면 리다이렉트 (acceptance.md 시나리오 D3)

**의존성**: Milestone 3 완료, SPEC-AUTH-001 세션 처리 로직, SPEC-DEPLOY-001 OAuth 앱 등록 (스킴 등록은 본 SPEC, 대시보드 URL 설정은 SPEC-DEPLOY-001)

### Milestone 6: Optional Goal — 접근성 및 백 핸들러 검증

**우선순위**: Low

**범위**:
- 탭바 `accessibilityLabel` 및 `accessibilityRole` 부여
- 탭 터치 타겟 44dp 준수 검증
- Android 백 핸들러 기본 동작 검증 (React Navigation 기본값)

**완료 기준**:
- 스크린 리더가 탭 레이블을 읽어줌 (acceptance.md 시나리오 A1)
- 모든 탭 터치 타겟이 44dp 이상 (acceptance.md 시나리오 A2)
- Android 뒤로 가기 버튼이 스택 팝 후 루트에서 앱 종료 (acceptance.md 시나리오 A3)

**의존성**: Milestone 2 완료

---

## 3. 기술 접근

### 3.1 프레임워크 및 라이브러리

| 항목 | 기술 | 버전 | 근거 |
|------|------|------|------|
| 라우팅 | `expo-router` | ~5 | tech.md 프론트엔드 섹션 |
| 런타임 | React Native + Expo SDK | 0.83.2 + 55 | tech.md, SPEC-UI-001 |
| 네비게이션 | React Navigation (expo-router 내장) | ~7 | expo-router 의존성 |
| 아이콘 | `@expo/vector-icons` (Feather) | SDK 번들 | SPEC-UI-001 이미 사용 |
| 세션 훅 | `useSession()` (SPEC-AUTH-001 제공) | TBD | SPEC-AUTH-001 인터페이스 |
| 딥링크 | `expo-linking` | SDK 번들 | Expo Router 통합 |

### 3.2 디자인 토큰 소비 패턴

탭바 및 네비게이션 스타일링은 `useTheme()` 훅을 통해 SPEC-UI-001의 토큰을 소비한다:

- 색상: `theme.colors.brand[500]` (활성 탭), `theme.colors.text.tertiary` (비활성 탭), `theme.colors.bg.surface` (탭바 배경), `theme.colors.border.default` (탭바 상단 보더)
- 타이포그래피: `theme.typography.label` (탭 레이블, 11sp / 500)
- 간격: `theme.spacing` (탭바 패딩, safe area)
- 아이콘 크기: `theme.iconSizes.md` (20dp)

> 하드코딩된 색상/간격 값은 금지된다. 모든 스타일 값은 `useTheme()`에서 가져온다 (SPEC-UI-001 패턴 준수). 다크모드는 `useTheme()`이 `darkTokens.ts`를 자동 반환하므로 별도 분기 로직이 불필요하다.

### 3.3 인증 가드 구현 패턴

선언적 리다이렉트 방식을 사용한다:

1. `app/index.tsx` (진입 분기):
   - `useSession()` 호출 → `loading` / `authenticated` / `unauthenticated` 상태 획득
   - `loading` 시: 스플래시/`ActivityIndicator` 렌더링 (네이티브 `expo-splash-screen` 유지 권장)
   - `authenticated` + 온보딩 완료 시: `router.replace('/(tabs)/')` (홈)
   - `authenticated` + 온보딩 미완료 시: `router.replace('/(auth)/onboarding')`
   - `unauthenticated` 시: `router.replace('/(auth)/login')`

2. `app/(tabs)/_layout.tsx` (그룹 보호):
   - `useSession()` 확인 → `unauthenticated` 시 `router.replace('/(auth)/login')`

3. `app/(auth)/_layout.tsx` (그룹 보호):
   - `useSession()` 확인 → `authenticated` + 온보딩 완료 시 `router.replace('/(tabs)/')`

> `router.replace`를 사용하는 이유: 인증 플로우에서 뒤로 가기 스택에 진입 분기 화면을 남기지 않기 위함. `router.push`는 사용자가 뒤로 가기 시 인증 화면으로 회귀하는 문제를 유발한다.

### 3.4 그룹 라우트 전략

- `(tabs)`와 `(auth)`는 URL 경로에서 제외되는 괄호 그룹이다 (예: `/library` not `/(tabs)/library`).
- 두 그룹은 동시에 마운트되지 않는다. 인증 상태 전환 시 한 그룹 전체가 언마운트되고 다른 그룹이 마운트된다.
- 이는 스택 히스토리 격리를 보장한다 (예: 인증 만료 시 `(tabs)` 스택이 통째로 사라지고 `(auth)` 스택이 새로 시작).

### 3.5 딥링크 구현 패턴

1. `app.json` (또는 `app.config.js`):
   - `scheme: "sagak"` 등록 (Expo Router가 자동으로 iOS/Android 딥링크 설정 생성)
   - Supabase 대시보드 리다이렉트 URL: `sagak://auth/callback`

2. `app/(auth)/auth/callback.tsx`:
   - `useLocalSearchParams()`로 URL 쿼리 파라미터 수신
   - Supabase Auth 세션 교환 로직은 SPEC-AUTH-001에 위임
   - 결과에 따라 홈/온보딩/로그인 리다이렉트

---

## 4. 아키텍처 설계 방향

### 4.1 계층 구조

```
ThemeProvider (SPEC-UI-001, app/_layout.tsx)
└── Root Stack (app/_layout.tsx)
    ├── index (진입 분기 — useSession 리다이렉트)
    ├── _dev (개발 전용)
    ├── (auth) Group
    │   └── Auth Stack
    │       ├── login
    │       ├── onboarding
    │       └── auth/callback
    └── (tabs) Group
        ├── Tabs Navigator
        │   ├── 홈 (index)
        │   ├── 서재 (library)
        │   ├── 모임 (clubs)
        │   └── 마이 (my)
        └── Stack (탭 내 하위 화면)
            ├── [bookId]
            └── clubs/[clubId]
```

### 4.2 상태 관리

- 인증 상태: `useSession()` (SPEC-AUTH-001 AuthContext) — 전역
- 라우팅 상태: Expo Router 내장 (`useRouter`, `useLocalSearchParams`, `useSegments`)
- 탭 상태: React Navigation `Tabs` 네비게이터 내장 (본 SPEC에서 별도 상태 관리 불필요)

> 본 SPEC은 전역 상태를 새로 도입하지 않는다. SPEC-AUTH-001의 `useSession()`과 Expo Router의 내장 상태만 소비한다.

### 4.3 파일 소유권 전략

본 SPEC이 생성/수정하는 파일은 향후 도메인 SPEC이 확장할 수 있다. 소유권 경계:

| 파일 | 본 SPEC 소유 | 후속 SPEC 확장 가능 영역 |
|------|-------------|------------------------|
| `app/(tabs)/_layout.tsx` | 탭 구조, 아이콘, 스타일링 | 탭 배지(알림 카운트 등) — SPEC-NOTIF-001 |
| `app/(tabs)/index.tsx` 등 4개 탭 | placeholder 셸 | 전체 콘텐츠 — 각 도메인 SPEC |
| `app/(tabs)/[bookId].tsx` | 동적 라우트 골격 | 전체 콘텐츠 — SPEC-LIBRARY-001 |
| `app/(auth)/_layout.tsx` | 그룹 레이아웃 + 양방향 가드 | (확장 여지 낮음) |
| `app/(auth)/login.tsx` | placeholder 셸 | OAuth 버튼, 로직 — SPEC-AUTH-001 |
| `app/(auth)/onboarding.tsx` | placeholder 셸 | 프로필 설정 폼 — SPEC-AUTH-001 |
| `app/(auth)/auth/callback.tsx` | 딥링크 수신 골격 | 세션 처리 위임 호출 — SPEC-AUTH-001 |

---

## 5. 리스크 및 대응 계획

### 리스크 R1: SPEC-AUTH-001 `useSession()` 인터페이스 미정의 (높음)

**문제**: 본 SPEC은 `useSession()`이 `loading`/`authenticated`/`unauthenticated` 상태와 온보딩 완료 메타데이터를 반환한다고 가정하나, SPEC-AUTH-001이 아직 draft 단계이다.

**대응**:
- 본 SPEC 구현 시 `useSession()` 인터페이스를 타입 정의로 먼저 고정한다 (`src/auth/useSession.ts`에 skeleton 타입만 정의)
- SPEC-AUTH-001 구현 시 이 인터페이스를 준수하도록 협약한다
- 인터페이스 불일치 발생 시 본 SPEC의 가정 섹션(2.2.1) 기준으로 SPEC-AUTH-001이 조정한다 (본 SPEC이 인터페이스 소스)

### 리스크 R2: 인증 상태 점멸 (loading → authenticated/unauthenticated 전환 시 깜빡임) (중간)

**문제**: `useSession()`이 비동기로 세션을 복원하는 동안 잠시 `(auth)/login`이 렌더링된 후 `(tabs)`로 전환되면 사용자가 로그인 화면을 잠시 보게 된다.

**대응**:
- `expo-splash-screen` 네이티브 스플래시를 세션 복원 완료까지 유지 (`useSession()` loading 시 `SplashScreen.preventAutoHideAsync()`)
- `loading` 상태에서는 어떤 라우트도 렌더링하지 않고 `ActivityIndicator`만 표시 (REQ-NAV-020)
- acceptance.md 시나리오 G7로 점멸 없음 검증

### 리스크 R3: 기존 SPEC-UI-001 테스트 회귀 (중간)

**문제**: `app/_layout.tsx` 수정 시 기존 SPEC-UI-001의 72개 테스트(커버리지 93.68%)가 실패할 수 있다.

**대응**:
- ThemeProvider 래퍼를 절대 제거/변경하지 않는다
- 수정 후 `npm test`로 SPEC-UI-001 테스트 전수 통과 확인 (acceptance.md 시나리오 R1)
- `_dev.tsx` 라우트를 프로덕션 빌드에서 제외하되 개발 환경에서는 유지 (`__DEV__` 게이트)

### 리스크 R4: 딥링크 스킴 충돌 (낮음)

**문제**: `sagak://` 스킴이 다른 앱과 충거나 Supabase 대시보드 설정과 불일치할 수 있다.

**대응**:
- 스킴 이름은 제품명 기반(`sagak`)으로 고유성 확보
- Supabase 대시보드 리다이렉트 URL 설정과 `app.json` scheme이 일치하는지 구현 시 검증 (acceptance.md 시나리오 D1)
- OAuth 앱 등록 및 대시보드 설정은 SPEC-DEPLOY-001 영역으로 명시적 위임

### 리스크 R5: Android 백 핸들러 사용자 경험 (낮음)

**문제**: Android 물리 뒤로 가기 버튼이 탭 간 전환 시 예상치 못한 동작(예: 앱 즉시 종료)을 유발할 수 있다.

**대응**:
- React Navigation 기본 백 핸들러 동작을 따른다 (스택 팝 → 루트에서 앱 종료)
- 커스텀 백 핸들러는 MVP 범위 밖 (미결정 사항 5.5)
- acceptance.md 시나리오 A3로 기본 동작 검증

### 리스크 R6: 온보딩 완료 판단 기준 불확실성 (중간)

**문제**: "온보딩 완료" 판단 기준(예: `session.user.nickname` 존재 여부 vs 별도 플래그)이 SPEC-AUTH-001에서 확정되지 않았다.

**대응**:
- 본 SPEC은 "온보딩 완료 여부"를 `useSession()` 반환값의 불리언 필드(`isOnboardingComplete` 등)로 가정한다
- SPEC-AUTH-001 구현 시 이 필드를 제공하도록 협약 (리스크 R1과 동일한 인터페이스 협약)
- 구현 단계에서 실제 판단 로직은 SPEC-AUTH-001이 담당, 본 SPEC은 필드 소비만

---

## 6. 테스트 전략

### 6.1 단위 테스트 (Jest + @testing-library/react-native)

| 테스트 대상 | 검증 항목 | 관련 acceptance 시나리오 |
|------------|-----------|------------------------|
| `app/index.tsx` 리다이렉트 로직 | loading/authenticated/unauthenticated 분기 | G1, G2, G3 |
| `(tabs)/_layout.tsx` 가드 | 미인증 시 login 리다이렉트 | G4 |
| `(auth)/_layout.tsx` 가드 | 인증 시 tabs 리다이렉트 | G5 |
| 온보딩 가드 | 미완료 시 onboarding 리다이렉트 | G6 |
| 탭바 스타일 | brand-500/text-tertiary 색상 분기 | T2, T3 |
| `useSession()` 모킹 | 3가지 상태별 리다이렉트 | G1~G3 |

### 6.2 통합 테스트

| 테스트 대상 | 검증 항목 | 관련 acceptance 시나리오 |
|------------|-----------|------------------------|
| 전체 네비게이션 플로우 | 스플래시 → 인증 → 탭 진입 | G1~G3, G7 |
| 딥링크 수신 | OAuth 콜백 → 리다이렉트 | D1~D3 |
| SPEC-UI-001 회귀 | 기존 72개 테스트 통과 | R1 |

### 6.3 수동 검증

| 검증 항목 | 방법 | 관련 acceptance 시나리오 |
|-----------|------|------------------------|
| 다크모드 탭바 | 시스템 다크모드 전환 | T4 |
| Android 백 핸들러 | 물리 버튼 테스트 | A3 |
| 스크린 리더 탭 레이블 | VoiceOver/TalkBack 활성화 | A1 |
| 딥링크 실제 OAuth | Supabase OAuth 로그인 실행 | D1~D3 |

---

## 7. 산출물 요약

### 7.1 신규 파일 (12개)

```
app/(auth)/_layout.tsx
app/(auth)/login.tsx
app/(auth)/onboarding.tsx
app/(auth)/auth/callback.tsx
app/(tabs)/_layout.tsx
app/(tabs)/index.tsx          ← 기존 파일이지만 데모 → 진입 분기로 전환 (수정)
app/(tabs)/library.tsx
app/(tabs)/clubs.tsx
app/(tabs)/my.tsx
app/(tabs)/[bookId].tsx
app/(tabs)/clubs/[clubId].tsx
```

> `app/(tabs)/index.tsx`는 기존 `app/index.tsx`를 `(tabs)` 그룹으로 이동하는 것이다. 기존 `app/index.tsx`는 루트 진입 분기(리다이렉트 전용)로 전환된다.

### 7.2 수정 파일 (3개)

```
app/_layout.tsx               ← ThemeProvider 보존 + 그룹 라우트 추가
app/index.tsx                 ← 데모 콘텐츠 제거 → useSession 리다이렉트
app/_dev.tsx                  ← __DEV__ 게이트 추가
app.json (또는 app.config.js) ← scheme: "sagak" 등록
```

### 7.3 구현 코드 미작성 명시

본 계획서는 구현 코드를 포함하지 않는다. 코드는 `/moai run SPEC-NAV-001` 단계에서 TDD(RED-GREEN-REFACTOR) 또는 DDD(ANALYZE-PRESERVE-IMPROVE) 방법론에 따라 작성된다.
