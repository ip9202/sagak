/**
 * OAuth 콜백 라우트 테스트 — app/(auth)/auth/callback.tsx
 * SPEC-NAV-001 — REQ-NAV-031, 인수 시나리오 D1/D2/D3, EC8/EC9
 *
 * 콜백 라우트는 sagak://auth/callback?... 딥링크를 수신한다.
 * - useLocalSearchParams()로 URL 쿼리 파라미터 수신 (D1)
 * - useSession() 상태에 따라 분기:
 *   - authenticated+onboarded → /(tabs)/ (D2)
 *   - authenticated+!onboarded → /(auth)/onboarding (D2 온보딩 안 된 경우)
 *   - !authenticated → /(auth)/login (D3)
 * - 세션 토큰 교환은 SPEC-AUTH-001 onAuthStateChange에 위임 (최소 골격)
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

const mockReplace = jest.fn();
const mockSearchParams: Record<string, any> = {};
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect' }, href),
  };
});

import CallbackRoute from '../callback';
import { AuthContext } from '../../../../src/auth/AuthContext';
import type { AuthContextValue, UserProfile } from '../../../../src/auth/types';

const baseAuth: AuthContextValue = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const onboardedProfile: UserProfile = {
  id: 'u1',
  nickname: '온보딩완료',
  avatar_url: null,
  bio: null,
  provider: 'kakao',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

function wrap(authValue: AuthContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(AuthContext.Provider, { value: authValue }, children);
  };
}

beforeEach(() => {
  mockReplace.mockClear();
  for (const k of Object.keys(mockSearchParams)) delete mockSearchParams[k];
});

describe('D1: OAuth 콜백 딥링크 수신', () => {
  it('useLocalSearchParams()로 URL 파라미터를 수신한다 (에러/토큰 쿼리)', () => {
    // 에러 파라미터 + 미인증 → D3 시나리오의 전제
    mockSearchParams.error = 'access_denied';
    render(<CallbackRoute />, { wrapper: wrap({ ...baseAuth, loading: false }) });
    // 미인증이므로 login으로 replace
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});

describe('D2: 유효 세션 수신 시 (인증+온보딩 완료) → /(tabs)/', () => {
  it('authenticated+onboarded → router.replace("/(tabs)/")', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<CallbackRoute />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });

  it('authenticated+!onboarded → router.replace("/(auth)/onboarding")', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const noNick: UserProfile = { ...onboardedProfile, nickname: null };
    render(<CallbackRoute />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: noNick }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });
});

describe('D3: 에러/미인증 수신 시 → /(auth)/login', () => {
  it('unauthenticated → router.replace("/(auth)/login")', () => {
    render(<CallbackRoute />, { wrapper: wrap({ ...baseAuth, loading: false }) });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('에러 파라미터 + unauthenticated → login', () => {
    mockSearchParams.error = 'invalid_request';
    render(<CallbackRoute />, { wrapper: wrap({ ...baseAuth, loading: false }) });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});

describe('EC7: loading(useSession=null) 시 리다이렉트 루프 방지', () => {
  it('loading 중에는 replace를 호출하지 않는다 (세션 교환 대기)', () => {
    render(<CallbackRoute />, { wrapper: wrap({ ...baseAuth, loading: true }) });
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
