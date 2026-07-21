---
id: SPEC-NAV-001
title: "Navigation & Routing Structure — Compact View"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-16
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-NAV-001 요약본 (Compact)

> 이 문서는 `spec.md` + `acceptance.md`에서 REQ, 인수기준, 제외 범위만 발췌한 자동 생성 요약본이다. 상세 내용은 `spec.md`, `plan.md`, `acceptance.md`를 참조한다.

---

## 1. 요구사항 (Requirements) — 13개 REQ

### REQ-NAV-TABS: 4개 탭 네비게이션 구조 (3개 REQ)

| REQ ID | 요구사항 요약 |
|--------|--------------|
| REQ-NAV-001 | `app/(tabs)/_layout.tsx`에 4개 탭(홈/서재/모임/마이) `Tabs` 네비게이터 정의. 탭바 높이 56dp + safe area. 활성 탭 brand-500, 비활성 탭 text-tertiary. Feather 아이콘(home/book-open/users/user). |
| REQ-NAV-002 | 4개 탭 라우트 파일 유지: `index.tsx`(홈), `library.tsx`(서재), `clubs.tsx`(모임), `my.tsx`(마이). 본 SPEC은 placeholder 셸만 제공. |
| REQ-NAV-003 | 탭바 스타일링 — bg-surface 배경, border-default 0.5dp 상단 보더, label 타이포그래피(11sp/500). 모든 값 `useTheme()` 토큰에서 임포트. |

### REQ-NAV-STACK: 스택 네비게이션 (4개 REQ)

| REQ ID | 요구사항 요약 |
|--------|--------------|
| REQ-NAV-010 | 동적 라우트 `app/(tabs)/[bookId].tsx` 유지 — 도서 상세 진입. `bookId` 파라미터 수신 골격만 제공. |
| REQ-NAV-011 | 중첩 동적 라우트 `app/(tabs)/clubs/[clubId].tsx` 유지 — 모임 상세 진입. `clubId` 파라미터 수신 골격만 제공. |
| REQ-NAV-012 | 루트 `app/_layout.tsx` `Stack` 확장 — ThemeProvider 보존 + `(tabs)`/`(auth)` 그룹 추가. `_dev` 라우트 `__DEV__` 게이트. |
| REQ-NAV-013 | 스택 전환 — 기본 슬라이드(React Navigation 기본값). 모달형 `presentation: 'modal'` 옵션 지원. |

### REQ-NAV-GUARD: 인증 가드 (4개 REQ)

| REQ ID | 요구사항 요약 |
|--------|--------------|
| REQ-NAV-020 | `useSession()` 기반 진입 분기 — `null` 반환(loading): 스플래시/인디케이터, `isAuthenticated===true`(+`isOnboarded===true`): `(tabs)` 홈 `router.replace`, `isAuthenticated===false`: `(auth)/login` `router.replace`. |
| REQ-NAV-021 | `(auth)` 그룹 보호 — 인증 사용자의 `(auth)` 접근 시 `(tabs)` 리다이렉트. |
| REQ-NAV-022 | `(tabs)` 그룹 보호 — 미인증 사용자의 `(tabs)` 접근 시 `(auth)/login` 리다이렉트. |
| REQ-NAV-023 | 온보딩 미완료 가드 — `isAuthenticated===true && isOnboarded===false` 시 `(auth)/onboarding` 리다이렉트. `isOnboarded`는 `profile.nickname` 기반 (SPEC-AUTH-001). |

### REQ-NAV-DEEPLINK: 딥링크 (2개 REQ)

| REQ ID | 요구사항 요약 |
|--------|--------------|
| REQ-NAV-030 | `app.json`에 딥링크 스킴 `sagak://` 등록 (iOS CFBundleURLSchemes + Android intent-filter). |
| REQ-NAV-031 | `app/(auth)/auth/callback.tsx` 라우트 유지 — `sagak://auth/callback` 수신. 유효 토큰 시 홈/온보딩 리다이렉트, 에러 시 로그인 리다이렉트. |

---

## 2. 인수기준 요약 (Acceptance Criteria Summary)

