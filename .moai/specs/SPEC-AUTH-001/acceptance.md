---
id: SPEC-AUTH-001
title: "OAuth Authentication & Session Management — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [auth, oauth, acceptance-criteria, gherkin, given-when-then]
---

# SPEC-AUTH-001 Acceptance Criteria

> 본 문서는 SPEC-AUTH-001의 모든 요구사항에 대한 인수 기준을 Given-When-Then (Gherkin)
> 형식으로 정의한다. 각 시나리오는 관측 가능한 증거(observable evidence)를 포함해야
> 하며, 주관적 판단("잘 작동한다", "빠르다")을 배제한다.

---

## REQ-AUTH-OAUTH: OAuth 로그인 시나리오

### 시나리오 A1: 카카오 OAuth 로그인 성공 (REQ-AUTH-002)

```gherkin
Feature: OAuth 로그인

  Scenario: 사용자가 카카오 버튼을 탭하여 OAuth 로그인에 성공한다
    Given 사용자가 로그인 화면에 있다
    And 세션이 존재하지 않는다 (session === null)
    When 사용자가 "카카오로 시작하기" 버튼을 탭한다
    Then signInWithOAuth가 provider='kakao' 인자로 호출된다
    And redirectTo 인자에 makeRedirectUri() 결과가 전달된다
    And OAuth 플로우 완료 후 onAuthStateChange의 SIGNED_IN 이벤트가 발생한다
    And AuthContext.session이 Supabase Session 객체로 설정된다
    And AuthContext.user가 Supabase User 객체로 설정된다
```

### 시나리오 A2: 구글 OAuth 로그인 성공 (REQ-AUTH-002)

```gherkin
  Scenario: 사용자가 구글 버튼을 탭하여 OAuth 로그인에 성공한다
    Given 사용자가 로그인 화면에 있다
    And 세션이 존재하지 않는다
    When 사용자가 "Google로 시작하기" 버튼을 탭한다
    Then signInWithOAuth가 provider='google' 인자로 호출된다
    And OAuth 플로우 완료 후 session과 user가 설정된다
```

### 시나리오 A3: 애플 OAuth 로그인 성공 (REQ-AUTH-002)

```gherkin
  Scenario: 사용자가 애플 버튼을 탭하여 OAuth 로그인에 성공한다
    Given 사용자가 로그인 화면에 있다
    And 세션이 존재하지 않는다
    When 사용자가 "Apple로 시작하기" 버튼을 탭한다
    Then signInWithOAuth가 provider='apple' 인자로 호출된다
    And OAuth 플로우 완료 후 session과 user가 설정된다
```

### 시나리오 A4: OAuth 로그인 취소 (REQ-AUTH-003)

```gherkin
  Scenario: 사용자가 OAuth 브라우저에서 취소한다
    Given 사용자가 OAuth 플로우 중이다 (signInWithOAuth 호출됨)
    When 사용자가 브라우저/웹뷰에서 "취소" 또는 뒤로 가기를 선택한다
    Then onAuthStateChange의 SIGNED_IN 이벤트가 발생하지 않는다
    And AuthContext.session이 null로 유지된다
    And 로그인 화면에 사용자 친화적 에러 메시지가 표시된다
    And 원시 에러 객체는 콘솔에 로깅되나 UI에 노출되지 않는다
```

### 시나리오 A5: OAuth 네트워크 오류 (REQ-AUTH-003)

```gherkin
  Scenario: OAuth 호출 중 네트워크 오류가 발생한다
    Given 사용자가 로그인 화면에 있다
    And 네트워크 연결이 불안정하다
    When 사용자가 OAuth 제공자 버튼을 탭한다
    And signInWithOAuth가 네트워크 에러로 reject된다
    Then 로그인 화면에 "네트워크 오류가 발생했습니다. 다시 시도해주세요." 메시지가 표시된다
    And AuthContext.session이 null로 유지된다
    And 에러 객체가 콘솔에 로깅된다
```

### 시나리오 A6: AuthProvider 타입 안전성 (REQ-AUTH-001)

