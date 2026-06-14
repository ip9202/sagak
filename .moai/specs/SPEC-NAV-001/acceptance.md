---
id: SPEC-NAV-001
title: "Navigation & Routing Structure — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-NAV-001 인수 기준

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Given/When/Then 시나리오, 엣지 케이스, 품질 게이트 정의 | 강력쇠주먹 |

---

## 1. 인수 시나리오 (Given / When / Then)

> 시나리오 ID 접두사: G=Guard(인증 가드), T=Tabs(탭 네비게이션), S=Stack(스택 라우트), D=Deeplink(딥링크), A=Accessibility(접근성), R=Regression(회귀)

### 1.1 인증 가드 (REQ-NAV-GUARD)

#### 시나리오 G1: loading 상태에서 점멸 없음

**Given** 앱이 처음 시작됨
**And** `useSession()`이 `loading` 상태를 반환함
**When** 루트 `app/index.tsx`가 렌더링됨
**Then** 스플래시/`ActivityIndicator`만 표시됨
**And** `(tabs)` 그룹 어떤 화면도 렌더링되지 않음
**And** `(auth)` 그룹 어떤 화면도 렌더링되지 않음

#### 시나리오 G2: authenticated 상태에서 홈 탭 진입

**Given** `useSession()`이 `authenticated` 상태를 반환함
**And** 온보딩이 완료됨 (`isOnboardingComplete === true`)
**When** `app/index.tsx`의 리다이렉트 로직이 실행됨
**Then** `router.replace('/(tabs)/')`가 호출됨
**And** 홈 탭이 렌더링됨
**And** 뒤로 가기 스택에 진입 분기 화면이 남지 않음

#### 시나리오 G3: unauthenticated 상태에서 로그인 진입

**Given** `useSession()`이 `unauthenticated` 상태를 반환함
**When** `app/index.tsx`의 리다이렉트 로직이 실행됨
**Then** `router.replace('/(auth)/login')`가 호출됨
**And** 로그인 화면이 렌더링됨
**And** 뒤로 가기 스택에 진입 분기 화면이 남지 않음

#### 시나리오 G4: 미인증 사용자의 (tabs) 접근 차단

**Given** `useSession()`이 `unauthenticated` 상태를 반환함
**When** 사용자가 직접 `/library` 경로로 접근을 시도함 (딥링크 또는 수동)
**Then** `app/(tabs)/_layout.tsx`의 가드가 `router.replace('/(auth)/login')`를 호출함
**And** 서재 탭 대신 로그인 화면이 렌더링됨

#### 시나리오 G5: 인증 사용자의 (auth) 접근 차단

**Given** `useSession()`이 `authenticated` 상태를 반환함
**And** 온보딩이 완료됨
**When** 사용자가 직접 `/login` 경로로 접근을 시도함
**Then** `app/(auth)/_layout.tsx`의 가드가 `router.replace('/(tabs)/')`를 호출함
**And** 로그인 화면 대신 홈 탭이 렌더링됨

#### 시나리오 G6: 온보딩 미완료 사용자 가드

**Given** `useSession()`이 `authenticated` 상태를 반환함
**And** 온보딩이 미완료됨 (`isOnboardingComplete === false`)
**When** `app/index.tsx`의 리다이렉트 로직이 실행됨
**Then** `router.replace('/(auth)/onboarding')`가 호출됨
**And** 온보딩 화면이 렌더링됨
**And** 홈 탭은 렌더링되지 않음

#### 시나리오 G7: loading → authenticated 전환 시 점멸 없음

**Given** 앱 시작 시 `useSession()`이 `loading` 상태임
**When** 세션 복원이 완료되어 `useSession()`이 `authenticated`로 전환됨
**Then** `loading` 화면(스플래시/인디케이터)에서 홈 탭으로 직접 전환됨
**And** 중간에 로그인 화면이 잠시라도 렌더링되지 않음 (점멸 없음)

---

### 1.2 탭 네비게이션 (REQ-NAV-TABS)

#### 시나리오 T1: 4개 탭 렌더링

**Given** 인증 완료 사용자가 `(tabs)` 그룹에 진입함
**When** `app/(tabs)/_layout.tsx`가 렌더링됨
**Then** 하단 탭바에 4개의 탭이 표시됨 (홈/서재/모임/마이)
**And** 각 탭은 순서대로 홈 → 서재 → 모임 → 마이로 배치됨
**And** 각 탭은 해당 Feather 아이콘(`home`, `book-open`, `users`, `user`)을 표시함

