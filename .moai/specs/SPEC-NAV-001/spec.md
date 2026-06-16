---
id: SPEC-NAV-001
title: "Navigation & Routing Structure"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-16
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [frontend, expo-router, navigation, routing, auth-guard, deeplink, tabs]
---

# SPEC-NAV-001: 네비게이션 및 라우팅 구조

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Expo Router 그룹 라우트 `(tabs)`/`(auth)`, 4개 탭, 스택 네비게이션, 인증 가드, 딥링크 골격 정의 | 강력쇠주먹 |
| 2026-06-16 | 1.0.0 | 구현 완료 — 13/13 REQ, PR #7 머지(8fa545b), 317 테스트 통과, 커버리지 82.5% | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **라우팅 프레임워크**: Expo Router ~5 (파일 시스템 기반 라우팅)
- **런타임**: React Native 0.83.2 + React 19.2 + Expo SDK 55
- **네비게이션 컨테이너**: `expo-router` 내장 `Stack`, `Tabs` (React Navigation 기반)
- **그룹 라우트**: `(tabs)` (인증 후 진입), `(auth)` (미인증 진입) — 괄호 그룹은 URL 경로에서 제외
- **딥링크 스킴**: `sagak://` (앱 스킴) + Supabase OAuth 리다이렉트 URL (`sagak://auth/callback`)
- **테마 연동**: `app/_layout.tsx`의 `ThemeProvider` (SPEC-UI-001 산출물) 하위에 네비게이션 계층이 위치
- **아이콘 라이브러리**: `@expo/vector-icons` (Feather 아이콘 셋)

### 단일 출처 (Single Source of Truth)

본 SPEC의 네비게이션 구조는 다음 문서를 단일 출처로 한다:

- `.booktalk/pages_07_화면설계서.md` §1 (전체 화면 구조: [비회원] 온보딩/로그인 ↔ [회원] 탭 네비게이션)
- `.booktalk/pages_11_디자인시스템.md` §10 (탭 네비게이션: 4개 탭, 아이콘, 스타일 토큰)
- `.moai/project/tech.md` 프론트엔드 섹션 (Expo Router ~5)
- `.moai/project/structure.md` 클라이언트/프론트엔드 아키텍처 (`app/` 구조)

### 선행 의존성

| 의존 SPEC | 제공 자산 | 본 SPEC 활용 |
|-----------|-----------|-------------|
| SPEC-UI-001 | `app/_layout.tsx` (ThemeProvider), `src/theme/tokens.ts`, `useTheme()` | ThemeProvider 하위에 `(tabs)`/`(auth)` 그룹 라우트 추가; 탭바 스타일링에 디자인 토큰 사용 |
| SPEC-AUTH-001 | `useSession()` 훅 (세션 상태: `null` 반환=loading, 반환 객체의 `isAuthenticated`/`isOnboarded` 불리언) | 인증 가드에서 `useSession()` 소비하여 리다이렉트 분기 |

> 본 SPEC은 SPEC-UI-001과 SPEC-AUTH-001이 완료된 후 구현된다. 두 SPEC이 제공하는 인터페이스를 소비하기만 하며, 인증 로직 자체나 디자인 토큰 정의를 재구현하지 않는다.

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. Expo Router의 파일 시스템 라우팅을 따른다: `app/` 디렉토리 내 파일 구조가 곧 라우트 구조이다. 괄호 그룹(`(tabs)`, `(auth)`)은 URL 경로에서 제외되며, 레이아웃 격리 용도로 사용한다.
2. 현재 `app/_layout.tsx`의 `ThemeProvider` 래퍼 구조를 보존한다. 본 SPEC은 `_layout.tsx` 내 `Stack` 하위에 `(tabs)` 및 `(auth)` 그룹을 자식 라우트로 추가하는 방식으로 확장한다. `ThemeProvider`를 제거하거나 대체하지 않는다.
3. 현재 `app/index.tsx`는 임시 데모 화면이다. 본 SPEC 구현 후 `index.tsx`는 인증 상태에 따라 `(tabs)` 또는 `(auth)` 로 리다이렉트하는 진입점 라우트로 전환된다. 기존 `_dev.tsx` 데모 라우트는 개발 환경에서만 유지한다.
4. 인증 가드는 선언적 리다이렉트(`Redirect` 컴포넌트 또는 `useEffect` + `router.replace`) 방식으로 구현한다. 명령형 `navigate`는 뒤로 가기 스택에 진입 화면을 남기므로 인증 플로우에 부적합하다.
5. `(tabs)` 그룹과 `(auth)` 그룹은 동시에 마운트되지 않는다. 인증 상태 전환 시 한 그룹 전체가 언마운트되고 다른 그룹이 마운트된다 (스택 히스토리 격리).

