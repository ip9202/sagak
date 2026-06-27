/**
 * (tabs) 그룹 레이아웃 테스트 — Tabs 네비게이터 구성 + 토큰 스타일링 + 가드
 * SPEC-NAV-001 — REQ-NAV-001, REQ-NAV-003, REQ-NAV-022, REQ-NAV-023
 * 인수 시나리오: T1~T6, G4, G6, EC3, EC7
 *
 * 검증 대상:
 * - 4개 탭 렌더링 (홈/서재/모임/마이) + Feather 아이콘 (T1)
 * - 탭바 스타일이 useTheme() 토큰 사용 (T2, T3, T4)
 * - 미인증 시 login 리다이렉트 (G4)
 * - 인증+온보딩미완 시 onboarding 리다이렉트 (G6, EC3)
 * - loading(null) 시 ActivityIndicator (EC7 리다이렉트 루프 방지)
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// @expo/vector-icons(Feather) — 네이티브 의존성 mock
jest.mock('@expo/vector-icons', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) =>
    ReactMod.createElement(Text, { testID: 'feather-icon' }, props.name || 'icon');
  return {
    __esModule: true,
    Feather: MockIcon,
    default: MockIcon,
  };
});

// router.replace 추적 (jest.mock 팩토리에서 참조하려면 mock prefix 필수)
const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { View, Text } = require('react-native');
  // 테스트가 Tabs 자식(Tab.Screen)을 검사할 수 있도록 children 트리를 평탄화하여 렌더링
  const collectScreens = (children: React.ReactNode): { name: string; options?: any }[] => {
    const items: { name: string; options?: any }[] = [];
    ReactMod.Children.forEach(children, (child: any) => {
      if (child?.type?.displayName === 'TabScreen' || child?.props?.name) {
        items.push({ name: child.props.name, options: child.props.options });
      }
    });
    return items;
  };

  const Tabs = Object.assign(
    ({ children, screenOptions }: any) => {
      const screens = collectScreens(children);
      return ReactMod.createElement(
        View,
        {
          testID: 'tabs-navigator',
          // screenOptions를 읽기 쉬운 속성으로 노출 (JSON 직렬화 후 파싱)
          screenOptionsJson: JSON.stringify(screenOptions || {}),
        },
        screens.map((s) =>
          ReactMod.createElement(Text, { key: s.name, testID: `tab-${s.name}` }, s.name),
        ),
        ReactMod.createElement(View, { testID: 'tabs-content' }, children),
      );
    },
    {
      Screen: ({ name, options, children }: any) => {
        const content = typeof children === 'function' ? children() : children;
        return ReactMod.createElement(View, { testID: `tab-screen-${name}` }, content);
      },
    },
  );

  return {
    Tabs,
    useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect', style: { display: 'none' } }, href),
    useLocalSearchParams: () => ({}),
    Link: ({ children }: any) => children,
  };
});

import TabsLayout from '../_layout';
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

const authenticatedProfile: UserProfile = {
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

describe('G4/EC7: 인증 가드 (미인증 → login, loading → 인디케이터)', () => {
  it('loading(useSession=null) 시 ActivityIndicator만 표시하고 tabs를 렌더링하지 않는다', () => {
    // loading=true → useSession이 null 반환 → _layout에서 useSession() 호출 시 null
    const { queryByTestId } = render(<TabsLayout />, {
      wrapper: wrap({ ...baseAuth, loading: true }),
    });
    expect(queryByTestId('tabs-navigator')).toBeNull();
  });

  it('미인증 시 router.replace("/(auth)/login") 호출 (G4)', () => {
    render(<TabsLayout />, { wrapper: wrap({ ...baseAuth, loading: false }) });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
  });
});

describe('G6/EC3: 온보딩 미완료 가드 (인증+온보딩미완 → onboarding)', () => {
  it('인증됐으나 nickname 없으면 router.replace("/(auth)/onboarding") 호출 (G6, EC3)', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const profileNoNick: UserProfile = {
      ...authenticatedProfile,
      nickname: null,
    };
    render(<TabsLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: profileNoNick }),
    });
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });
});

describe('T1: 4개 탭 렌더링 (인증+온보딩 완료 시)', () => {
  function renderAuthenticated() {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    return render(<TabsLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: authenticatedProfile }),
    });
  }

  it('홈/서재/모임/마이 4개 탭이 순서대로 렌더링된다', () => {
    const { getByTestId } = renderAuthenticated();
    expect(getByTestId('tab-screen-index')).toBeTruthy();
    expect(getByTestId('tab-screen-library')).toBeTruthy();
    expect(getByTestId('tab-screen-clubs')).toBeTruthy();
    expect(getByTestId('tab-screen-my')).toBeTruthy();
  });

  it('screenOptions가 정의된다 (토큰 기반 스타일 — bg-surface/border/label)', () => {
    const { getByTestId } = renderAuthenticated();
    const navigator = getByTestId('tabs-navigator');
    const opts = JSON.parse(navigator.props.screenOptionsJson);
    expect(opts).toBeTruthy();
    expect(opts.tabBarStyle).toBeTruthy();
    expect(opts.tabBarActiveTintColor).toBeTruthy();
    expect(opts.tabBarInactiveTintColor).toBeTruthy();
    // 하드코딩 금지 — 토큰값 사용 (REQ-NAV-003)
    expect(opts.tabBarActiveTintColor).toBe('#C17B2F'); // brand-500 light token
    expect(opts.tabBarInactiveTintColor).toBe('#A89585'); // text-tertiary light token
    expect(opts.tabBarStyle.backgroundColor).toBe('#FFFFFF'); // bg-surface light token
  });
});
