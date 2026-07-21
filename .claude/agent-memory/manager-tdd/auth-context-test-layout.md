---
name: auth-context-test-layout
description: AuthContext.test.tsx의 mock 전략과 probe 컴포넌트 패턴 (M1-2~5에서 재사용)
metadata:
  type: project
---

`src/auth/__tests__/AuthContext.test.tsx`의 구조는 M1-2~5 TDD 사이클에서 확장된다.

**Why:** SPEC-AUTH-001의 M1 마일스톤이 5개 사이클로 분할되어 있고, 각 사이클이 같은 mock 인프라를 공유한다. 한 파일에서 누적 빌드업하는 것이 별도 파일 분할보다 회귀 감지에 유리하다.

**How to apply:**
- `mockSupabaseClient` 객체를 파일 상단에 정의하고 `jest.mock('../../lib/supabase/client', ...)`로 주입
- 각 테스트는 `beforeEach`에서 mock 리셋
- `ContextProbe` 컴포넌트로 `useContext(AuthContext)` 값을 캡처
- `onAuthStateChange` 콜백은 `onAuthCallback` 변수로 노출 — M1-4에서 SIGNED_IN/SIGNED_OUT 이벤트 시뮬레이션에 사용
- 각 사이클(M1-1/2/3/4/5)은 자체 `describe` 블록으로 추가

M1-1(AC-S1) 완료 커밋: a13ae1f

**M1-2(AC-S1, signInWithProvider) 추가 패턴:**
- `../oauth` 모듈을 `jest.mock`으로 주입 → `mockGetOAuthRedirectUri` 스텁 제어
- `renderAndCapture()` 헬퍼로 context 캡처 후 `value.signInWithProvider('kakao'|'apple'|'google')` 호출
- `signInWithOAuth` 호출 인수 단정: `{ provider, options: { redirectTo } }`
- getOAuthRedirectUri 반환값 커스터마이징 테스트로 REQ-AUTH-002 위임 검증

관련: [[jest-rn-render-pattern]]
