/**
 * OAuth 콜백 라우트 — sagak://auth/callback 수신
 * SPEC-NAV-001 — REQ-NAV-031, 인수 시나리오 D1/D2/D3, EC7/EC8/EC9
 *
 * 딥링크 sagak://auth/callback?... 수신 시:
 * 1. useLocalSearchParams()로 URL 쿼리 파라미터 수신 (D1)
 * 2. useSession() 상태에 따라 분기 (세션 토큰 교환은 SPEC-AUTH-001
 *    onAuthStateChange에 위임 — 이 라우트는 최소 골격):
 *    - loading(useSession=null) → 인디케이터 (EC7 루프 방지, replace 없음)
 *    - authenticated+onboarded   → router.replace('/(tabs)/')     (D2)
 *    - authenticated+!onboarded  → router.replace('/(auth)/onboarding')
 *    - !authenticated            → router.replace('/(auth)/login') (D3)
 *
 * EC8: app.json scheme 미등록 시 딥링크 자체가 수신되지 않으므로
 *      이 라우트 진입 자체가 불가능 (사전 차단, app-config.test.ts 검증).
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme/theme';
import { useSession } from '../../../src/auth/useSession';

export default function CallbackRoute() {
  // D1: URL 파라미터 수신 — 반환값은 의도적으로 미사용(void 명시).
  // 파라미터 수신 사실만 확립(딥링크 라우트 매칭 + D1 검증); 실제 토큰 교환은
  // src/auth/AuthContext.tsx onAuthStateChange에 위임하므로 여기서 소비하지 않는다.
  void useLocalSearchParams();
  const s = useSession();
  const router = useRouter();
  const theme = useTheme();

  // EC7: loading 중에는 절대 replace 하지 않는다 (세션 교환 완료 대기)
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

  // D3: 미인증 → login (에러 토큰/빈 세션 포함)
  if (!s.isAuthenticated) {
    // @MX:WARN: [AUTO] replace 사용 필수 — 콜백 URL이 백스택에 남으면 인증 재시도 시 혼란
    // @MX:REASON: OAuth 콜백 URL은 일회성이므로 백스택에서 제거해야 한다.
    router.replace('/(auth)/login');
    return null;
  }

  // D2: 인증됐으나 온보딩 미완료 → onboarding
  if (!s.isOnboarded) {
    router.replace('/(auth)/onboarding');
    return null;
  }

  // D2: 인증+온보딩 완료 → 홈
  router.replace('/(tabs)/');
  return null;
}