#### 시나리오 T2: 탭바 디자인 토큰 스타일링

**Given** 탭바가 렌더링됨
**When** 탭바 스타일을 검사함
**Then** 탭바 배경색이 `bg-surface`(`#FFFFFF`)임
**And** 탭바 상단 보더가 `border-default`(`#E8DDD0`) `0.5dp`임
**And** 탭바 높이가 `56dp + safe area inset`임
**And** 탭 레이블 타이포그래피가 `label`(11sp / fontWeight 500)임

#### 시나리오 T3: 활성/비활성 탭 색상 분기

**Given** 탭바가 렌더링됨
**When** "서재" 탭이 활성 상태임
**Then** "서재" 탭의 아이콘과 레이블 색상이 `brand-500`(`#C17B2F`)임
**And** 나머지 3개 탭(홈/모임/마이)의 아이콘과 레이블 색상이 `text-tertiary`(`#A89585`)임

#### 시나리오 T4: 다크모드 탭바 전환

**Given** 디바이스가 다크모드로 설정됨
**When** `useTheme()`이 다크모드 토큰을 반환함
**Then** 탭바 배경색이 `darkTokens`의 `bg-surface` 값으로 전환됨
**And** 활성 탭 색상이 다크모드 `brand-500` 값으로 전환됨
**And** 비활성 탭 색상이 다크모드 `text-tertiary` 값으로 전환됨
**And** 탭바 상단 보더가 다크모드 `border-default` 값으로 전환됨

#### 시나리오 T5: 탭 전환 동작

**Given** 홈 탭이 활성 상태임
**When** 사용자가 "모임" 탭을 누름
**Then** 모임 탭 화면이 렌더링됨
**And** 모임 탭의 아이콘/레이블이 `brand-500`으로 전환됨
**And** 홈 탭의 아이콘/레이블이 `text-tertiary`로 전환됨

#### 시나리오 T6: 각 탭 placeholder 셸 렌더링

**Given** 인증 완료 사용자가 각 탭에 진입함
**When** 홈/서재/모임/마이 탭이 렌더링됨
**Then** 각 탭은 헤더 타이틀(탭 레이블과 동일)을 표시함
**And** 중앙 정렬된 플레이스홀더 텍스트("홈 화면", "서재 화면" 등)를 표시함

---

### 1.3 스택 네비게이션 (REQ-NAV-STACK)

#### 시나리오 S1: 도서 상세 동적 라우트 파라미터 수신

**Given** 사용자가 서재 탭에서 특정 책의 `BookCard`를 터치함 (또는 `router.push('/[bookId]')` 호출)
**When** `app/(tabs)/[bookId].tsx` 라우트가 렌더링됨
**Then** `useLocalSearchParams()`가 `bookId` 파라미터를 반환함
**And** 도서 상세 placeholder 셸이 렌더링됨

#### 시나리오 S2: 모임 상세 중첩 동적 라우트 파라미터 수신

**Given** 사용자가 모임 탭에서 특정 모임 카드를 터치함 (또는 `router.push('/clubs/[clubId]')` 호출)
**When** `app/(tabs)/clubs/[clubId].tsx` 라우트가 렌더링됨
**Then** `useLocalSearchParams()`가 `clubId` 파라미터를 반환함
**And** 모임 상세 placeholder 셸이 렌더링됨

#### 시나리오 S3: 스택 진입/복귀 동작

**Given** 사용자가 서재 탭에 있음
**When** 도서 상세 화면으로 진입함 (`router.push`)
**Then** 스택에 도서 상세 화면이 push됨
**When** 뒤로 가기 버튼을 누름
**Then** 도서 상세 화면이 pop되고 서재 탭으로 복귀함

#### 시나리오 S4: 탭 간 전환 시 스택 유지

**Given** 사용자가 서재 탭에서 도서 상세 화면으로 진입한 상태임
**When** 모임 탭으로 전환했다가 다시 서재 탭으로 돌아옴
**Then** 서재 탭의 스택 상태(도서 상세 화면)가 유지됨 (React Navigation 기본 동작)

---

### 1.4 딥링크 (REQ-NAV-DEEPLINK)

#### 시나리오 D1: OAuth 콜백 딥링크 수신