```gherkin
  Scenario: OAuth 제공자 식별자가 users.provider CHECK 제약과 일치한다
    Given src/auth/types.ts에 AuthProvider 타입이 정의되어 있다
    Then AuthProvider는 'kakao' | 'apple' | 'google' 유니온 타입이어야 한다
    And 이 값들은 SPEC-DB-001 REQ-DB-001의 users.provider CHECK 제약값과 정확히 일치한다
    And TypeScript 컴파일러가 잘못된 provider 문자열 전달 시 에러를 발생시킨다
```

### 시나리오 A7: 프로필 행 자동 생성 보장 (REQ-AUTH-004)

```gherkin
  Scenario: OAuth 로그인 성공 시 public.users INSERT를 수행하지 않는다
    Given OAuth 로그인이 성공하여 auth.users에 새 사용자가 생성되었다
    When onAuthStateChange의 SIGNED_IN 이벤트가 발생한다
    Then handle_new_user 트리거가 이미 public.users 행을 삽입했다 (SPEC-DB-001 REQ-DB-013c)
    And 클라이언트는 public.users INSERT 쿼리를 실행하지 않는다
    And profile 조회 시 handle_new_user가 삽입한 행이 반환된다
```

---

## REQ-AUTH-SESSION: 세션 관리 시나리오

### 시나리오 S1: AuthContext Provider 배치 (REQ-AUTH-010)

```gherkin
Feature: 세션 관리

  Scenario: AuthContext가 앱 최상위에 배치된다
    Given app/_layout.tsx가 렌더링된다
    Then AuthProvider 컴포넌트가 자식 트리를 감싼다
    And AuthContext가 session, user, profile, loading 상태를 노출한다
    And AuthContext가 signInWithProvider, signOut, refreshProfile 액션을 노출한다
```

### 시나리오 S2: 앱 시작 시 자동 로그인 — 저장된 세션 있음 (REQ-AUTH-012)

```gherkin
  Scenario: 이전 로그인에서 저장된 세션이 존재한다
    Given 사용자가 이전에 로그인한 적이 있다
    And 디바이스에 Supabase 세션이 저장되어 있다
    When 앱이 실행된다
    Then loading이 true로 시작한다
    And getSession()이 호출된다
    And getSession()이 저장된 세션을 반환하면 loading이 false로 전환된다
    And session이 반환된 Session 객체로 설정된다
    And user가 Session.user로 설정된다
    And public.users 프로필 행이 조회된다
```

### 시나리오 S3: 앱 시작 시 자동 로그인 — 저장된 세션 없음 (REQ-AUTH-012)

```gherkin
  Scenario: 저장된 세션이 존재하지 않는다
    Given 사용자가 이전에 로그인한 적이 없다
    And 디바이스에 저장된 세션이 없다
    When 앱이 실행된다
    Then loading이 true로 시작한다
    And getSession()이 null을 반환하면 loading이 false로 전환된다
    And session이 null로 설정된다
    And user가 null로 설정된다
    And profile이 null로 설정된다
```

### 시나리오 S4: onAuthStateChange SIGNED_IN 이벤트 (REQ-AUTH-011)

```gherkin
  Scenario: OAuth 로그인 완료 후 SIGNED_IN 이벤트가 수신된다
    Given onAuthStateChange 리스너가 등록되어 있다
    When Supabase가 SIGNED_IN 이벤트와 함께 Session 객체를 전달한다
    Then AuthContext.session이 전달된 Session으로 설정된다
    And AuthContext.user가 Session.user로 설정된다
    And public.users 프로필 행이 조회된다 (REQ-AUTH-013)
```

### 시나리오 S5: onAuthStateChange TOKEN_REFRESHED 이벤트 (REQ-AUTH-011)

