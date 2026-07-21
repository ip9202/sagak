---
id: SPEC-AUTH-001
title: "OAuth Authentication & Session Management — Implementation Plan"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [auth, oauth, supabase-auth, session, implementation-plan]
---

# SPEC-AUTH-001 Implementation Plan

> 본 문서는 SPEC-AUTH-001 요구사항의 구현 계획을 정의한다. 시간 추정치는 포함하지
> 않으며, 우선순위 기반 마일스톤으로 진행 순서를 표현한다 (TRUST 5 예측 가능성 원칙).

---

## 1. 구현 산출물 (Implementation Artifacts)

| 파일 경로 | 목적 | 연결 REQ |
|-----------|------|----------|
| `src/auth/types.ts` | `AuthProvider` 유니온 타입, `UserProfile` 인터페이스, `AuthContextValue` 인터페이스 | REQ-AUTH-001, REQ-AUTH-030 |
| `src/auth/AuthContext.tsx` | `AuthProvider` 컴포넌트, `AuthContext` 객체, 세션 상태 관리 로직 | REQ-AUTH-010, REQ-AUTH-011, REQ-AUTH-012, REQ-AUTH-013, REQ-AUTH-014 |
| `src/auth/useSession.ts` | `useSession()` 커스텀 훅, 파생값(`isAuthenticated`, `isOnboarded`) 계산 | REQ-AUTH-030, REQ-AUTH-031, REQ-AUTH-032, REQ-AUTH-033 |
| `app/(auth)/_layout.tsx` | 인증 그룹 레이아웃 (로그인/온보딩 화면 공통 래퍼) | REQ-AUTH-002, REQ-AUTH-020 |
| `app/(auth)/login.tsx` | 로그인 화면 — OAuth 제공자 버튼 3종, 에러 메시지 표시 | REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-004 |
| `app/(auth)/onboarding.tsx` | 온보딩 화면 — nickname 입력, avatar 선택, 프로필 UPDATE | REQ-AUTH-020, REQ-AUTH-021, REQ-AUTH-022, REQ-AUTH-023, REQ-AUTH-024 |
| `src/auth/__tests__/AuthContext.test.tsx` | AuthContext 단위/통합 테스트 | REQ-AUTH-010 ~ REQ-AUTH-014 |
| `src/auth/__tests__/useSession.test.ts` | useSession 훅 테스트 | REQ-AUTH-030 ~ REQ-AUTH-033 |
| `app/(auth)/__tests__/login.test.tsx` | 로그인 화면 테스트 | REQ-AUTH-002, REQ-AUTH-003 |
| `app/(auth)/__tests__/onboarding.test.tsx` | 온보딩 화면 테스트 | REQ-AUTH-021, REQ-AUTH-023, REQ-AUTH-024 |

> **의존성 산출물**: `src/lib/supabase.ts` (SPEC-API-001)가 이미 존재해야 하며, 본 SPEC은
> 해당 클라이언트의 `auth` 모듈을 임포트하여 사용한다.

---

## 2. 우선순위 기반 마일스톤 (Priority-Based Milestones)

### Primary Goal — 인증 파운데이션 (Core Auth Foundation)

목표: OAuth 로그인과 세션 관리의 최소 동작 사이클을 완성한다.

작업 범위:
- `src/auth/types.ts` — 타입 정의 (REQ-AUTH-001)
- `src/auth/AuthContext.tsx` — Provider + 상태 관리 + onAuthStateChange 리스너 (REQ-AUTH-010 ~ REQ-AUTH-014)
- `app/(auth)/_layout.tsx` — 인증 그룹 레이아웃
- `app/(auth)/login.tsx` — OAuth 로그인 화면 (REQ-AUTH-002, REQ-AUTH-003, REQ-AUTH-004)
- AuthContext 테스트 (REQ-AUTH-010 ~ REQ-AUTH-014 인수 기준)

완료 기준:
- 세 OAuth 제공자 버튼이 렌더링된다
- `signInWithOAuth` 호출이 Mock 환경에서 검증된다
- `onAuthStateChange` 4개 이벤트가 상태를 올바르 갱신한다
- `getSession()` 세션 복원이 `loading` 상태 전환과 함께 동작한다
- 로그아웃이 세션과 프로필을 초기화한다

