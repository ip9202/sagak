/**
 * 진입 분기 화면 — useSession() 기반 라우팅
 * SPEC-NAV-001 — REQ-NAV-020, 인수 시나리오 G1/G2/G3/G6/G7, EC7
 *
 * 분기 로직 (useSession 단일 진실 원천):
 * - null (loading)                → ActivityIndicator (G1/G7 점멸 없음)
 * - !isAuthenticated              → router.replace('/(auth)/login')  (G3)
 * - isAuthenticated && !isOnboarded → router.replace('/(auth)/onboarding') (G6, EC3)
 * - isAuthenticated && isOnboarded  → router.replace('/(tabs)/')     (G2)
 *
 * 기존 SPEC-UI-001 데모 콘텐츠는 app/_dev.tsx에 보존되어 있으므로
 * 이 파일은 진입 분기 역할만 수행한다.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/theme';
import { useSession } from '../src/auth/useSession';

export default function IndexScreen() {
  const s = useSession();
  const router = useRouter();
  const theme = useTheme();

  // G1/G7/EC7: loading 시 아무 replace도 하지 않고 인디케이터만 → 점멸/루프 방지
  if (s === null) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg.base,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
      </View>
    );
  }

  // G3: 미인증 → login
  if (!s.isAuthenticated) {
    // @MX:WARN: [AUTO] replace 사용 필수 — push 사용 시 백스택에 진입 분기가 남아 인증 후 노출됨
    // @MX:REASON: 백버튼으로 진입 분기로 돌아가는 것을 차단하여 인증 플로우를 단방향으로 유지.
    router.replace('/(auth)/login');
    return null;
  }

  // G6/EC3: 인증됐으나 온보딩 미완료 → onboarding
  if (!s.isOnboarded) {
    router.replace('/(auth)/onboarding');
    return null;
  }

  // G2: 인증+온보딩 완료 → tabs 홈
  router.replace('/(tabs)/');
  return null;
}