### 2.2 비즈니스 가정

1. 인증 상태는 3가지로 분류된다 (SPEC-AUTH-001 `useSession()` 반환값 기준, `src/auth/useSession.ts` 확정 인터페이스):
   - `loading` — 세션 복원 중. `useSession()`이 `null`을 반환한다 (스플래시/로딩 인디케이터 표시)
   - `authenticated` — `useSession()`이 `isAuthenticated === true` (및 `isOnboarded === true`)인 객체를 반환한다 (`(tabs)` 그룹 진입)
   - `unauthenticated` — `useSession()`이 `isAuthenticated === false`인 객체를 반환한다 (`(auth)` 그룹 진입)
2. 최초 가입 후 온보딩(프로필 설정: 닉네임/아바타)이 완료되어야 홈 탭으로 진입한다 (pages_07 SCR-A04). 온보딩 미완료 사용자는 `authenticated` 상태라도 온보딩 화면에 머문다. 온보딩 완료 여부 판단은 SPEC-AUTH-001이 제공하는 세션 메타데이터에 의존한다.
3. 4개 탭의 순서는 pages_07 §1 및 pages_11 §10에 정의된 대로 **홈 → 서재 → 모임 → 마이** 순으로 고정한다. 사용자 설정 변경을 지원하지 않는다 (MVP).
4. 딥링크는 OAuth 콜백 처리가 최우선 목적이다. Supabase Auth OAuth 로그인 시 외부 브라우저/앱에서 `sagak://auth/callback` 형태로 콜백이 수신되며, 본 SPEC은 이를 수신하여 인증 완료 처리 라우트로 전달한다.
5. 각 탭의 실제 화면 콘텐츠(도서 목록, 감정 기록 입력 폼, 모임 상세 등)는 본 SPEC 범위 밖이다. 본 SPEC은 빈 화면 셸(placeholder)과 라우팅 연결만 제공하며, 콘텐츠는 각 도메인 SPEC(SPEC-LIBRARY-001, SPEC-EMOTION-001, SPEC-CLUB-001 등)이 구현한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-NAV-TABS, REQ-NAV-STACK, REQ-NAV-GUARD, REQ-NAV-DEEPLINK.

### REQ-NAV-TABS: 4개 탭 네비게이션 구조

**목적**: 인증 완료 사용자에게 하단 4개 탭(홈/서재/모임/마이) 네비게이션을 제공한다.

#### REQ-NAV-001: (tabs) 그룹 레이아웃 정의

시스템은 **항상** `app/(tabs)/_layout.tsx` 파일에 `Tabs` 네비게이터를 정의해야 하며, 4개의 탭 라우트(홈/서재/모임/마이)를 포함해야 한다. 각 탭은 pages_11 §10에 정의된 Feather 아이콘(`home`, `book-open`, `users`, `user`)과 한국어 레이블(홈/서재/모임/마이)을 가져야 한다.

**WHILE** 탭 네비게이터가 렌더링되는 동안,
**THEN** 시스템은 탭바 높이를 `56dp + safe area inset`으로 설정해야 한다 (pages_11 §10).

**WHILE** 특정 탭이 활성 상태이면,
**THEN** 시스템은 해당 탭의 아이콘과 레이블 색상을 `brand-500`(`#C17B2F`)으로 표시해야 한다.

**WHILE** 특정 탭이 비활성 상태이면,
**THEN** 시스템은 해당 탭의 아이콘과 레이블 색상을 `text-tertiary`(`#A89585`)로 표시해야 한다.

#### REQ-NAV-002: 4개 탭 라우트 파일 정의

시스템은 **항상** 다음 4개의 탭 라우트 파일을 유지해야 한다:

