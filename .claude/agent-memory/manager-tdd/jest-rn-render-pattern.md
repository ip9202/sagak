---
name: jest-rn-render-pattern
description: jest-expo + @testing-library/react-native에서 render를 act() 안에 넣으면 "Can't access .root on unmounted test renderer" 에러 발생
metadata:
  type: feedback
---

`@testing-library/react-native`의 `render()`를 `await act(async () => { ... })` 블록 안에서 호출하면 "Can't access .root on unmounted test renderer" 에러가 발생한다.

**Why:** 이 프로젝트(sagak)의 jest-expo 환경에서 act 래퍼가 render 결과를 즉시 unmount시키는 레이스가 발생한다. 다른 RN 프로젝트에서는 동작할 수 있지만 여기서는 안 된다.

**How to apply:**
- `render()`는 top-level에서 동기 호출
- useEffect 정착은 `await waitFor(() => expect(...))`를 render 직후 별도 호출로 처리
- 패턴:
  ```tsx
  render(<AuthProvider>...</AuthProvider>);
  await waitFor(() => expect(captured.length).toBeGreaterThan(0));
  ```
- `act()` import는 제거 (lint warning 원인)

관련 파일: [[auth-context-test-layout]]
