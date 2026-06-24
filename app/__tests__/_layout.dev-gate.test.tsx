/**
 * _dev 라우트 __DEV__ 게이트 테스트
 * SPEC-NAV-001 — REQ-NAV-012, 인수 시나리오 R3
 *
 * 프로덕션 빌드(__DEV__=false)에서는 _dev Screen이 Stack에서 제외되어야 한다.
 * 별도 파일로 분리한 이유: __DEV__ 전역 상태가 모듈 평가 시점에 고정되므로
 * 다른 _layout 테스트와 캐시 충돌을 피하기 위해 격리한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

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

jest.mock('../../src/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// @MX:NOTE: [AUTO] SPEC-NOTIF-001 Optional: _dev 게이트 검증이 목적이므로 푸시 훅 본체는 no-op 로 대체.
jest.mock('../../src/features/notification', () => ({
  usePushTokenRegistration: () => {},
  useNotificationResponse: () => {},
}));

// SPEC-DEPLOY-001 M3 (REQ-DEPLOY-014): _layout 이 sentry 모듈을 import.
// @sentry/react-native ESM 변환 이슈 회피 — 동작은 sentry.test.ts 가 검증.
jest.mock('../../src/lib/sentry', () => ({
  initSentry: jest.fn().mockResolvedValue(undefined),
  getSentryConfigInput: jest.fn().mockReturnValue({
    dsn: '',
    env: 'development',
    release: '1.0.0',
  }),
}));

// __DEV__=false로 고정한 상태에서 _layout 모듈을 로드한다
// jest 테스트 파일 상단에서 global.__DEV__를 설정하면 모듈 평가 시점에 반영된다
(global as { __DEV__?: boolean }).__DEV__ = false;

const RootLayoutProd = require('../_layout').default;

describe('R3: 프로덕션 빌드에서 _dev 라우트 제외', () => {
  it('프로덕션(__DEV__=false)에서는 _dev Screen이 렌더링되지 않는다', () => {
    screenNames.length = 0;
    render(<RootLayoutProd />);
    expect(screenNames).not.toContain('_dev');
  });
});