| 라우트 파일 | 라우트 경로 | 탭 레이블 | Feather 아이콘 | 담당 도메인 SPEC (참조용) |
|------------|------------|----------|---------------|------------------------|
| `app/(tabs)/index.tsx` | `/` (홈) | 홈 | `home` | (도메인 SPEC 미정의 — 홈 대시보드) |
| `app/(tabs)/library.tsx` | `/library` | 서재 | `book-open` | SPEC-LIBRARY-001 |
| `app/(tabs)/clubs.tsx` | `/clubs` | 모임 | `users` | SPEC-CLUB-001, SPEC-CLUB-002 |
| `app/(tabs)/my.tsx` | `/my` | 마이 | `user` | SPEC-PROFILE-001 |

각 탭 라우트 파일은 본 SPEC에서 빈 화면 셸(placeholder)로 구현한다. 헤더 타이틀(탭 레이블과 동일)과 중앙 정렬된 플레이스홀더 텍스트("홈 화면", "서재 화면" 등)만 표시하며, 실제 콘텐츠는 각 도메인 SPEC이 구현한다.

#### REQ-NAV-003: 탭바 스타일링 (디자인 토큰 기반)

**WHILE** 탭바가 렌더링되는 동안,
**THEN** 시스템은 탭바 배경색을 `bg-surface`(`#FFFFFF`)로 설정해야 한다.

**WHILE** 탭바가 렌더링되는 동안,
**THEN** 시스템은 탭바 상단 보더를 `border-default`(`#E8DDD0`) `0.5dp`로 설정해야 한다 (pages_11 §10).

**WHERE** 탭 레이블 타이포그래피가 적용 가능하면,
**THEN** 시스템은 `label` 토큰(`11sp / fontWeight 500`)을 사용해야 한다 (pages_11 §10, SPEC-UI-001 `typography.label`).

> 모든 색상·간격·타이포그래프 값은 `src/theme/tokens.ts`(SPEC-UI-001)에서 임포트해야 하며 하드코딩이 금지된다. 다크모드는 `useTheme()` 훅을 통해 자동 전환된다 (SPEC-UI-001 `darkTokens.ts` 대응값 준수).

---

### REQ-NAV-STACK: 스택 네비게이션 (하위 화면)

**목적**: 탭 내 하위 화면(도서 상세, 모임 상세, 감정 기록 입력 등)을 위한 스택 네비게이션을 제공한다.

#### REQ-NAV-010: 도서 상세 스택 라우트

시스템은 **항상** 동적 라우트 `app/(tabs)/[bookId].tsx`를 유지하여 도서 상세 화면 진입을 지원해야 한다. 이 라우트는 홈/서재 탭의 `BookCard` 터치 시 `router.push('/[bookId]')` 형태로 진입한다.

> 도서 상세 화면의 실제 콘텐츠(표지, 진도바, 감정 기록 타임라인, 완독 다이어리 진입점)는 SPEC-LIBRARY-001 및 SPEC-EMOTION-001이 구현한다. 본 SPEC은 라우트 파일과 `bookId` 파라미터 수신 골격만 제공한다.

#### REQ-NAV-011: 모임 상세 스택 라우트

시스템은 **항상** 중첩 동적 라우트 `app/(tabs)/clubs/[clubId].tsx`를 유지하여 모임 상세 화면 진입을 지원해야 한다. 이 라우트는 모임 탭의 모임 카드 터치 시 `router.push('/clubs/[clubId]')` 형태로 진입한다.

> 모임 상세 화면의 실제 콘텐츠(진도 동기화, 스포일러 방지 피드, 참가자 관리)는 SPEC-CLUB-001, SPEC-CLUB-002, SPEC-FEED-001이 구현한다.

#### REQ-NAV-012: 루트 Stack 레이아웃 확장

**WHILE** `app/_layout.tsx`의 루트 `Stack` 네비게이터가 렌더링되는 동안,
**THEN** 시스템은 기존 `ThemeProvider` 래퍼를 보존하면서, 하위 라우트로 `(tabs)` 그룹과 `(auth)` 그룹을 포함해야 한다.

**WHERE** `_dev` 데모 라우트가 존재하면,
**THEN** 시스템은 개발 환경(`__DEV__`)에서만 접근 가능하도록 유지해야 하며, 프로덕션 빌드에서는 제외 또는 비활성화해야 한다.

> 루트 `Stack`의 `screenOptions.headerShown`은 `false`로 유지한다 (현재 SPEC-UI-001 설정 보존). 각 탭/인증 화면의 헤더는 하위 레이아웃에서 개별 제어한다.

#### REQ-NAV-013: 스택 화면 전환 방향

