---
# 8-field frontmatter (SPEC-DB-001과 동일 포맷)
id: SPEC-AUTH-001
title: "OAuth Authentication & Session Management"
version: "1.0.0"
status: completed
created: 2026-06-14
updated: 2026-06-15
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [auth, oauth, supabase-auth, session, kakao, apple, google, jwt, onboarding]
---

# SPEC-AUTH-001: OAuth Authentication & Session Management

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — OAuth 로그인(카카오/애플/구글), 세션 관리, 온보딩 프로필 UPDATE, 인증 가드 훅 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **인증 엔진**: Supabase Auth (`@supabase/supabase-js` v2 `signInWithOAuth`, `signOut`, `getSession`, `onAuthStateChange`)
- **OAuth 제공자**: 카카오(Kakao), 애플(Apple), 구글(Google) — `users.provider` CHECK 제약과 일치 (SPEC-DB-001 REQ-DB-001)
- **세션 토큰**: JWT (Supabase Auth 관리 — 클라이언트는 토큰 수명/갱신을 직접 제어하지 않음)
- **인증 상태 전파**: Supabase `onAuthStateChange` 리스너 → React Context(`AuthContext`)
- **딥링크 콜백**: OAuth 리다이렉트 URL 스킴 (Expo Linking — `makeRedirectUri`)
- **클라이언트 런타임**: React Native + Expo SDK 55+ (SPEC-UI-001 파운데이션 위에 구축)
- **프로필 데이터 계층**: `public.users` 테이블 — `handle_new_user` 트리거가 `auth.users` 생성 시 자동 INSERT (SPEC-DB-001 REQ-DB-013c). 본 SPEC은 INSERT가 아닌 UPDATE만 수행.
- **RLS 컨텍스트**: Supabase 클라이언트가 JWT를 PostgREST 헤더에 자동 주입 — RLS 정책이 `auth.uid()`로 사용자 식별 (SPEC-DB-001 REQ-DB-014: 자기 행만 UPDATE 허용)

### 단일 출처 (Single Source of Truth)

본 SPEC의 인증 플로우는 다음 문서를 복합 SSOT로 한다:
- `.moai/project/structure.md` — API 서피스 "Authentication (OAuth)" 섹션 (register/login/logout/me)
- `.moai/project/tech.md` — 인증 섹션 (Supabase Auth, 카카오/애플/구글, JWT, 자동 로그인)
- `.moai/specs/SPEC-DB-001/spec.md` — REQ-DB-001(users.provider CHECK), REQ-DB-013c(handle_new_user 트리거), REQ-DB-014(users RLS)
- `.moai/specs/INDEX.md` — Phase 1 의존성 그래프 (SPEC-API-001 → SPEC-AUTH-001 → SPEC-NAV-001)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. `public.users` 프로필 행은 `handle_new_user` SECURITY DEFINER 트리거가 `auth.users`
   생성 시 자동으로 삽입한다 (SPEC-DB-001 REQ-DB-013c). 따라서 본 SPEC은 최초 가입 시
   `public.users` INSERT를 수행하지 않으며, 온보딩 단계에서 nickname/avatar_url UPDATE만
   수행한다.
2. `users.provider`는 CHECK 제약으로 `'kakao'`, `'apple'`, `'google'` 값만 허용한다
   (SPEC-DB-001 REQ-DB-001). 본 SPEC의 OAuth 제공자 3종과 정확히 일치한다.
3. Supabase Auth `signInWithOAuth`는 브라우저/웹뷰를 열어 OAuth 플로우를 진행한 뒤,
   딥링크 콜백으로 앱으로 돌아와 세션을 설정한다. 이 딥링크 스킴은 SPEC-DEPLOY-001
   영역이나, 본 SPEC은 `makeRedirectUri` 호출 지점까지를 다룬다.
4. Supabase 클라이언트 싱글톤(SPEC-API-001 산출물)이 이미 초기화되어 있으며, 본 SPEC은
   해당 클라이언트의 `auth` 모듈을 소비한다.
5. 세션 만료 감지 및 자동 갱신은 Supabase JS SDK v2가 내부적으로 처리한다. 본 SPEC은
   `onAuthStateChange` 이벤트를 통해 만료/갱신 상태를 구독하기만 한다.

### 2.2 비즈니스 가정