**Given** `app.json`에 `scheme: "sagak"`이 등록됨
**When** 외부 브라우저/앱에서 `sagak://auth/callback?...` 딥링크가 발생함
**Then** `app/(auth)/auth/callback.tsx` 라우트가 수신함
**And** `useLocalSearchParams()`로 URL 쿼리 파라미터가 전달됨

#### 시나리오 D2: 유효 토큰 수신 시 인증 완료 리다이렉트

**Given** OAuth 콜백 라우트가 유효한 세션 토큰과 함께 수신됨
**When** SPEC-AUTH-001 세션 처리 로직이 성공적으로 완료됨
**And** 온보딩이 이미 완료됨
**Then** `router.replace('/(tabs)/')`가 호출됨
**And** 홈 탭이 렌더링됨

#### 시나리오 D3: 에러 수신 시 로그인 화면 리다이렉트

**Given** OAuth 콜백 라우트가 유효하지 않은 토큰 또는 에러 파라미터와 함께 수신됨
**When** 세션 처리 로직이 실패함
**Then** `router.replace('/(auth)/login')`가 호출됨
**And** 로그인 화면에 에러 메시지가 표시됨

#### 시나리오 D4: 딥링크 스킴 iOS/Android 등록

**Given** `app.json`의 `scheme` 설정이 존재함
**When** iOS 빌드를 검사함
**Then** `CFBundleURLSchemes`에 `sagak`이 포함됨
**When** Android 빌드를 검사함
**Then** `intent-filter`에 `sagak` 스킴이 포함됨

---

### 1.5 접근성 (REQ-NAV-TABS + 공통)

#### 시나리오 A1: 스크린 리더 탭 레이블 읽기

**Given** VoiceOver(iOS) 또는 TalkBack(Android)이 활성화됨
**When** 사용자가 탭바의 각 탭을 포커스함
**Then** 스크린 리더가 "홈 탭", "서재 탭", "모임 탭", "마이 탭"을 읽어줌
**And** 각 탭의 `accessibilityRole`이 `tab`으로 설정됨

#### 시나리오 A2: 탭 터치 타겟 크기

**Given** 탭바가 렌더링됨
**When** 각 탭의 터치 영역을 측정함
**Then** 각 탭의 터치 타겟이 가로 세로 각각 44dp 이상임 (WCAG AA 준수)

#### 시나리오 A3: Android 백 핸들러 기본 동작

**Given** 사용자가 도서 상세 화면에 있음 (스택 depth 1)
**When** Android 물리 뒤로 가기 버튼을 누름
**Then** 도서 상세 화면이 pop되고 서재 탭으로 복귀함
**Given** 사용자가 홈 탭 루트에 있음 (스택 depth 0)
**When** Android 물리 뒤로 가기 버튼을 누름
**Then** 앱이 종료됨 (React Navigation 기본 동작)

---

### 1.6 회귀 (SPEC-UI-001 보존)

#### 시나리오 R1: SPEC-UI-001 기존 테스트 통과

**Given** SPEC-UI-001의 72개 테스트가 존재함
**When** `npm test`를 실행함
**Then** 72개 테스트가 모두 통과함
**And** 커버리지가 93.68% 이상 유지됨
**And** `app/_layout.tsx`의 ThemeProvider 래퍼가 보존됨

#### 시나리오 R2: _dev 데모 화면 보존

**Given** 개발 환경(`__DEV__ === true`)에서 앱을 실행함
**When** `/_dev` 경로로 접근함
**Then** SPEC-UI-001의 컴포넌트 데모 화면이 정상 렌더링됨
**And** 다크모드 토글 기능이 정상 동작함

#### 시나리오 R3: 프로덕션 빌드에서 _dev 제외

**Given** 프로덕션 빌드(`__DEV__ === false`)에서 앱을 실행함
**When** `/_dev` 경로로 접근을 시도함
**Then** `_dev` 라우트가 비활성화되어 있거나 접근이 차단됨

---

## 2. 엣지 케이스 (Edge Cases)

### EC1: 세션 만료 (authenticated → unauthenticated 전환)

**상황**: 사용자가 `(tabs)`를 사용 중 JWT 토큰이 만료됨
**기대 동작**: `useSession()`이 `unauthenticated`로 전환되면 `(tabs)/_layout.tsx` 가드가 즉시 `router.replace('/(auth)/login')`을 호출. 사용자가 작성 중이던 데이터는 손실될 수 있으며 (도메인 SPEC에서 임시 저장 처리 권장), 로그인 화면에 세션 만료 메시지 표시.