**WHEN** 사용자가 탭 내에서 하위 화면(예: 도서 상세)으로 진입하면,
**THEN** 시스템은 기본 슬라이드 전환(React Navigation 기본값)을 적용해야 한다.

**WHERE** 모달형 화면(감정 기록 입력 등)이 필요하면,
**THEN** 시스템은 `presentation: 'modal'` 옵션으로 하단 슬라이드업 전환을 적용할 수 있다 (필요 시 별도 SPEC에서 정의).

> 본 SPEC은 기본 스택 전환만 정의한다. Reanimated 기반 커스텀 애니메이션은 SPEC-UI-001 제외 범위와 일치하게 본 SPEC에서도 제외한다.

---

### REQ-NAV-GUARD: 인증 가드 (미인증 리다이렉트)

**목적**: 인증 상태에 따라 `(tabs)` 또는 `(auth)` 그룹으로 선언적 리다이렉트를 수행한다.

#### REQ-NAV-020: 인증 상태 기반 진입 분기

**WHEN** 앱이 시작되고 `useSession()`이 `null`을 반환하면 (loading),
**THEN** 시스템은 스플래시/로딩 인디케이터를 표시해야 하며, 어떤 탭이나 인증 화면도 렌더링하지 않아야 한다 (점멸 방지).

**WHEN** `useSession()`이 `isAuthenticated === true` (및 `isOnboarded === true`)를 반환하면,
**THEN** 시스템은 사용자를 `(tabs)` 그룹의 홈 탭(`/`)으로 리다이렉트해야 한다 (`router.replace`).

**WHEN** `useSession()`이 `isAuthenticated === false`를 반환하면,
**THEN** 시스템은 사용자를 `(auth)` 그룹의 로그인 화면으로 리다이렉트해야 한다 (`router.replace`).

> 리다이렉트는 `router.replace`를 사용하여 뒤로 가기 스택에 진입 분기 화면을 남기지 않는다. `router.push`는 인증 플로우에 부적합하다 (사용자가 뒤로 가기 시 인증 화면으로 회귀하는 문제).

#### REQ-NAV-021: (auth) 그룹 보호

**WHILE** 인증된 사용자(`useSession()`이 `isAuthenticated === true && isOnboarded === true`를 반환)가 `(auth)` 그룹 라우트(예: `/login`)에 직접 접근하려 하면,
**THEN** 시스템은 해당 접근을 차단하고 `(tabs)` 홈 탭으로 리다이렉트해야 한다 (이미 로그인된 사용자가 로그인 화면을 다시 보지 않도록).

#### REQ-NAV-022: (tabs) 그룹 보호

**WHILE** 미인증 사용자가 `(tabs)` 그룹 라우트에 직접 접근하려 하면,
**THEN** 시스템은 해당 접근을 차단하고 `(auth)` 로그인 화면으로 리다이렉트해야 한다.

> REQ-NAV-021과 REQ-NAV-022는 양방향 가드이다. `useSession()` 상태를 각 그룹의 `_layout.tsx`에서 확인하여 잘못된 그룹 접근을 원천 차단한다. 딥링크나 수동 URL 입력으로 그룹 경계를 넘으려는 시도도 동일하게 차단된다.

#### REQ-NAV-023: 온보딩 미완료 사용자 가드

**IF** `useSession()`이 `isAuthenticated === true && isOnboarded === false`를 반환하면,
**THEN** 시스템은 홈 탭 대신 `(auth)` 그룹의 온보딩 화면으로 리다이렉트해야 한다 (pages_07 SCR-A04).

> 온보딩 완료 여부는 `useSession()`의 `isOnboarded` 불리언으로 캡슐화되어 있다 (`profile.nickname` 존재 여부 기반, SPEC-AUTH-001 REQ-AUTH-030~033). 본 SPEC은 `isOnboarded` 필드만 소비한다.

---

### REQ-NAV-DEEPLINK: 딥링크 (OAuth 콜백)

**목적**: Supabase OAuth 로그인 콜백 URL을 수신하여 인증 완료 처리 라우트로 전달한다.

#### REQ-NAV-030: 딥링크 스킴 등록

시스템은 **항상** `app.json` (또는 `app.config.js`)에 딥링크 스킴 `sagak://`을 등록해야 하며, iOS (`CFBundleURLSchemes`)와 Android (`intent-filter`) 양쪽에 설정해야 한다.