```gherkin
  Scenario: 세션 토큰이 갱신된다
    Given 사용자가 인증된 상태이다
    And 세션이 만료 임박 상태이다
    When Supabase SDK가 백그라운드에서 토큰을 갱신한다
    Then onAuthStateChange의 TOKEN_REFRESHED 이벤트가 발생한다
    And AuthContext.session이 갱신된 Session 객체로 업데이트된다
    And AuthContext.user가 갱신된 User 객체로 업데이트된다
    And profile은 재조회하지 않는다 (사용자 정보는 동일)
```

### 시나리오 S6: onAuthStateChange SIGNED_OUT 이벤트 (REQ-AUTH-011)

```gherkin
  Scenario: 로그아웃 후 SIGNED_OUT 이벤트가 수신된다
    Given 사용자가 인증된 상태이다
    When signOut()이 호출된다
    Then Supabase signOut이 실행된다
    And onAuthStateChange의 SIGNED_OUT 이벤트가 발생한다
    And AuthContext.session이 null로 초기화된다
    And AuthContext.user가 null로 초기화된다
    And AuthContext.profile이 null로 초기화된다
```

### 시나리오 S7: 프로필 행 동기화 성공 (REQ-AUTH-013)

```gherkin
  Scenario: 인증 후 public.users 프로필 행이 조회된다
    Given AuthContext.session이 인증 상태로 설정되었다
    When profile 조회 쿼리가 실행된다
    Then public.users에서 id = session.user.id 조건으로 행이 조회된다
    And 조회된 행의 nickname, avatar_url, provider 등이 profile 상태에 저장된다
```

### 시나리오 S8: 프로필 행 누락 시나리오 (REQ-AUTH-013)

```gherkin
  Scenario: handle_new_user 트리거 실패로 프로필 행이 존재하지 않는다
    Given AuthContext.session이 인증 상태이다
    And handle_new_user 트리거가 실패하여 public.users에 행이 없다
    When profile 조회 쿼리가 실행된다
    Then 조회 결과가 null이다 (또는 빈 결과)
    And 콘솔에 에러가 로깅된다
    And profile이 null로 유지된다
    And isOnboarded가 false가 된다 (온보딩 진입 조건)
```

### 시나리오 S9: 로그아웃 액션 (REQ-AUTH-014)

```gherkin
  Scenario: 사용자가 로그아웃을 요청한다
    Given 사용자가 인증된 상태이다
    When 사용자가 로그아웃 버튼을 탭하거나 signOut()이 호출된다
    Then Supabase auth.signOut()이 호출된다
    And 로컬 세션이 폐기된다
    And OAuth 제공자 측 토큰 취소는 수행되지 않는다 (MVP 범위 밖)
    And SIGNED_OUT 이벤트를 통해 상태가 초기화된다
```

---

## REQ-AUTH-ONBOARD: 온보딩 프로필 설정 시나리오

### 시나리오 O1: 온보딩 진입 — 신규 사용자 (REQ-AUTH-020)

```gherkin
Feature: 온보딩 프로필 설정

  Scenario: 신규 로그인 사용자가 온보딩 화면으로 진입한다
    Given 사용자가 OAuth 로그인을 완료했다
    And profile.nickname이 기본값이거나 미설정 상태이다
    When useSession().isOnboarded가 false로 평가된다
    Then 네비게이션이 온보딩 화면(app/(auth)/onboarding)으로 라우팅된다
```

### 시나리오 O2: 온보딩 진입 — 기존 사용자 건너뜀 (REQ-AUTH-020)

```gherkin
  Scenario: 이미 온보딩을 완료한 사용자는 온보딩을 건너뛴다
    Given 사용자가 이전에 온보딩을 완료했다
    And profile.nickname이 유효한 값으로 설정되어 있다
    When useSession().isOnboarded가 true로 평가된다
    Then 온보딩 화면으로 라우팅되지 않는다
    And 메인 앱(app/(tabs))으로 진입한다
```

### 시나리오 O3: 닉네임 빈 문자열 제출 방지 (REQ-AUTH-021)

```gherkin
  Scenario: 사용자가 빈 닉네임을 제출하려 한다
    Given 사용자가 온보딩 화면에 있다
    When nickname 입력 필드가 비어 있다
    Then "완료" 버튼이 비활성화된다
    And 버튼의 터치 이벤트가 발생하지 않는다
```

