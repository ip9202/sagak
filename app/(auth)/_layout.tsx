/**
 * Auth route group layout — login + onboarding + callback Stack + 인증 가드
 * SPEC-AUTH-001 — REQ-AUTH-002, REQ-AUTH-020
 * SPEC-NAV-001 — REQ-NAV-021, 인수 시나리오 G5
 *
 * 인증+온보딩 완료 사용자가 (auth) 경로로 직접 접근하는 것을 차단한다:
 * - loading(useSession=null) → 그대로 Stack 렌더링 (점멸/루프 방지, replace 없음)
 * - authenticated && isOnboarded → router.replace('/(tabs)/') (G5)
 * - 그 외 (미인증 / 온보딩 미완료) → Stack 렌더링 (login/onboarding 접근 허용)
 *
 * 각 스크린 구현은 src/auth/* 에 있으며, 라우트 파일은 re-export만 수행한다.
 */

import { Stack, useRouter } from 'expo-router';
import { useSession } from '../../src/auth/useSession';

export default function AuthLayout() {
  const s = useSession();
  const router = useRouter();

  // G5: 인증+온보딩 완료 사용자의 (auth) 접근 차단
  // useSession이 null(loading)이면 절대 replace 하지 않는다 (EC7 루프 방지)
  if (s !== null && s.isAuthenticated && s.isOnboarded) {
    // @MX:WARN: [AUTO] replace 사용 필수 — push 사용 시 백스택에 (auth) 화면이 남아 tabs 진입 후 노출됨
    // @MX:REASON: 인증 완료 후 백버튼으로 로그인/온보딩 화면으로 돌아가는 것을 차단.
    router.replace('/(tabs)/');
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