> Supabase Auth 대시보드의 리다이렉트 URL 설정(`sagak://auth/callback`)과 일치해야 한다. OAuth 앱 등록 및 콜백 URL 인프라 설정은 SPEC-DEPLOY-001 영역이나, 스킴 등록 자체는 본 SPEC 라우팅 골격의 필수 구성요소이다.

#### REQ-NAV-031: OAuth 콜백 라우트

시스템은 **항상** `app/(auth)/auth/callback.tsx` 라우트를 유지하여 `sagak://auth/callback` 딥링크를 수신해야 한다. 이 라우트는 Supabase Auth가 전달하는 세션 토큰 파라미터를 수신하여 SPEC-AUTH-001의 세션 처리 로직으로 전달한다.

**WHEN** OAuth 콜백 라우트가 유효한 세션 토큰과 함께 수신되면,
**THEN** 시스템은 인증 완료 처리 후 `(tabs)` 홈 탭 또는 온보딩 화면으로 리다이렉트해야 한다 (REQ-NAV-023 온보딩 가드와 연동).

**IF** OAuth 콜백 라우트가 유효하지 않은 토큰이나 에러와 함께 수신되면,
**THEN** 시스템은 `(auth)` 로그인 화면으로 리다이렉트하고 에러 메시지를 표시해야 한다.

> 콜백 라우트의 실제 세션 처리 로직(토큰 교환, 세션 저장)은 SPEC-AUTH-001이 구현한다. 본 SPEC은 라우트 파일 골격과 딥링크 수신 → 리다이렉트 연결만 제공한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **각 탭의 실제 화면 콘텐츠**: 홈 대시보드, 서재 목록, 모임 목록, 마이페이지 콘텐츠는 각 도메인 SPEC(SPEC-LIBRARY-001, SPEC-CLUB-001, SPEC-PROFILE-001 등)이 구현한다. 본 SPEC은 빈 화면 셸(placeholder)과 라우팅 연결만 제공한다.
2. **하위 화면 콘텐츠**: 도서 상세 화면의 진도바/감정 타임라인, 모임 상세 화면의 피드/참가자 관리 등은 각 도메인 SPEC이 구현한다. 본 SPEC은 동적 라우트 파일(`[bookId].tsx`, `clubs/[clubId].tsx`) 골격만 제공한다.
3. **인증 로직**: OAuth 로그인 처리, 세션 저장/복원, `useSession()` 훅 구현, 세션 메타데이터(온보딩 완료 여부) 제공은 SPEC-AUTH-001 영역이다. 본 SPEC은 `useSession()` 인터페이스를 소비하기만 한다.
4. **OAuth 앱 등록 및 콜백 URL 인프라**: 카카오/애플/구글 OAuth 앱 등록, Supabase 대시보드 리다이렉트 URL 설정은 SPEC-DEPLOY-001 영역이다. 본 SPEC은 앱 측 딥링크 스킴 등록까지만 담당한다.
5. **모달 시스템**: 공통 모달/바텀시트 컴포넌트 시스템은 필요 시 별도 SPEC에서 정의한다. 본 SPEC은 `presentation: 'modal'` 옵션 지원만 명시한다.
6. **커스텀 전환 애니메이션**: Reanimated 기반 커스텀 화면 전환 애니메이션은 SPEC-UI-001 제외 범위와 일치하게 본 SPEC에서도 제외한다. React Navigation 기본 슬라이드/모달 전환만 사용한다.
7. **푸시 알림 딥링크**: 푸시 알림 탭 시 특정 화면으로 이동하는 딥링크 라우팅은 SPEC-NOTIF-001 영역이다. 본 SPEC은 OAuth 콜백 딥링크만 담당한다.
8. **접근성(Accessibility) 심층 구현**: 탭바/네비게이션의 기본 `accessibilityLabel` 및 터치 타겟(44dp) 준수는 포함하되, 스크린 리더 세부 동작(TalkBack/VoiceOver 세부 설정)은 SPEC-UI-001 접근성 요구사항에 따른다.
9. **웹 플랫폼 라우팅**: 데스크톱 웹 버전은 비목표(product.md)이므로, Expo Router 웹 플랫폼 특화 라우팅은 다루지 않는다.
10. **현재 `_dev.tsx` 데모 화면 콘텐츠**: SPEC-UI-001 산출물인 컴포넌트 데모 화면의 내용은 수정하지 않으며, 개발 환경에서만 유지한다.