### Secondary Goal — 온보딩 프로필 설정 (Onboarding Profile Setup)

목표: 신규 사용자가 nickname과 avatar를 설정하여 프로필을 완성한다.

> 의존성: Primary Goal 완료 후 시작. AuthContext가 인증 상태를 제공해야 온보딩 진입
> 조건 판별 가능.

작업 범위:
- `app/(auth)/onboarding.tsx` — 온보딩 화면 (REQ-AUTH-020 ~ REQ-AUTH-024)
- nickname 검증 로직 (REQ-AUTH-021)
- `users` UPDATE 호출 + `refreshProfile()` 갱신 (REQ-AUTH-023)
- 온보딩 화면 테스트

완료 기준:
- nickname 빈 문자열 제출 시 완료 버튼 비활성화 (REQ-AUTH-021)
- 유효 nickname + 선택 avatar로 UPDATE 성공 시 `profile` 갱신 (REQ-AUTH-023)
- UPDATE 실패 시 에러 메시지 표시 + 재시도 가능 (REQ-AUTH-024)
- RLS 정책 통과 (`auth.uid() = id`) 확인

### Final Goal — 인증 가드 훅 (Session Guard Hook)

목표: SPEC-NAV-001이 소비할 `useSession()` 훅을 제공한다.

> 의존성: Primary Goal(AuthContext) 완료 후 시작. 훅은 Context를 소비한다.

작업 범위:
- `src/auth/useSession.ts` — 훅 구현 (REQ-AUTH-030, REQ-AUTH-031)
- `loading` 가드 로직 (REQ-AUTH-032)
- Provider 외부 호출 방어 (REQ-AUTH-033)
- useSession 훅 테스트

완료 기준:
- `isAuthenticated`, `isOnboarded` 파생값이 상태 변경 시 재계산된다 (REQ-AUTH-031)
- `loading === true` 시 네비게이션 보류 의미가 문서화된다 (REQ-AUTH-032)
- Provider 범위 밖 호출 시 명확한 에러 발생 (REQ-AUTH-033)

### Optional Goal — 엣지 케이스 보강 (Edge Case Hardening)

목표: 미결정 사항 해결 후 분기 로직을 추가한다.

작업 범위:
- 온보딩 건너뛰기 (미결정 5.1 해결 시) — REQ-AUTH-020 진입 조건 수정
- 세션 만료 모달 (미결정 5.2 해결 시) — AuthContext 만료 처리 보강
- 애플 플랫폼 조건부 노출 (미결정 5.3 해결 시) — login.tsx 제공자 버튼 분기

완료 기준:
- 각 미결정 사항 해결 후 해당 REQ가 업데이트되고 테스트에 반영된다

---

## 3. 기술 접근 (Technical Approach)

### 3.1 인증 아키텍처 패턴

```
app/_layout.tsx (최상위)
  └─ <AuthProvider>  ← AuthContext.Provider 배치
       └─ <RootNavigator> (SPEC-NAV-001)
            ├─ useSession() 소비 → 인증 가드
            ├─ app/(auth)/login.tsx
            ├─ app/(auth)/onboarding.tsx
            └─ app/(tabs)/* (인증 후 진입)
```

`AuthProvider`는 자식 컴포넌트 트리 전체를 감싸며, 최초 마운트 시:
1. `supabase.auth.getSession()` 호출로 저장된 세션 복원 시도
2. `supabase.auth.onAuthStateChange()` 리스너 등록
3. 세션 존재 시 `public.users` 프로필 행 조회

### 3.2 Supabase Auth 통합

본 SPEC은 Supabase JS SDK v2의 `auth` 모듈을 직접 소비한다:

- `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })` — OAuth 플로우 시작
- `supabase.auth.signOut()` — 로컬 세션 폐기
- `supabase.auth.getSession()` — 저장된 세션 조회 (자동 로그인)
- `supabase.auth.onAuthStateChange((event, session) => ...)` — 세션 이벤트 구독
- `supabase.from('users').select().eq('id', userId).single()` — 프로필 조회
- `supabase.from('users').update({ nickname, avatar_url }).eq('id', userId)` — 온보딩 UPDATE

