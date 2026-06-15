/**
 * App Layout - ThemeProvider + AuthProvider wrapper
 * SPEC-AUTH-001 — REQ-AUTH-010 (AC-S1: AuthProvider 배치)
 * SPEC-NAV-001 — REQ-NAV-012 (루트 Stack 그룹 확장)
 *
 * 구조:
 *   <ThemeProvider>          ← 최외곽 (토큰/다크모드)
 *     <AuthProvider>         ← 그 안쪽 (세션/프로필)
 *       <Stack>              ← expo-router
 *         <Stack.Screen name="index" />      ← 진입 분기 (useSession 기반 redirect)
 *         <Stack.Screen name="(tabs)" />     ← 4탭 셸 (보호됨)
 *         <Stack.Screen name="(auth)" />     ← 인증/온보딩 (보호됨)
 *         <Stack.Screen name="_dev" />       ← __DEV__ 전용 데모
 *
 * AuthProvider가 ThemeProvider 안쪽이어야 useTheme()을 사용하는 자식이
 * 안전하게 동작하며, 동시에 모든 라우트가 인증 상태에 접근할 수 있다.
 * _dev는 프로덕션 빌드(__DEV__=false)에서 제외되어 번들에서 사라진다.
 */

import React from 'react';
import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/theme/theme';
import { AuthProvider } from '../src/auth/AuthContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          {/* @MX:NOTE: [AUTO] _dev는 __DEV__ 게이트 — 프로덕션 빌드에서는 Screen 선언 자체가 제외되어 접근 불가 (R3) */}
          {__DEV__ && <Stack.Screen name="_dev" options={{ presentation: 'modal' }} />}
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