---

## 5. 미결정 사항 (Open Questions — 해결 상태)

### 5.1 탭 순서 — 해결됨

pages_07 §1 및 pages_11 §10에 **홈 → 서재 → 모임 → 마이** 순으로 명시되어 있다. 본 SPEC은 이를 고정값으로 채택한다. 사용자 설정 변경은 MVP 범위 밖이다.

**결정**: 홈/서재/모임/마이 순 고정 (pages_07 + pages_11 기준).

### 5.2 홈 탭 기본 진입점 — 해결됨

인증 완료 후 첫 진입 탭은 홈 탭(`/`)으로 통일한다 (pages_07 §1, SCR-A04 "[완료] → 홈 탭 이동"). 서재나 모임 탭을 기본 진입점으로 하는 대안은 검토하지 않는다.

**결정**: 홈 탭(`/`) 기본 진입 (pages_07 기준).

### 5.3 인증 가드 로딩 스플래시 처리 — 부분 해결

`useSession()`이 `null`을 반환하는 loading 상태일 때 표시할 스플래시 화면의 구체적 디자인(로고 애니메이션, 슬로건 등)은 pages_07 SCR-A01에 정의되어 있으나, 애니메이션 구현은 SPEC-UI-001 제외 범위(Reanimated 미도입)와 충돌한다.

**결정**: MVP에서는 정적 로고 이미지 + `ActivityIndicator`를 사용한다. 슬로건 애니메이션은 향후 SPEC-UI-001 확장 시 추가한다. `expo-splash-screen` 네이티브 스플래시를 사용하여 세션 복원 완료 전까지 네이티브 스플래시를 유지하는 방식을 우선한다 (점멸 최소화).

### 5.4 비회원 둘러보기 모드 — 미해결

pages_07 SCR-A03에 "비회원으로 둘러보기 (읽기 전용)" 옵션이 명시되어 있다. 이 모드를 지원할 경우 `(tabs)` 그룹에 읽기 전용 권한으로 진입해야 하므로 인증 가드 로직이 복잡해진다.

**결정**: MVP에서는 비회원 둘러보기를 **제외**한다 (비목표 "대중 스케일"과 일치 — 니치 시장 집중). 모든 사용자는 인증 완료 후에만 앱 기능에 접근한다. 추후 확장 시 별도 SPEC에서 정의.

### 5.5 백 핸들러(Android 뒤로 가기) — 미해결

Android 물리 뒤로 가기 버튼이 스택 네비게이션과 탭 간에 어떻게 동작할지 (예: 탭 전환 시 뒤로 가기가 이전 탭으로 돌아갈 것인지, 앱 종료할 것인지)는 구현 단계에서 결정한다.

**결정**: React Navigation 기본 백 핸들러 동작을 따른다 (스택 팝 → 루트에서 앱 종료). 커스텀 백 핸들러는 MVP 범위 밖이다.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-NAV-001 / REQ-NAV-TABS | REQ-NAV-001, REQ-NAV-002, REQ-NAV-003 | `.booktalk/pages_11_디자인시스템.md` §10, `.booktalk/pages_07_화면설계서.md` §1, `.moai/project/structure.md` 클라이언트 아키텍처 |
| SPEC-NAV-001 / REQ-NAV-STACK | REQ-NAV-010, REQ-NAV-011, REQ-NAV-012, REQ-NAV-013 | `.booktalk/pages_07_화면설계서.md` §3 (네비게이션 흐름 요약), `.moai/specs/SPEC-UI-001/spec.md` (기존 `_layout.tsx` 보존) |
| SPEC-NAV-001 / REQ-NAV-GUARD | REQ-NAV-020, REQ-NAV-021, REQ-NAV-022, REQ-NAV-023 | `.booktalk/pages_07_화면설계서.md` AUTH 섹션(SCR-A01~A04), `.moai/specs/INDEX.md` SPEC-AUTH-001 의존성 |
| SPEC-NAV-001 / REQ-NAV-DEEPLINK | REQ-NAV-030, REQ-NAV-031 | `.moai/project/tech.md` 인증 섹션(Supabase Auth OAuth), `.moai/project/structure.md` API 서피스(Authentication) |
| (공통) | 본 SPEC 전체 | `.moai/project/product.md` 핵심 기능(4개 탭 근거), `.moai/project/tech.md` 프론트엔드(Expo Router ~5), `.moai/specs/SPEC-UI-001/spec.md` (ThemeProvider/tokens 선행 의존성) |

