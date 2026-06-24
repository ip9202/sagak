/**
 * 루트 app/_layout.tsx Stack 구조 테스트
 * SPEC-NAV-001 — REQ-NAV-012, 인수 시나리오 R1/R2
 *
 * 검증 대상:
 * - ThemeProvider + AuthProvider 래퍼 보존 (R1 회귀 방지)
 * - Stack 자식에 index, (tabs), (auth), _dev 포함 (REQ-NAV-012)
 *
 * _dev 게이트(__DEV__) 테스트는 _layout.dev-gate.test.tsx에서 별도 검증한다
 * (모듈 캐시와 __DEV__ 전역 상태를 격리하기 위해 별도 파일 필요).
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// 네이티브 모듈 mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  },
}));

// Stack과 Screen을 추적하는 mock
const screenNames: string[] = [];
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { View, Text } = require('react-native');
  return {
    Stack: Object.assign(
      ({ children }: { children: React.ReactNode }) => {
        return ReactMod.createElement(View, { testID: 'root-stack' }, children);
      },
      {
        Screen: ({ name }: { name: string }) => {
          screenNames.push(name);
          return ReactMod.createElement(Text, { testID: `screen-${name}` }, name);
        },
      },
    ),
    // SPEC-NOTIF-001 Optional: useNotificationResponse 가 호출하는 useRouter stub
    useRouter: () => ({ replace: jest.fn() }),
  };
});

// AuthProvider는 실제 supabase 호출을 하므로 thin wrapper로 대체 (구조 검증이 목적)
jest.mock('../../src/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// SPEC-NOTIF-001 Optional: 루트 레이아웃 구조 검증이 목적이므로 푸시 훅 본체는 no-op 로 대체.
// (훅 자체의 동작은 usePushTokenRegistration/useNotificationResponse 단위 테스트가 보장)
const pushHookCalled = { push: 0, response: 0 };
jest.mock('../../src/features/notification', () => ({
  usePushTokenRegistration: () => {
    pushHookCalled.push += 1;
  },
  useNotificationResponse: () => {
    pushHookCalled.response += 1;
  },
}));

// SPEC-DEPLOY-001 M3 (REQ-DEPLOY-014): _layout 이 initSentry 를 useEffect 로 호출.
// @sentry/react-native ESM 은 jest-expo/node 변환 대상이 아니므로 sentry 모듈 전체를 no-op mock.
// (initSentry/getSentryConfigInput 동작은 src/lib/__tests__/sentry.test.ts 에서 단위 검증)
jest.mock('../../src/lib/sentry', () => ({
  initSentry: jest.fn().mockResolvedValue(undefined),
  getSentryConfigInput: jest.fn().mockReturnValue({
    dsn: '',
    env: 'development',
    release: '1.0.0',
  }),
}));

import RootLayout from '../_layout';

describe('REQ-NAV-012: 루트 Stack 자식 그룹 구성', () => {
  beforeEach(() => {
    screenNames.length = 0;
    pushHookCalled.push = 0;
    pushHookCalled.response = 0;
  });

  it('ThemeProvider + AuthProvider가 보존되어 Stack이 정상 렌더링된다 (R1 회귀)', () => {
    const { getByTestId } = render(<RootLayout />);
    expect(getByTestId('root-stack')).toBeTruthy();
  });

  it('Stack에 index, (tabs), (auth) 자식이 포함된다', () => {
    render(<RootLayout />);
    expect(screenNames).toContain('index');
    expect(screenNames).toContain('(tabs)');
    expect(screenNames).toContain('(auth)');
  });

  it('개발 환경에서는 _dev 자식이 포함된다 (R2)', () => {
    // jest 환경은 __DEV__=true (기본값)
    render(<RootLayout />);
    expect(screenNames).toContain('_dev');
  });

  it('SPEC-NOTIF-001 Optional: 마운트 시 usePushTokenRegistration/useNotificationResponse 호출', () => {
    render(<RootLayout />);
    // PushNotificationHost 가 AuthProvider 내부에서 두 훅을 1회씩 호출한다
    expect(pushHookCalled.push).toBeGreaterThanOrEqual(1);
    expect(pushHookCalled.response).toBeGreaterThanOrEqual(1);
  });
});