1. **온보딩 필수 정책**: 신규 사용자는 최초 로그인 후 온보딩 화면에서 nickname을 반드시
   설정해야 한다. `handle_new_user` 트리거가 임의의 기본 nickname(예: `"독서자{랜덤}"`)을
   부여할 수 있으나, 온보딩 단계에서 사용자가 이를 덮어쓴다 (미결정 사항 6.1 참조 —
   온보딩 건너뛰기 허용 여부는 현재 미해결).
2. avatar_url은 온보딩에서 선택 입력이다. 미입력 시 `null`이며, UI는 기본 아바타를
   표시한다.
3. 자동 로그인은 기본 활성화다. 앱 재실행 시 `getSession()`이 저장된 세션을 복원한다.
4. 로그아웃은 로컬 세션 폐기만 수행하며, OAuth 제공자 측 연동 해제(토큰 취소)는 MVP
   범위 밖이다.
5. 애플 Sign in with Apple은 iOS App Store 정책상 OAuth 로그인을 사용하는 iOS 앱이
   Apple 옵션을 제공해야 한다 (미결정 사항 6.3 참조 — 현재 미해결, iOS 전용 조건부
   노출).

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다:
> REQ-AUTH-OAUTH, REQ-AUTH-SESSION, REQ-AUTH-ONBOARD, REQ-AUTH-GUARD.

### REQ-AUTH-OAUTH: OAuth 로그인 (카카오/애플/구글)

**목적**: 세 가지 OAuth 제공자를 통한 간편 로그인 진입점을 제공한다.

#### REQ-AUTH-001: OAuth 제공자 상수 정의

시스템은 **항상** `'kakao'`, `'apple'`, `'google'` 세 가지 OAuth 제공자 식별자를
타입 안전한 상수(`AuthProvider` 유니온 타입)로 정의해야 한다. 이 값들은
`users.provider` CHECK 제약(SPEC-DB-001 REQ-DB-001)과 정확히 일치해야 한다.

#### REQ-AUTH-002: OAuth 로그인 실행

**WHEN** 사용자가 로그인 화면에서 지원 OAuth 제공자 버튼(카카오/애플/구글)을 탭하면,
**THEN** 시스템은 Supabase Auth `signInWithOAuth(provider, { redirectTo })`를 호출하여
해당 제공자의 OAuth 플로우를 시작해야 한다.

`redirectTo`는 `expo-linking`의 `makeRedirectUri()`로 생성한 딥링크 콜백 URL이어야 한다.

#### REQ-AUTH-003: OAuth 실패 처리

**IF** OAuth 플로우 중 사용자가 취소하거나, 네트워크 오류가 발생하거나, 제공자가
인증을 거부하면,
**THEN** 시스템은 로그인 화면에 사용자 친화적 에러 메시지를 표시해야 하며, 세션을
설정하지 않은 상태로 유지해야 한다. 원시 에러 객체는 로그에만 기록하고 UI에 노출하지
않는다.

#### REQ-AUTH-004: OAuth 성공 시 프로필 행 존재 보장

**WHEN** OAuth 로그인이 성공하여 Supabase `auth.users`에 새 사용자가 생성되면,
**THEN** 시스템은 `handle_new_user` 트리거(SPEC-DB-001 REQ-DB-013c)에 의해
`public.users` 프로필 행이 이미 존재함을 가정하고, 클라이언트가 별도 INSERT를
수행하지 않아야 한다.

> 근거: `handle_new_user`는 `SECURITY DEFINER` 함수로 RLS를 우회하여 자동 INSERT한다.
> 클라이언트가 중복 INSERT를 시도하면 RLS 또는 UNIQUE 제약(`users.email`)에 의해
> 실패한다.

---

### REQ-AUTH-SESSION: 세션 관리·자동 로그인·갱신

**목적**: AuthContext를 통해 인증 상태를 전역으로 관리하고, 앱 재실행 시 자동 로그인과
세션 갱신을 처리한다.

#### REQ-AUTH-010: AuthContext 전역 상태 제공