---

## 구현 노트 (Implementation Notes)

### 구현 개요

본 SPEC은 2026-06-16 PR #7(커밋 8fa545b) 머지로 구현 완료되었다. 총 13개 REQ 모두 구현되었으며 317개 테스트가 통과(82.5% 커버리지)하였고 TypeScript 컴파일 에러 0건, 린팅 에러 0건을 달성했다.

### 구현된 REQ (13/13)

| REQ 모듈 | 구현 REQ 수 | 주요 구현 내용 |
|---------|-----------|--------------|
| REQ-NAV-TABS | 3/3 | `app/(tabs)/_layout.tsx`에 4개 탭 네비게이터(홈/서재/모임/마이), Feather 아이콘, 디자인 토큰 스타일링, 4개 placeholder 셸 |
| REQ-NAV-STACK | 4/4 | 루트 `_layout.tsx` Stack 확장(ThemeProvider+AuthProvider 보존), `[bookId]`, `clubs/[clubId]` 동적 라우트, 기본 슬라이드 전환 |
| REQ-NAV-GUARD | 4/4 | `app/index.tsx` 진입 분기, `(tabs)`/`(auth)` 양방향 그룹 가드, 온보딩 미완료 가드, `useSession()` 소비 |
| REQ-NAV-DEEPLINK | 2/2 | `app.json` 스킴 "sagak" 검증(이미 등록됨), `app/(auth)/auth/callback.tsx` OAuth 콜백 최소 골격 |

### 계획과의 차이 (Divergence)

1. **T-008 모달 프레젠테이션 제외**: `Tabs.Screen` 타입은 `presentation: 'modal'`을 지원하지 않는다. REQ-NAV-013 핵심 요구사항인 기본 슬라이드는 유지되었으나, 모달 지원은 별도 Stack 그룹(추후 구현)으로 연기했다.
2. **`app/_dev.tsx` 미수정**: `__DEV__` 게이트는 `app/_layout.tsx`(`{__DEV__ && <Stack.Screen name="_dev" />}`)에서 적용되었다. 파일 자체를 수정하는 것보다 레이아웃 레벨 조건부 렌더링이 더 안전하다.
3. **리뷰 수정 사항(post-merge-prep)**: `callback.tsx` — `useLocalSearchParams()` 반환값을 `void` 연산자로 명시적 폐기(expert-security 리뷰 권장 사항 #1, 논블로킹).
4. **app.json 스킴**: 구현 전 이미 등록되어 있었다. REQ-NAV-030은 검증 전용이었으며 새로운 작업이 아니었다.
5. **(auth) 그룹 파일 선존재**: `app/(auth)/_layout.tsx`, `login.tsx`, `onboarding.tsx`는 AUTH-001 산출물이었다. NAV-001은 `_layout.tsx`에 가드만 추가했으며 login/onboarding은 건드리지 않았다.

### 인터페이스 정정 (중요)

SPEC-NAV-001 문서는 구현 전에 AUTH-001의 실제 `useSession()` 인터페이스와 일치하도록 정정되었다. 원본 문서는 `status: 'loading'|'authenticated'|'unauthenticated'` + `isOnboardingComplete`를 가정했으나, 실제 인터페이스는 `useSession() === null`일 때 로딩, 그렇지 않으면 `{isAuthenticated, isOnboarded, ...}` 객체를 반환한다. 4개 SPEC 문서(spec.md, spec-compact.md, plan.md, acceptance.md)가 모두 정정되었다(갭 G1-G7 → 0). 이 정정을 구현 노트에 기록한다.

### 품질 스냅샷

- **테스트**: 317개 통과
- **커버리지**: nav 모듈 82.5%
- **TypeScript**: 0 에러
- **린팅**: 0 에러
- **evaluator 점수**: 0.98
- **보안 리뷰**: PASS

### 머지 정보

- **PR**: #7
- **커밋**: 8fa545b
- **머지 일자**: 2026-06-16
- **브랜치**: develop (GitFlow 전략 — sync 커밋은 develop 직접 커밋, 이전 AUTH-001 docs(sync) 205a338과 동일 패턴)

---
