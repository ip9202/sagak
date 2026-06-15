/**
 * Auth route group layout
 * SPEC-AUTH-001 — REQ-AUTH-002, REQ-AUTH-020
 *
 * login + onboarding 스크린을 Stack으로 노출한다.
 * 각 스크린 구현은 src/auth/* 에 있으며, 라우트 파일은 re-export만 수행한다.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
