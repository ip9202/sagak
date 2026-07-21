/**
 * (auth) 그룹 레이아웃 테스트 — 인증 사용자의 (auth) 접근 차단 가드
 * SPEC-NAV-001 — REQ-NAV-021, 인수 시나리오 G5
 *
 * 인증+온보딩 완료 사용자가 (auth) 경로(login/onboarding)로 직접 접근 시
 * router.replace('/(tabs)/')로 리다이렉트해야 한다.
 * 미인증/loading 사용자는 (auth) 그룹을 그대로 렌더링한다.
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
  const { View } = require('react-native');
  const Stack = Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      ReactMod.createElement(View, { testID: 'auth-stack' }, children),
    {
      Screen: ({ name }: { name: string }) =>
        ReactMod.createElement(View, { testID: `auth-screen-${name}` }),
    },
  );
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) => View({ children: href } as any),
  };
});

import AuthLayout from '../_layout';
import { AuthContext } from '../../../src/auth/AuthContext';
import type { AuthContextValue, UserProfile } from '../../../src/auth/types';

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

describe('G5: 인증+온보딩 사용자의 (auth) 접근 차단', () => {
  it('authenticated+onboarded 시 router.replace("/(tabs)/") 호출', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<AuthLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/');
  });

  it('authenticated+onboarded 시 auth-stack은 렌더링되지 않는다', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const { queryByTestId } = render(<AuthLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
    expect(queryByTestId('auth-stack')).toBeNull();
  });
});

describe('G5 예외: 미인증/loading 시 (auth) 그룹 정상 렌더링', () => {
  it('loading(useSession=null) 시 (auth) Stack 렌더링 (replace 호출 없음)', () => {
    const { getByTestId } = render(<AuthLayout />, {
      wrapper: wrap({ ...baseAuth, loading: true }),
    });
    expect(getByTestId('auth-stack')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('미인증 시 (auth) Stack 렌더링 (replace 호출 없음)', () => {
    const { getByTestId } = render(<AuthLayout />, {
      wrapper: wrap({ ...baseAuth, loading: false }),
    });
    expect(getByTestId('auth-stack')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('authenticated+!onboarded 시 (auth) Stack 렌더링 (온보딩 화면 접근 허용)', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const noNick: UserProfile = { ...onboardedProfile, nickname: null };
    const { getByTestId } = render(<AuthLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: noNick }),
    });
    expect(getByTestId('auth-stack')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