시스템은 **항상** 앱 최상위에 `AuthContext`를 `Provider`로 배치해야 하며, 이 컨텍스트는
다음 상태를 하위 컴포넌트에 노출해야 한다:
- `session: Session | null` — 현재 Supabase 세션 객체
- `user: User | null` — 현재 `auth.users` 사용자 객체 (Supabase User 타입)
- `profile: UserProfile | null` — `public.users` 프로필 행 (nickname, avatar_url, provider 등)
- `loading: boolean` — 초기 세션 복원 중 여부
- `signInWithProvider(provider: AuthProvider): Promise<void>` — OAuth 로그인 액션
- `signOut(): Promise<void>` — 로그아웃 액션
- `refreshProfile(): Promise<void>` — 프로필 행 재조회 액션

#### REQ-AUTH-011: 세션 상태 구독 (onAuthStateChange)

**WHILE** 앱이 실행 중일 때,
**THEN** 시스템은 Supabase `onAuthStateChange` 리스너를 등록하여 세션 생성·갱신·만료
이벤트를 수신해야 한다. 이벤트 수신 시 `AuthContext` 상태를 동기화해야 한다.

이벤트 처리:
- `INITIAL_SESSION` — 앱 시작 시 저장된 세션 복원, `loading` 해제
- `SIGNED_IN` — `session`, `user` 설정, `profile` 조회 트리거
- `TOKEN_REFRESHED` — 갱신된 세션으로 `session`, `user` 업데이트
- `SIGNED_OUT` — `session`, `user`, `profile`을 `null`로 초기화

#### REQ-AUTH-012: 자동 로그인 (세션 복원)

**WHEN** 앱이 실행되면,
**THEN** 시스템은 `getSession()`을 호출하여 저장된 세션이 있는지 확인해야 한다.
유효한 세션이 존재하면 `AuthContext`를 인증 상태로 설정하고, 없으면 미인증 상태로
설정한다. 이 과정 동안 `loading`은 `true`여야 하며, 완료 후 `false`로 전환한다.

#### REQ-AUTH-013: 프로필 행 동기화

**WHEN** `AuthContext`의 `session`이 인증 상태로 전환되면,
**THEN** 시스템은 `public.users`에서 `auth.uid() = session.user.id` 조건으로 프로필 행을
조회하여 `profile` 상태에 저장해야 한다.

**IF** 프로필 행이 존재하지 않으면 (트리거 실패 등 예외 상황),
**THEN** 시스템은 에러를 로깅하고 `profile`을 `null`로 유지해야 한다. 이 경우 온보딩
화면이나 에러 처리 플로우로 진입한다 (미결정 사항 6.2 — 현재 미해결: 세션 만료 vs
프로필 누락 분기 처리 정책).

#### REQ-AUTH-014: 로그아웃

**WHEN** 사용자가 로그아웃을 요청하면,
**THEN** 시스템은 Supabase `signOut()`을 호출하여 로컬 세션을 폐기해야 한다.
`onAuthStateChange`의 `SIGNED_OUT` 이벤트가 `AuthContext` 상태를 초기화한다.

> OAuth 제공자 측 토큰 취소(연동 해제)는 MVP 범위 밖이다. 사용자는 다시 로그인 시
> 제공자 로그인 프롬프트를 보게 된다.

---

### REQ-AUTH-ONBOARD: 온보딩 프로필 설정

**목적**: 신규 사용자가 최초 로그인 후 nickname(필수)과 avatar_url(선택)을 설정하여
`public.users` 프로필을 완성한다.

#### REQ-AUTH-020: 온보딩 진입 조건

**WHEN** `AuthContext`의 `session`이 존재하지만 `profile.nickname`이 미설정 상태(트리거
기본값 또는 빈 문자열)이면,
**THEN** 시스템은 온보딩 화면으로 라우팅해야 한다.

> 온보딩 건너뛰기 허용 여부는 미결정 사항 6.1 — 현재 미해결. MVP 기본 정책은
> "nickname 필수 입력 후 완료"이나, 사용자 승인 시 "건너뛰기 허용(기본 nickname 유지)"
> 정책으로 전환 가능.

#### REQ-AUTH-021: 닉네임 입력 및 검증

**WHILE** 온보딩 화면이 표시 중일 때,
**THEN** 시스템은 nickname 입력 필드를 제공하며, 다음 검증 규칙을 적용해야 한다:
- 최소 1자, 최대 20자
- 빈 문자열 제출 불가 (submit 버튼 비활성화)
- 중복 검사는 MVP에서 수행하지 않는다 (향후 확장 — `users.nickname`에 UNIQUE 제약 없음)