### 시나리오 O4: 닉네임 길이 제한 (REQ-AUTH-021)

```gherkin
  Scenario: 닉네임이 20자를 초과한다
    Given 사용자가 온보딩 화면에 있다
    When 사용자가 21자 이상의 닉네임을 입력한다
    Then 입력 필드가 20자에서 잘리거나 검증 에러가 표시된다
    And "완료" 버튼이 비활성화된다
```

### 시나리오 O5: 닉네임 최소 1자 검증 (REQ-AUTH-021)

```gherkin
  Scenario: 닉네임이 1자 이상이면 제출 가능하다
    Given 사용자가 온보딩 화면에 있다
    When 사용자가 1자 이상의 닉네임을 입력한다
    Then "완료" 버튼이 활성화된다
```

### 시나리오 O6: 프로필 UPDATE 성공 — nickname만 (REQ-AUTH-023)

```gherkin
  Scenario: 사용자가 nickname만 입력하고 온보딩을 완료한다
    Given 사용자가 온보딩 화면에 있다
    And nickname 필드에 "독서왕"을 입력했다
    And avatar는 선택하지 않았다 (avatar_url = null)
    When 사용자가 "완료" 버튼을 탭한다
    Then public.users UPDATE 쿼리가 실행된다
    And UPDATE 조건이 id = auth.uid() 이다 (RLS 통과)
    And UPDATE SET nickname = '독서왕'이 적용된다
    And avatar_url은 미설정 상태로 유지된다
    And refreshProfile()이 호출되어 AuthContext.profile이 갱신된다
    And isOnboarded가 true로 전환된다
```

### 시나리오 O7: 프로필 UPDATE 성공 — nickname + avatar (REQ-AUTH-022, REQ-AUTH-023)

```gherkin
  Scenario: 사용자가 nickname과 avatar를 모두 설정한다
    Given 사용자가 온보딩 화면에 있다
    And nickname 필드에 "책벌레"를 입력했다
    When 사용자가 아바타 이미지를 선택한다
    Then avatar_url에 선택된 이미지의 URL이 반영된다
    When 사용자가 "완료" 버튼을 탭한다
    Then public.users UPDATE에 nickname = '책벌레', avatar_url = <선택된 URL>이 적용된다
    And refreshProfile()이 호출되어 profile이 갱신된다
```

### 시나리오 O8: 프로필 UPDATE 실패 — RLS 거부 (REQ-AUTH-024)

```gherkin
  Scenario: RLS 정책이 UPDATE를 거부한다
    Given 사용자가 온보딩 화면에서 "완료"를 탭했다
    When public.users UPDATE가 RLS에 의해 0행 업데이트로 반환된다
    Then 온보딩 화면에 에러 메시지가 표시된다
    And 세션은 유지된다 (로그아웃되지 않음)
    And 사용자가 "완료" 버튼을 다시 탭할 수 있다
```

### 시나리오 O9: 프로필 UPDATE 실패 — 네트워크 오류 (REQ-AUTH-024)

```gherkin
  Scenario: UPDATE 중 네트워크 오류가 발생한다
    Given 사용자가 온보딩 화면에서 "완료"를 탭했다
    When public.users UPDATE가 네트워크 에러로 reject된다
    Then 온보딩 화면에 "저장 중 오류가 발생했습니다. 다시 시도해주세요." 메시지가 표시된다
    And 세션은 유지된다
    And 에러 객체가 콘솔에 로깅된다
```

---

## REQ-AUTH-GUARD: 인증 가드 훅 시나리오

### 시나리오 G1: useSession 훅 반환값 (REQ-AUTH-030)

```gherkin
Feature: 인증 가드 훅

  Scenario: useSession이 AuthContext 상태와 파생값을 반환한다
    Given AuthProvider 범위 내에서 useSession()이 호출된다
    Then useSession()이 session, user, profile, loading을 반환한다
    And useSession()이 isAuthenticated를 반환한다
    And useSession()이 isOnboarded를 반환한다
    And useSession()이 signInWithProvider, signOut, refreshProfile 액션을 반환한다
```

