/**
 * App Layout - ThemeProvider + AuthProvider wrapper
 * SPEC-AUTH-001 — REQ-AUTH-010 (AC-S1: AuthProvider 배치)
 *
 * 구조:
 *   <ThemeProvider>          ← 최외곽 (토큰/다크모드)
 *     <AuthProvider>         ← 그 안쪽 (세션/프로필)
 *       <Stack>              ← expo-router
 *
 * AuthProvider가 ThemeProvider 안쪽이어야 useTheme()을 사용하는 자식이
 * 안전하게 동작하며, 동시에 모든 라우트가 인증 상태에 접근할 수 있다.
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
          <Stack.Screen name="_dev" options={{ presentation: 'modal' }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