### EC2: 네트워크 오류 시 세션 복원 실패

**상황**: 앱 시작 시 네트워크 오류로 `useSession()`이 세션 복원에 실패함
**기대 동작**: `loading` 상태가 지나치게 오래 지속되지 않도록 타임아웃 처리. 타임아웃 후 `unauthenticated`로 처리하여 로그인 화면 진입 (네트워크 복구 후 재시도 가능). 무한 `loading` 스플래시 금지.

### EC3: 온보딩 중 앱 강제 종료 후 재시작

**상황**: 사용자가 온보딩 화면에서 닉네임 입력 중 앱을 강제 종료함. 세션은 생성되었으나 온보딩 미완료 상태.
**기대 동작**: 재시작 시 `useSession()`이 `authenticated` + `isOnboardingComplete === false`를 반환. REQ-NAV-023 가드가 온보딩 화면으로 리다이렉트. 홈 탭 진입 차단.

### EC4: 딥링크 수신 시 앱이 백그라운드에 있음

**상황**: 사용자가 다른 앱에서 `sagak://auth/callback` 딥링크를 트리거하나 사각 앱이 백그라운에 있음
**기대 동작**: 앱이 포그라운드로 전환되며 콜백 라우트가 정상 수신됨. Expo Router의 딥링크 처리가 백그라운드/포그라운드 전환을 모두 지원함.

### EC5: 잘못된 bookId/clubId 파라미터

**상황**: 사용자가 존재하지 않는 `bookId`로 `app/(tabs)/[bookId].tsx`에 접근함 (예: 삭제된 책)
**기대 동작**: 본 SPEC은 placeholder 셸만 제공하므로 본 SPEC 자체로는 에러 처리하지 않음. 도메인 SPEC(SPEC-LIBRARY-001)이 데이터 조회 실패 시 404/에러 화면 처리를 담당. 본 SPEC은 `bookId` 파라미터 수신까지만 보증.

### EC6: 빠른 연속 탭 전환

**상황**: 사용자가 매우 빠르게 홈 → 서재 → 모임 → 마이 탭을 연속으로 누름
**기대 동작**: React Navigation이 마지막 탭(마이)을 활성 탭으로 렌더링. 중간 탭들의 렌더링이 완료되지 않아도 UI가 깨지지 않음. 애니메이션 없이 즉시 전환 (Reanimated 미사용).

### EC7: 인증 가드 중첩 리다이렉트 루프

**상황**: `(tabs)` 가드가 `unauthenticated`를 감지하여 `(auth)/login`으로 리다이렉트하나, 동시에 `(auth)` 가드가 `authenticated`를 감지하여 `(tabs)`로 리다이렉트하는 모순 상태
**기대 동작**: `useSession()`은 단일 진실 원천이므로 양쪽 가드가 동일한 상태를 받음. 상태 전환 중 짧은 불일치 창이 발생할 수 있으나, 최종적으로 일관된 상태로 수렴. 무한 리다이렉트 루프 발생 시 `loading` 상태에서만 분기하도록 설계하여 방지.

### EC8: 딥링크 스킴 미등록 상태에서 OAuth 시도

**상황**: `app.json`에 `scheme`이 등록되지 않은 상태에서 Supabase OAuth 로그인을 시도함
**기대 동작**: 딥링크가 수신되지 않아 OAuth 콜백이 실패. 이는 설정 누락이므로 구현 시 반드시 `scheme` 등록을 확인 (acceptance D4). 테스트 환경에서 사전 차단.

### EC9: 동시 딥링크 + 수동 네비게이션

**상황**: 사용자가 서재 탭에서 도서 상세로 이동하는 중 `sagak://auth/callback` 딥링크가 수신됨
**기대 동작**: 딥링크 처리가 우선하여 콜백 라우트로 전환. 기존 스택(도서 상세)은 교체됨 (`router.replace` 패턴). 인증 완료 후 홈 탭으로 리다이렉트되며 기존 도서 상세 스택은 소멸.

### EC10: Safe Area 없는 디바이스에서 탭바 렌더링

**상황**: Safe Area inset이 0인 디바이스(예: 구형 Android)에서 탭바가 렌더링됨
**기대 동작**: 탭바 높이가 `56dp + 0dp = 56dp`로 렌더링됨. 하단 여백 없이 탭바가 화면 가장자리에 닿더라도 터치 타겟 44dp는 유지됨.

