/**
 * app/index.tsx 진입 분기 테스트
 * SPEC-NAV-001 — REQ-NAV-020, 인수 시나리오 G1/G2/G3/G6/G7, EC7
 *
 * useSession() 반환값에 따른 분기:
 * - null (loading)      → ActivityIndicator만 (G1, G7 점멸 없음)
 * - authenticated+onboarded → router.replace('/(tabs)/') (G2)
 * - !isAuthenticated     → router.replace('/(auth)/login') (G3)
 * - authenticated+!onboarded → router.replace('/(auth)/onboarding') (G6, EC3)
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
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect', style: { display: 'none' } }, href),
  };
});

import IndexScreen from '../index';
import { AuthContext } from '../../src/auth/AuthContext';
import type { AuthContextValue, UserProfile } from '../../src/auth/types';

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
});

describe('G1/G7: loading(useSession=null) 시 점멸 없음', () => {
  it('loading 중에는 (tabs)/(auth) 어떤 화면도 렌더링하지 않고 인디케이터만 표시', () => {
    // loading=true → useSession이 null 반환
    const { toJSON } = render(<IndexScreen />, {
      wrapper: wrap({ ...baseAuth, loading: true }),
    });
    // replace가 호출되지 않아야 함 (점멸 방지)
    expect(mockReplace).not.toHaveBeenCalled();
    // 데모 콘텐츠가 렌더링되지 않아야 함
    expect(JSON.stringify(toJSON())).not.toContain('사각');
  });
});

describe('G2: authenticated+onboarded → /(tabs)/', () => {
  it('router.replace("/(tabs)/") 호출 (백스택에 index 남지 않음)', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<IndexScreen />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});

describe('G3: unauthenticated → /(auth)/login', () => {
  it('router.replace("/(auth)/login") 호출', () => {
    render(<IndexScreen />, { wrapper: wrap({ ...baseAuth, loading: false }) });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});

describe('G6/EC3: authenticated+!onboarded → /(auth)/onboarding', () => {
  it('router.replace("/(auth)/onboarding") 호출', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const noNickProfile: UserProfile = { ...onboardedProfile, nickname: null };
    render(<IndexScreen />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: noNickProfile }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