### 시나리오 G2: isAuthenticated 파생값 — 인증됨 (REQ-AUTH-031)

```gherkin
  Scenario: session과 user가 존재하면 isAuthenticated가 true이다
    Given AuthContext.session이 유효한 Session 객체이다
    And AuthContext.user가 유효한 User 객체이다
    When useSession()이 호출된다
    Then isAuthenticated가 true를 반환한다
```

### 시나리오 G3: isAuthenticated 파생값 — 미인증 (REQ-AUTH-031)

```gherkin
  Scenario: session이 null이면 isAuthenticated가 false이다
    Given AuthContext.session이 null이다
    When useSession()이 호출된다
    Then isAuthenticated가 false를 반환한다
```

### 시나리오 G4: isOnboarded 파생값 — 온보딩 완료 (REQ-AUTH-031)

```gherkin
  Scenario: profile.nickname이 유효하면 isOnboarded가 true이다
    Given AuthContext.profile이 유효한 UserProfile 객체이다
    And profile.nickname이 비어 있지 않은 문자열이다
    When useSession()이 호출된다
    Then isOnboarded가 true를 반환한다
```

### 시나리오 G5: isOnboarded 파생값 — 온보딩 미완료 (REQ-AUTH-031)

```gherkin
  Scenario: profile이 null이면 isOnboarded가 false이다
    Given AuthContext.profile이 null이다
    When useSession()이 호출된다
    Then isOnboarded가 false를 반환한다

  Scenario: profile.nickname이 빈 문자열이면 isOnboarded가 false이다
    Given AuthContext.profile.nickname이 빈 문자열이다
    When useSession()이 호출된다
    Then isOnboarded가 false를 반환한다
```

### 시나리오 G6: loading 상태 가드 (REQ-AUTH-032)

```gherkin
  Scenario: 초기 세션 복원 중에는 loading이 true이다
    Given 앱이 방금 실행되었다
    And getSession()이 아직 응답하지 않았다
    When useSession()이 호출된다
    Then loading이 true를 반환한다
    Then SPEC-NAV-001 인증 가드는 네비게이션 결정을 보류한다
    And 스플래시/로딩 화면이 유지된다
```

### 시나리오 G7: 컨텍스트 미배치 방어 (REQ-AUTH-033)

```gherkin
  Scenario: AuthProvider 없이 useSession을 호출하면 에러가 발생한다
    Given AuthProvider가 컴포넌트 트리에 배치되지 않았다
    When useSession()이 호출된다
    Then 명확한 에러 메시지와 함께 Error가 throw된다
    And 에러 메시지에 AuthProvider 누락 원인이 포함된다
```

### 시나리오 G8: 상태 변경 시 파생값 재계산 (REQ-AUTH-031)

```gherkin
  Scenario: AuthContext 상태 변경 시 파생값이 재계산된다
    Given useSession()이 isAuthenticated=false, isOnboarded=false를 반환하고 있다
    When 사용자가 OAuth 로그인을 완료한다
    And AuthContext.session이 Session 객체로 설정된다
    Then useSession()이 isAuthenticated=true를 반환한다
    When profile 조회가 완료되어 profile.nickname이 설정된다
    Then useSession()이 isOnboarded=true를 반환한다
    And SPEC-NAV-001 가드가 메인 앱으로 라우팅한다
```

---

## 엣지 케이스 (Edge Cases)

### 시나리오 E1: OAuth 로그인 중 앱 백그라운드 전환

```gherkin
  Scenario: OAuth 브라우저가 열려 있는 동안 앱이 백그라운드로 전환된다
    Given 사용자가 OAuth 브라우저/웹뷰에 있다
    When 사용자가 홈 버튼을 눌러 앱을 백그라운드로 전환한다
    Then OAuth 플로우는 중단되지 않는다
    When 사용자가 앱으로 돌아온 후 OAuth를 완료한다
    Then 딥링크 콜백이 정상적으로 처리된다
    And 세션이 설정된다
```