---

## 3. 품질 게이트 (Quality Gates)

### 3.1 TRUST 5 검증 항목

| 항목 | 기준 | 검증 방법 |
|------|------|-----------|
| **Tested** | 신규 라우트/가드 로직 커버리지 85%+ | Jest 커버리지 리포트 |
| **Tested** | SPEC-UI-001 기존 72개 테스트 100% 통과 | `npm test` (시나리오 R1) |
| **Readable** | 모든 스타일 값이 `useTheme()` 토큰에서 임포트됨 (하드코딩 금지) | 코드 리뷰 + ESLint 규칙 |
| **Readable** | 라우트 파일에 EARS 추적 태그(REQ-NAV-XXX)가 주석으로 표시됨 | 코드 리뷰 |
| **Unified** | Prettier 포맷팅 통과 | `npx prettier --check` |
| **Unified** | ESLint 9 flat config 통과 | `npx eslint` |
| **Secured** | 미인증 사용자가 `(tabs)` 라우트에 접근할 수 없음 | 시나리오 G4 자동화 테스트 |
| **Secured** | 인증 가드가 `router.replace`를 사용하여 뒤로 가기 스택 누락 없음 | 시나리오 G2, G3 검증 |
| **Trackable** | 컨벤셔널 커밋 메시지 (`feat(nav):`, `fix(nav):` 등) | git log 검증 |

### 3.2 Definition of Done (완료 정의)

본 SPEC의 구현이 완료되었다고 간주하려면 다음을 모두 충족해야 한다:

- [ ] 4개 REQ 모듈의 모든 요구사항(REQ-NAV-001 ~ REQ-NAV-031, 총 14개)이 구현됨
- [ ] acceptance.md의 모든 Given/When/Then 시나리오(G1~R3, 총 20개)가 통과함
- [ ] acceptance.md의 엣지 케이스(EC1~EC10)가 검증되었거나 명시적 후속 SPEC으로 위임됨
- [ ] SPEC-UI-001 기존 72개 테스트가 100% 통과함 (회귀 없음)
- [ ] 신규 코드 커버리지가 85% 이상임
- [ ] ESLint + Prettier + TypeScript strict 모드 컴파일 에러 0건
- [ ] 다크모드에서 탭바/네비게이션이 정상 동작함
- [ ] iOS 및 Android 양쪽에서 딥링크 수신이 정상 동작함
- [ ] `app/_layout.tsx`의 ThemeProvider가 보존됨 (수정 전후 diff로 확인)
- [ ] 모든 스타일 값이 `useTheme()` 토큰에서 임포트됨 (하드코딩 0건)
- [ ] 라우트 파일에 EARS 추적 태그(REQ-NAV-XXX)가 주석으로 표시됨

### 3.3 검증 도구

| 도구 | 용도 | 명령어 |
|------|------|--------|
| Jest | 단위/통합 테스트 | `npm test` |
| @testing-library/react-native | 컴포넌트 테스트 | `npm test` |
| ESLint 9 | 린트 검사 | `npx eslint app/ src/` |
| Prettier | 포맷팅 검사 | `npx prettier --check` |
| TypeScript | 타입 검사 | `npx tsc --noEmit` |
| Expo Start | 수동 검증 | `npx expo start` |

---

## 4. 추적성 (Traceability)

| 인수 시나리오 | 관련 REQ | 관련 제외/엣지 |
|---------------|---------|---------------|
| G1~G7 (인증 가드) | REQ-NAV-020 ~ REQ-NAV-023 | EC1, EC2, EC3, EC7 |
| T1~T6 (탭 네비게이션) | REQ-NAV-001, REQ-NAV-002, REQ-NAV-003 | EC6, EC10 |
| S1~S4 (스택 라우트) | REQ-NAV-010 ~ REQ-NAV-013 | EC5, EC9 |
| D1~D4 (딥링크) | REQ-NAV-030, REQ-NAV-031 | EC4, EC8 |
| A1~A3 (접근성) | REQ-NAV-001, REQ-NAV-002 (터치 타겟) | (해당 없음) |
| R1~R3 (회귀) | REQ-NAV-012 (ThemeProvider 보존) | (해당 없음) |

> 본 인수 기준서는 구현 코드를 포함하지 않는다. 코드는 `/moai run SPEC-NAV-001` 단계에서 TDD/DDD 방법론에 따라 작성된다. 본 문서는 검증 기준만 정의한다.
