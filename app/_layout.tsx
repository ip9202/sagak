/**
 * App Layout - ThemeProvider + AuthProvider + QueryClientProvider wrapper
 * SPEC-AUTH-001 — REQ-AUTH-010 (AC-S1: AuthProvider 배치)
 * SPEC-NAV-001 — REQ-NAV-012 (루트 Stack 그룹 확장)
 * SPEC-LIBRARY-001 — TASK-001 (QueryClientProvider bootstrap)
 *
 * 구조:
 *   <ThemeProvider>          ← 최외곽 (토큰/다크모드)
 *     <QueryClientProvider>  ← React Query 캐시 (서재/진행률 비동기 상태)
 *       <AuthProvider>       ← 그 안쪽 (세션/프로필)
 *         <Stack>            ← expo-router
 *           <Stack.Screen name="index" />      ← 진입 분기 (useSession 기반 redirect)
 *           <Stack.Screen name="(tabs)" />     ← 4탭 셸 (보호됨)
 *           <Stack.Screen name="(auth)" />     ← 인증/온보딩 (보호됨)
 *           <Stack.Screen name="_dev" />       ← __DEV__ 전용 데모
 *
 * AuthProvider가 ThemeProvider 안쪽이어야 useTheme()을 사용하는 자식이
 * 안전하게 동작하며, 동시에 모든 라우트가 인증 상태에 접근할 수 있다.
 * QueryClientProvider는 모든 도메인(useQuery/useMutation)의 캐시를 공유하기 위해
 * Stack 외곽에 배치한다.
 * _dev는 프로덕션 빌드(__DEV__=false)에서 제외되어 번들에서 사라진다.
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ThemeProvider } from '../src/theme/theme';
import { AuthProvider } from '../src/auth/AuthContext';
import { getQueryClient } from '../src/lib/query/queryClient';
import { initSentry, getSentryConfigInput } from '../src/lib/sentry';
// SPEC-NOTIF-001 Optional (REQ-NOTIF-001~004): 클라이언트 Expo Push 통합
import {
  usePushTokenRegistration,
  useNotificationResponse,
} from '../src/features/notification';

// @MX:NOTE: [AUTO] OAuth 콜백 딥링크(sagak://auth/callback)로 앱이 열렸을 때 인증 세션 브라우저를 닫고
//           Supabase가 코드 교환을 완료하도록 돕는다. 반드시 모듈 최상단(컴포넌트 외부)에서 호출해야 한다.
//           컴포넌트 내부에서 호출 시 렌더링마다 중복 실행되거나 타이밍이 어긋나 세션이 누락된다.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  // REQ-DEPLOY-014: 앱 진입 시 Sentry 를 항상 초기화한다 (always initialize).
  // - dev: DSN 누락 → initSentry 가 no-op (Sentry.init 미호출, buildSentryConfig dev tolerance).
  // - prod: DSN 필수 → 누락 시 initSentry 가 throw (REQ-DEPLOY-018 fail-fast).
  // StrictMode dev 이중 호출은 Sentry SDK 가 멱등하게 처리하므로 별도 가드 없음.
  // 항상 초기화. prod DSN 누락은 빌드타임(app.config.ts validateEnv)에서 차단되므로
  // 런타임 throw는 사실상 도달 불가하지만, 방어 깊이를 위해 rejection을 잡아 콘솔에 기록한다.
  // (Sentry 없이 앱은 계속 실행 — 크래시 리포팅만 비활성)
  useEffect(() => {
    void initSentry(getSentryConfigInput()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[sentry] init failed — crash reporting disabled.', err);
    });
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={getQueryClient()}>
        <AuthProvider>
          <PushNotificationHost />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            {/* @MX:NOTE: [AUTO] _dev는 __DEV__ 게이트 — 프로덕션 빌드에서는 Screen 선언 자체가 제외되어 접근 불가 (R3) */}
            {__DEV__ && <Stack.Screen name="_dev" options={{ presentation: 'modal' }} />}
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// @MX:NOTE: [AUTO] SPEC-NOTIF-001 Optional: 푸시 토큰 등록 + 알림 탭 라우팅 훅을
//   AuthProvider 내부에서 호출하기 위한 빈 호스트 컴포넌트. 두 훅 모두 useSession/useRouter 에
//   의존하므로 AuthProvider/Stack 라우터 컨텍스트 안에 있어야 한다. 렌더링 결과는 null.
function PushNotificationHost(): React.JSX.Element | null {
  // REQ-NOTIF-001~003: 인증된 사용자 푸시 토큰 획득 + 서버 등록
  usePushTokenRegistration();
  // REQ-NOTIF-004: foreground 알림 표시 + 탭 라우팅
  useNotificationResponse();
  return null;
}