#### REQ-AUTH-022: 아바타 URL 선택 입력

**WHERE** 사용자가 아바타를 설정하기를 원하면,
**THEN** 시스템은 이미지 선택(또는 기본 아바타 선택) UI를 제공해야 한다. 선택된 이미지의
URL이 `avatar_url`에 반영된다.

> 실제 Storage 업로드 로직(버킷 정책, 파일 경로 규칙)은 SPEC-DEPLOY-001 및 향후
> 프로필 확장 SPEC 영역이다. 본 SPEC은 `avatar_url` 문자열 값을 `users` UPDATE에
> 전달하는 것까지만 다룬다.

#### REQ-AUTH-023: 프로필 UPDATE 실행

**WHEN** 사용자가 온보딩 완료 버튼을 탭하면,
**THEN** 시스템은 Supabase PostgREST를 통해 `public.users`에서
`id = auth.uid()` 조건으로 `nickname`(필수) 및 `avatar_url`(선택)을 UPDATE해야 한다.

이 UPDATE는 SPEC-DB-001 REQ-DB-014 RLS 정책(`auth.uid() = id` 조건에서만 UPDATE 허용)을
통과한다. UPDATE 성공 후 `refreshProfile()`을 호출하여 `AuthContext.profile`을 갱신한다.

#### REQ-AUTH-024: 온보딩 UPDATE 실패 처리

**IF** 프로필 UPDATE가 RLS 거부, 네트워크 오류, 또는 제약 위반으로 실패하면,
**THEN** 시스템은 온보딩 화면에 에러 메시지를 표시하고, 사용자가 재시도할 수 있도록
유지해야 한다. 세션 자체는 유지된다 (로그아웃시키지 않음).

---

### REQ-AUTH-GUARD: 인증 가드용 세션 훅

**목적**: SPEC-NAV-001(네비게이션)이 소비할 인증 상태 훅을 제공하여, 미인증 사용자를
로그인 화면으로, 인증 미온보딩 사용자를 온보딩 화면으로 리다이렉트한다.

#### REQ-AUTH-030: useSession 훅 정의

시스템은 **항상** `useSession()` 커스텀 훅을 제공해야 한다. 이 훅은 `AuthContext`의
상태를 소비하여 다음 값을 반환해야 한다:
- `session`, `user`, `profile`, `loading` — `AuthContext` 값 그대로
- `isAuthenticated: boolean` — `session !== null && user !== null`
- `isOnboarded: boolean` — `profile !== null && profile.nickname`이 유효한 값
- `signInWithProvider`, `signOut`, `refreshProfile` — 액션 함수

#### REQ-AUTH-031: 인증 상태 파생값 정확성

**WHILE** `AuthContext`의 `session`, `profile`, `loading` 상태가 변경되면,
**THEN** `useSession()`이 반환하는 `isAuthenticated`, `isOnboarded` 파생값이 즉시
재계산되어야 한다. 이 값들은 SPEC-NAV-001 인증 가드의 리다이렉트 결정에 사용된다.

#### REQ-AUTH-032: 로딩 상태 가드

**IF** `loading`이 `true`이면 (초기 세션 복원 중),
**THEN** `useSession()` 소비자(SPEC-NAV-001 라우트 가드)는 네비게이션 결정을 보류하고
스플래시/로딩 상태를 유지해야 한다. `loading` 중 인증 가드가 미인증으로 오판하여
로그인 화면으로 깜빡이는 현상을 방지한다.

#### REQ-AUTH-033: 컨텍스트 미배치 방어

**IF** `useSession()`이 `AuthContext.Provider` 범위 밖에서 호출되면,
**THEN** 시스템은 명확한 에러를 발생시켜야 한다 (`AuthContext`가 `null`인 경우 throw).
이는 개발자 실수(Provider 누락)를 조기에 발견하기 위함이다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **OAuth 앱 등록 및 콜백 URL 인프라 설정**: 카카오/애플/구글 개발자 콘솔 앱 등록,
   Supabase Dashboard의 OAuth 제공자 설정, 콜백 URL 스킴 등록은 SPEC-DEPLOY-001 영역이다.
   본 SPEC은 이미 설정된 제공자를 소비하기만 한다.