세션 갱신(TOKEN_REFRESHED)은 SDK가 백그라운드에서 자동 처리하며, 본 SPEC은 이벤트만
구독한다.

### 3.3 딥링크 콜백 처리

OAuth `redirectTo`는 `expo-linking`의 `makeRedirectUri()`를 사용하여 생성한다:

```typescript
import * as Linking from 'expo-linking';
const redirectTo = Linking.createURL('/auth/callback');
```

이 URL은 Supabase Dashboard의 Auth 설정에 Redirect URL로 등록되어야 하며, 해당 등록은
SPEC-DEPLOY-001 영역이다. 본 SPEC은 `createURL` 호출 지점까지만 다룬다.

### 3.4 상태 관리 전략

`AuthContext`는 다음 상태 머신을 따른다:

```
[loading=true]
    │
    ├─ getSession() → 세션 있음 → [authenticated, profile 조회]
    │                                    │
    │                                    ├─ profile 있음 → [isOnboarded=true]
    │                                    └─ profile 없음 → [isOnboarded=false]
    │
    └─ getSession() → 세션 없음 → [unauthenticated]
    │
[이벤트 구독 중...]
    ├─ SIGNED_IN → [authenticated, profile 조회]
    ├─ TOKEN_REFRESHED → session/user 업데이트
    ├─ SIGNED_OUT → [unauthenticated, profile=null]
```

`useSession()`은 이 상태를 소비하여 `isAuthenticated`, `isOnboarded` 파생값을 계산한다.

---

## 4. 아키텍처 설계 방향 (Architecture Design Direction)

### 4.1 단일 책임 원칙 (Single Responsibility)

- `AuthContext.tsx`: 상태 관리와 Supabase 통신만 담당. UI 렌더링 없음.
- `useSession.ts`: Context 소비와 파생값 계산만 담당. 부작용 없음.
- `login.tsx` / `onboarding.tsx`: UI 렌더링과 사용자 입력 처리만 담당. 상태는 Context에서 구독.

### 4.2 타입 안전성 (Type Safety)

- `AuthProvider`를 string이 아닌 유니온 타입 `'kakao' | 'apple' | 'google'`으로 정의
- `users.provider` CHECK 제약과 컴파일 타임에 일치 보장
- `Profile` 타입을 `users` 테이블 스키마와 동기화 (향후 SPEC-API-001 gen-types 활용)

### 4.3 테스트 용이성 (Testability)

- AuthContext 로직을 순수 함수로 분리하여 Mock 없이 단위 테스트 가능
- Supabase 클라이언트를 의존성 주입 가능하도록 설계 (테스트 시 Mock 클라이언트 주입)
- `onAuthStateChange` 이벤트를 테스트에서 시뮬레이션 가능한 인터페이스 제공

---

## 5. 리스크 및 대응 (Risks & Mitigations)

### 5.1 OAuth 딥링크 콜백 실패

**리스크**: OAuth 플로우 후 앱으로 돌아오는 딥링크가 iOS/Android에서 다르게 동작하여
세션이 설정되지 않을 수 있다.

**대응**: 
- `makeRedirectUri`의 `scheme`, `path`, `queryParams`를 명시적으로 설정
- SPEC-DEPLOY-001에서 앱 스킴 등록과 Universal Link / App Link 설정 담당
- 본 SPEC 테스트에서는 딥링크 자체가 아닌 `onAuthStateChange` 이벤트 수신 로직을 검증

### 5.2 프로필 행 누락 (트리거 실패 시나리오)

**리스크**: `handle_new_user` 트리거가 실패하여 `public.users`에 프로필 행이 없을 경우,
REQ-AUTH-013의 profile 조회가 `null`을 반환하여 온보딩 진입 조건이 애매해진다.