| 카테고리 | 시나리오 ID | 개수 | 핵심 검증 항목 |
|----------|-----------|------|---------------|
| 인증 가드 | G1~G7 | 7 | `null`(loading) 점멸 없음, `isAuthenticated`/`isOnboarded` 분기, 온보딩 가드, 양방향 그룹 보호 |
| 탭 네비게이션 | T1~T6 | 6 | 4개 탭 렌더링, 디자인 토큰 스타일링, 활성/비활성 색상, 다크모드, 탭 전환, placeholder 셸 |
| 스택 라우트 | S1~S4 | 4 | bookId/clubId 파라미터 수신, 스택 진입/복귀, 탭 간 스택 유지 |
| 딥링크 | D1~D4 | 4 | OAuth 콜백 수신, 유효/에러 토큰 분기, iOS/Android 스킴 등록 |
| 접근성 | A1~A3 | 3 | 스크린 리더 레이블, 터치 타겟 44dp, Android 백 핸들러 |
| 회귀 | R1~R3 | 3 | SPEC-UI-001 72개 테스트 통과, _dev 보존, 프로덕션 _dev 제외 |
| **계** | | **27** | |

### 엣지 케이스 10개 (EC1~EC10)

- EC1: 세션 만료 시 즉시 로그인 리다이렉트
- EC2: 네트워크 오류 시 세션 복원 실패 (타임아웃 → unauthenticated)
- EC3: 온보딩 중 강제 종료 후 재시작 (온보딩 재개)
- EC4: 백그라운드 상태 딥링크 수신
- EC5: 잘못된 bookId/clubId (도메인 SPEC 위임)
- EC6: 빠른 연속 탭 전환 (마지막 탭 수렴)
- EC7: 인증 가드 중첩 리다이렉트 루프 방지
- EC8: 스킴 미등록 상태 OAuth (사전 차단)
- EC9: 동시 딥링크 + 수동 네비게이션 (딥링크 우선)
- EC10: Safe Area 없는 디바이스 탭바 렌더링

---

## 3. 제외 범위 (Exclusions) — 10개

1. 각 탭의 실제 화면 콘텐츠 (도메인 SPEC 위임)
2. 하위 화면 콘텐츠 (도서 상세, 모임 상세 — 도메인 SPEC 위임)
3. 인증 로직 (OAuth, 세션 저장/복원, `useSession()` 구현 — SPEC-AUTH-001)
4. OAuth 앱 등록 및 콜백 URL 인프라 (SPEC-DEPLOY-001)
5. 모달 시스템 (별도 SPEC)
6. 커스텀 전환 애니메이션 (Reanimated — SPEC-UI-001 제외와 일치)
7. 푸시 알림 딥링크 (SPEC-NOTIF-001)
8. 접근성 심층 구현 (스크린 리더 세부 — SPEC-UI-001)
9. 웹 플랫폼 라우팅 (비목표)
10. `_dev.tsx` 데모 화면 콘텐츠 (SPEC-UI-001 자산 보존)

---

## 4. 미결정 사항 요약

| ID | 항목 | 상태 | 결정 |
|----|------|------|------|
| 5.1 | 탭 순서 | 해결됨 | 홈/서재/모임/마이 고정 (pages_07 + pages_11) |
| 5.2 | 홈 탭 기본 진입점 | 해결됨 | 홈 탭(`/`) (pages_07 SCR-A04) |
| 5.3 | 인증 가드 로딩 스플래시 | 부분 해결 | 정적 로고 + ActivityIndicator + expo-splash-screen 유지 (애니메이션은 향후) |
| 5.4 | 비회원 둘러보기 모드 | 미해결 → 제외 | MVP 제외 (니치 시장 집중) |
| 5.5 | Android 백 핸들러 | 미해결 | React Navigation 기본값 따름 |

---

## 5. 선행 의존성

| 의존 SPEC | 제공 자산 | 본 SPEC 소비 방식 |
|-----------|-----------|-----------------|
| SPEC-UI-001 | `app/_layout.tsx` (ThemeProvider), `src/theme/tokens.ts`, `useTheme()` | ThemeProvider 하위에 그룹 라우트 추가, 탭바 스타일링에 토큰 사용 |
| SPEC-AUTH-001 | `useSession()` 훅 — `null`(loading) 또는 `{ isAuthenticated, isOnboarded, session, user, profile, ... }` (loading 완료 시) | 인증 가드에서 `isAuthenticated`/`isOnboarded` 불리언 소비. `isOnboarded` = `profile.nickname` 존재 기반 (REQ-AUTH-030~033). |

---

> 본 요약본은 빠른 조회용이다. 구현 시 `spec.md`(상세 EARS), `plan.md`(라우트 맵, 마일스톤), `acceptance.md`(Given/When/Then 전문)을 반드시 참조한다.