2. **비밀번호 로그인**: 이메일/비밀번호 로그인은 MVP 비목표다 (OAuth만 지원).
3. **이메일 인증 / 매직 링크**: 이메일 기반 인증은 MVP 비목표다.
4. **비밀번호 재설정 / 찾기**: OAuth 전용 정책이므로 해당 없음.
5. **MFA (다중 인증)**: 확장 단계 기능이다.
6. **OAuth 제공자 토큰 취소 (연동 해제)**: 로그아웃은 로컬 세션 폐기만 수행한다.
7. **아바타 Storage 업로드 로직**: 버킷 정책, 파일 경로 규칙, 이미지 리사이즈는
   SPEC-DEPLOY-001 및 프로필 확장 SPEC 영역이다. 본 SPEC은 `avatar_url` 문자열
   UPDATE까지만 다룬다.
8. **온보딩 건너뛰기 세부 UX**: 분기 정책 자체는 미결정 사항 6.1에서 다루며, 확정 시
   본 SPEC에 반영된다.
9. **세션 만료 시 자동 리다이렉트 vs 모달 UX**: 분기 정책은 미결정 사항 6.2에서 다룬다.
10. **프로필 닉네임 중복 검사**: `users.nickname`에 UNIQUE 제약이 없으므로 MVP에서 생략.
11. **Edge Function 인증 로직**: Supabase Auth 자체 기능을 사용하며, 별도 Edge Function
    구현이 필요 없다.
12. **백엔드 스키마 변경**: `users` 테이블, `handle_new_user` 트리거, RLS 정책은
    SPEC-DB-001에 이미 구현되어 있으며, 본 SPEC은 변경하지 않는다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 온보딩 건너뛰기 허용 여부 — 미해결

**질문**: 신규 사용자가 온보딩 화면에서 nickname 입력 없이 "건너뛰기"를 할 수 있는가?

**옵션**:
- (A) nickname 필수 — 건너뛰기 버튼 없음, 완료 버튼만 (기본 정책)
- (B) 건너뛰기 허용 — 트리거가 부여한 기본 nickname 유지, 마이페이지에서 나중에 변경 가능

**영향**: (A)는 사용자 정보 품질을 보장하나 이탈률 증가 위험. (B)는 진입 장벽을
낮추나 기본 nickname(예: "독서자ABC")이 노출될 수 있음.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A) 정책으로 작성되었으나,
REQ-AUTH-020 진입 조건과 REQ-AUTH-021 검증 규칙은 (B)로 전환 시 최소 변경으로
수용 가능하도록 설계됨.

### 5.2 세션 만료 시 자동 리다이렉트 vs 모달 — 미해결

**질문**: 세션이 백그라운드에서 만료되었을 때(TOKEN_REFRESHED 실패), 사용자를
로그인 화면으로 즉시 리다이렉트할 것인가, 아니면 모달로 알림 후 현재 화면을
유지할 것인가?

**옵션**:
- (A) 자동 리다이렉트 — `onAuthStateChange` SIGNED_OUT 이벤트 시 즉시 로그인 라우트로
  전환 (UX 중단, 데이터 손실 위험)
- (B) 모달 알림 — "세션이 만료되었습니다. 다시 로그인해주세요." 모달 표시, 사용자가
  확인 시 리다이렉트 (현재 입력 데이터 보존 기회)

**영향**: 감정 기록 입력 중 세션 만료 시 (A)는 입력 내용 손실. (B)는 추가 UX 복잡도.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A) 동작(기본 Supabase 동작)을
가정하되, SPEC-NAV-001에서 보강 가능.

### 5.3 애플 Sign in with Apple 강제 요구사항 (iOS) — 미해결

**질문**: iOS App Store 정책은 "OAuth 로그인을 제공하는 iOS 앱은 Apple 옵션을 반드시
제공해야 한다"고 요구한다. 안드로이드 빌드에서 Apple 버튼을 숨길 것인가, 양쪽 모두
표시할 것인가?

**옵션**:
- (A) 플랫폼 조건부 노출 — iOS에서만 Apple 버튼 표시, 안드로이드에서는 Kakao/Google만
- (B) 양쪽 모두 표시 — 일관성 확보, 안드로이드에서 Apple 로그인은 브라우저 플로우