**대응**:
- REQ-AUTH-013은 profile 누락 시 에러 로깅 + `profile = null` 유지
- `isOnboarded`는 `profile !== null && profile.nickname` 조건이므로, profile 누락 시 자동으로 온보딩 진입
- 온보딩 UPDATE는 RLS에 의해 `auth.uid() = id` 조건이 필요하나, profile 행이 없으면 UPDATE가 0행에 영향 → REQ-AUTH-024 에러 처리 진입
- 이 시나리오는 예외 케이스로, 프로덕션에서 발생 빈도가 낮음 (트리거는 SECURITY DEFINER로 신뢰)

### 5.3 세션 만료 중 데이터 손실

**리스크**: 감정 기록 입력 중 세션이 만료되면 (미결정 사항 5.2), 자동 리다이렉트 정책
시 입력 내용이 손실된다.

**대응**:
- MVP v1.0.0은 (A) 자동 리다이렉트 정책을 가정
- 미결정 사항 5.2 해결 시 (B) 모달 정책으로 전환하여 데이터 손실 완화
- SPEC-EMOTION-001에서 로컬 드래프트 저장 기능으로 보강 가능 (향후 확장)

### 5.4 애플 Sign in with Apple iOS 정책 위반

**리스크**: iOS App Store 심사에서 Apple 로그인 옵션 누락 시 리젝될 수 있다.

**대응**:
- 미결정 사항 5.3 해결 전까지는 양쪽 플랫폼에 Apple 버튼 표시 (안전한 기본값)
- 앱 스토어 제출 전(Phase 5, SPEC-DEPLOY-001)에 정책 확정 필요

---

## 6. 품질 게이트 (Quality Gates)

본 SPEC 구현은 TRUST 5 기준을 따른다:

| 기둥 | 기준 | 검증 방법 |
|------|------|-----------|
| Tested | 85%+ 커버리지, 모든 REQ에 대응하는 테스트 | Jest + @testing-library/react-native |
| Readable | 한국어 주석(SPEC-UI-001 패턴), 명확한 함수명 | ESLint + 코드 리뷰 |
| Unified | tokens.ts 기반 스타일링, 일관된 에러 처리 패턴 | Prettier + 디자인 토큰 임포트 |
| Secured | JWT 노출 방지, RLS 의존(클라이언트 권한 상승 금지) | Supabase RLS 정책 통과 확인 |
| Trackable | Conventional commits, SPEC-AUTH-001 참조 | `feat(auth): ...` 커밋 메시지 |

---

## 7. 전문가 협의 권장 (Expert Consultation Recommendations)

본 SPEC은 다음 도메인 전문가 협의를 권장한다:

### Backend Expert (expert-backend)

**협의 영역**: 
- Supabase Auth `signInWithOAuth` / `onAuthStateChange` 통합 패턴 검증
- `public.users` UPDATE가 RLS 정책(REQ-DB-014)을 올바르게 통과하는지 확인
- 세션 토큰 갱신 실패 시나리오의 서버 측 동작 검토

**이유**: 인증 플로우는 백엔드 인증 시스템과 직접 연동되므로, Supabase Auth 전문가의
아키텍처 검토가 보안성과 신뢰성에 기여한다.

### Frontend Expert (expert-frontend)

**협의 영역**:
- React Context 성능 최적화 (불필요한 리렌더링 방지)
- `onAuthStateChange` 리스너 생명주기 관리 (cleanup, 메모리 누수 방지)
- 로그인/온보딩 화면의 접근성(WCAG AA) 준수

**이유**: 전역 인증 상태는 모든 화면에 영향을 미치므로, 프론트엔드 아키텍처 전문가의
성능 및 접근성 검토가 사용자 경험에 직결된다.

### DevOps Expert (expert-devops)

**협의 영역**:
- OAuth 앱 등록 및 콜백 URL 인프라 설정 (SPEC-DEPLOY-001 연계)
- 딥링크 스킴 등록 (iOS Universal Links, Android App Links)
- 환경 변수(Supabase URL, Anon Key) 관리

**이유**: 인증 플로우는 딥링크와 환경 설정에 강하게 의존하므로, 배포 인프라 전문가의
설정 검토가 필수적이다.