### 시나리오 E2: 세션 만료 중 데이터 입력

```gherkin
  Scenario: 감정 기록 입력 중 세션이 만료된다
    Given 사용자가 감정 기록 화면에서 텍스트를 입력 중이다
    And TOKEN_REFRESHED가 실패하여 세션이 만료된다
    When onAuthStateChange의 SIGNED_OUT 이벤트가 발생한다
    Then MVP 정책(미결정 5.2-A): 자동으로 로그인 화면으로 리다이렉트된다
    And 입력 중인 텍스트는 손실될 수 있다 (알려진 제한)
```

### 시나리오 E3: 동시 다중 OAuth 시도

```gherkin
  Scenario: 사용자가 빠르게 두 제공자 버튼을 연속 탭한다
    Given 사용자가 로그인 화면에 있다
    When 사용자가 "카카오" 버튼을 탭한 직후 "구글" 버튼을 탭한다
    Then 첫 번째 signInWithOAuth 호출만 유효하다
    And 두 번째 호출은 무시되거나 첫 번째가 완료 후 처리된다
    And UI는 중복 호출을 방지하는 로딩 상태를 표시한다
```

### 시나리오 E4: 프로필 UPDATE 중 네비게이션 이탈

```gherkin
  Scenario: 온보딩 UPDATE 응답 대기 중 사용자가 화면을 이탈한다
    Given 사용자가 온보딩 "완료"를 탭하여 UPDATE가 진행 중이다
    When 사용자가 뒤로 가기 또는 앱 종료로 화면을 이탈한다
    Then UPDATE는 서버 측에서 완료될 수 있다
    And 다음 앱 실행 시 getSession() + profile 조회로 최신 상태가 반영된다
```

### 시나리오 E5: Supabase 클라이언트 미초기화

```gherkin
  Scenario: SPEC-API-001 클라이언트 싱글톤이 초기화되지 않았다
    Given src/lib/supabase.ts가 환경 변수 없이 로드되었다
    When AuthContext가 supabase.auth 메서드를 호출한다
    Then 명확한 초기화 에러가 발생한다
    And 에러 메시지에 환경 변수 확인 지시가 포함된다
```

---

## 품질 게이트 인수 기준 (Quality Gate Criteria)

### 커버리지

- `src/auth/` 디렉토리 전체 라인 커버리지 85% 이상
- 모든 REQ-AUTH-* 요구사항에 최소 1개 시나리오 대응
- 엣지 케이스(E1-E5) 중 최소 3개에 대한 테스트 포함

### 타입 안전성

- TypeScript strict 모드 컴파일 에러 0건
- `AuthProvider` 유니온 타입이 `users.provider` CHECK 제약과 일치
- `null` 처리: `session`, `user`, `profile`의 nullable 명시

### 보안

- 클라이언트 코드에 `service_role` 키 하드코딩 없음
- 모든 데이터 접근이 RLS 정책을 통과 (클라이언트 권한 상승 시도 없음)
- OAuth 토큰이 로그나 UI에 노출되지 않음

### 접근성

- 로그인/온보딩 화면의 버튼 터치 타겟 44dp 이상 (WCAG AA)
- `accessibilityLabel` 속성 부여
- 에러 메시지가 스크린 리더에서 읽힘

### 완료 정의 (Definition of Done)

- [ ] 모든 REQ-AUTH-001 ~ REQ-AUTH-033 요구사항 구현
- [ ] 모든 Given-When-Then 시나리오(A1-E5)에 대한 테스트 통과
- [ ] 85%+ 코드 커버리지 달성
- [ ] TypeScript strict 컴파일 에러 0건
- [ ] ESLint/Prettier 검사 통과
- [ ] SPEC-DB-001 RLS 정책 통과 확인 (수동 검증)
- [ ] SPEC-NAV-001이 useSession()을 정상 소비 확인 (통합 검증)