**영향**: (A)는 플랫폼 분기 로직 필요. (B)는 안드로이드 사용자에게 불필요한 옵션
노출이나 구현 단순.

**상태**: 미해결 — App Store 심사 전 확정 필요. MVP v1.0.0은 (B)로 작성되었으나,
REQ-AUTH-002의 제공자 버튼 목록은 `Platform.OS` 분기로 (A) 전환 가능하도록 설계됨.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-AUTH-001 | REQ-AUTH-001 ~ REQ-AUTH-033 | `.moai/project/structure.md` (Authentication API 서피스), `.moai/project/tech.md` (인증 섹션), `.moai/specs/SPEC-DB-001/spec.md` (REQ-DB-001, REQ-DB-013c, REQ-DB-014), `.moai/specs/INDEX.md` (Phase 1 의존성) |

### 하游 SPEC 의존성 (본 SPEC을 소비하는 SPEC)

| 소비자 SPEC | 소비 포인트 |
|-------------|-------------|
| SPEC-NAV-001 | `useSession()` 훅 — 인증 가드 리다이렉트 결정 (`isAuthenticated`, `isOnboarded`, `loading`) |

---

## 7. 구현 노트 (Implementation Notes)

### 구현 완료 상태

본 SPEC은 2026-06-15에 전체 구현이 완료되었습니다:

- **구현 범위**: 17개 REQ 모두 충족 (REQ-AUTH-001~004: OAuth, REQ-AUTH-010~014: 세션, REQ-AUTH-020~024: 온보딩, REQ-AUTH-030~033: 가드 훅)
- **모듈 위치**: `src/auth/` (AuthContext, useSession, types, oauth, login, onboarding)
- **라우팅**: `app/(auth)/`는 리익스포트 레이어 (실제 구현은 `src/auth/`에 존재)
- **테스트 커버리지**: src/auth 모듈 96.72% (277개 테스트 통과)
- **품질 검증**: TypeScript 0 에러, ESLint 0 에러, evaluator-active + expert-security PASS
- **PR 기록**: #4 (M0-M2: AuthContext/useSession/login), #5 (M3 온보딩 + M4 라우터 통합)

### plan.md와의 차이점

구현 과정에서 다음과 같은 변경 사항이 있었습니다:

1. **`src/auth/oauth.ts` 신규 추가**
   - 원본 plan.md에 없던 파일
   - OAuth 딥링크 URL 생성을 위한 expo-linking 래퍼 (`getOAuthRedirectUri`)
   - 의존성 해결을 위해 추가 (expo-linking 직접 호출 대신 캡슐화)

2. **구현 위치 변경: `src/auth/*` (plan.md에는 `app/(auth)/*`)**
   - plan.md에는 `app/(auth)/login.tsx`, `app/(auth)/onboarding.tsx`로 기재
   - 실제 구현은 `src/auth/login.tsx`, `src/auth/onboarding.tsx`에 위치
   - `app/(auth)/`는 리익스포트 레이어로만 사용 (Expo Router 패턴 준수)
   - 이유: 컴포넌트 분리와 테스트 용이성 확보

3. **그 외 파일**
   - 모든 파일이 plan.md대로 정확히 구현됨
   - `app/_layout.tsx`에 AuthProvider 추가 (ThemeProvider 내부에 배치)

### 아키텍처 결정 사항

- **컴포넌트 분리**: 인증 로직은 `src/auth/`에, 라우팅은 `app/(auth)/`에 분리하여 관심사 분리
- **테스트 용이성**: `src/auth/` 컴포넌트는 Expo Router 라우팅 의존 없이 독립적으로 테스트 가능
- **리익스포트 패턴**: `app/(auth)/login.tsx`는 `export { default } from '@/auth/login'` 형태로 얇은 래퍼만 제공

---

## 8. 추적성 (Traceability)

| 공급자 SPEC | 공급 포인트 |
|-------------|-------------|
| SPEC-API-001 | Supabase 클라이언트 싱글톤 (`supabase.auth` 모듈 접근) |
| SPEC-DB-001 | REQ-DB-001 (`users.provider` CHECK), REQ-DB-013c (`handle_new_user` 트리거), REQ-DB-014 (`users` RLS UPDATE 정책) |
| SPEC-UI-001 | 디자인 토큰, Button/Card 컴포넌트 (로그인/온보딩 화면 스타일링) |
