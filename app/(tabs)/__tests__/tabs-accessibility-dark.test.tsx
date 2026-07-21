/**
 * 탭 접근성 + 다크모드 토큰 검증 테스트
 * SPEC-NAV-001 — REQ-NAV-001, REQ-NAV-003, 인수 시나리오 A1, T2, T3, T4, EC10
 *
 * 검증 대상:
 * - A1: 각 탭에 tabBarAccessibilityLabel 설정 (스크린 리더)
 * - T2/T3: 라이트모드 토큰값 정확성
 * - T4: 다크모드 전환 — useTheme이 dark 토큰을 반환할 때 darkColors 사용
 * - EC10: 탭바 높이 56dp
 *
 * useTheme을 holder 기반으로 모킹하여 _layout.tsx가 theme.colors.* 토큰만
 * 참조(하드코딩 없음)하고 dark/light 전환에 올바르게 반응함을 검증한다.
 * _layout.tsx는 jest.mock 이후 lazy require로 로드하여 mock 바인딩을 보장한다.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

jest.mock('@expo/vector-icons', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: any) =>
    ReactMod.createElement(Text, { testID: 'feather-icon' }, props.name || 'icon');
  return { __esModule: true, Feather: MockIcon, default: MockIcon };
});

// useTheme holder 기반 모킹 — dark/light 전환 가능
// tokens는 실제 모듈 사용 (동일 토큰값 검증 목적)
import { colors, spacing, radius, shadow, typography, motion, iconSizes, fontFamily } from '../../../src/theme/tokens';
import { darkColors } from '../../../src/theme/darkTokens';
const mockLightTheme = {
  mode: 'light' as const,
  colors,
  darkColors,
  spacing,
  radius,
  shadow,
  typography,
  motion,
  iconSizes,
  fontFamily,
};
const mockDarkTheme = {
  mode: 'dark' as const,
  colors: darkColors,
  darkColors,
  spacing,
  radius,
  shadow,
  typography,
  motion,
  iconSizes,
  fontFamily,
};
const mockThemeHolder: { current: typeof mockLightTheme | typeof mockDarkTheme } = { current: mockLightTheme };
jest.mock('../../../src/theme/theme', () => ({
  __esModule: true,
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => mockThemeHolder.current,
  useManualMode: () => ({ manualMode: null, setManualMode: jest.fn() }),
}));

const capturedOptions: { name: string; options: any }[] = [];
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { View } = require('react-native');
  const Tabs = Object.assign(
    ({ children, screenOptions }: any) => {
      ReactMod.Children.forEach(children, (child: any) => {
        if (child?.props?.name) {
          capturedOptions.push({ name: child.props.name, options: child.props.options });
        }
      });
      return ReactMod.createElement(
        View,
        {
          testID: 'tabs-navigator',
          screenOptionsJson: JSON.stringify(screenOptions || {}),
        },
        children,
      );
    },
    {
      Screen: ({ name }: { name: string }) =>
        ReactMod.createElement(View, { testID: `tab-screen-${name}` }),
    },
  );
  return {
    Tabs,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) => ReactMod.createElement(View, null, href),
  };
});

// lazy require — jest.mock 적용 이후에 _layout.tsx 평가
const TabsLayout = require('../_layout').default;
const { AuthContext } = require('../../../src/auth/AuthContext');
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
  nickname: '온',
  avatar_url: null,
  bio: null,
  provider: 'kakao',
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

function wrapWithTheme(mode: 'light' | 'dark', session: any, user: any, profile: any) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    mockThemeHolder.current = mode === 'dark' ? mockDarkTheme : mockLightTheme;
    return React.createElement(
      AuthContext.Provider,
      { value: { ...baseAuth, session, user, profile } },
      children,
    );
  };
}

beforeEach(() => {
  capturedOptions.length = 0;
  mockThemeHolder.current = mockLightTheme;
});

describe('A1: 스크린 리더 탭 레이블', () => {
  it('각 탭에 tabBarAccessibilityLabel이 설정된다', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<TabsLayout />, {
      wrapper: wrapWithTheme('light', session, user, onboardedProfile),
    });
    const labels = capturedOptions.map((c) => c.options?.tabBarAccessibilityLabel);
    expect(labels).toContain('홈 탭');
    expect(labels).toContain('서재 탭');
    expect(labels).toContain('모임 탭');
    expect(labels).toContain('마이 탭');
  });
});

describe('T2/T3: 라이트모드 토큰값 정확성', () => {
  it('라이트모드 시 brand-500/text-tertiary/bg-surface/border-default 값을 사용한다', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const { getByTestId } = render(<TabsLayout />, {
      wrapper: wrapWithTheme('light', session, user, onboardedProfile),
    });
    const opts = JSON.parse(getByTestId('tabs-navigator').props.screenOptionsJson);
    expect(opts.tabBarActiveTintColor).toBe(colors.brand[500]);
    expect(opts.tabBarInactiveTintColor).toBe(colors.text.tertiary);
    expect(opts.tabBarStyle.backgroundColor).toBe(colors.bg.surface);
    expect(opts.tabBarStyle.borderTopColor).toBe(colors.border.default);
  });
});

describe('T4: 다크모드 토큰 전환', () => {
  it('다크모드 시 darkColors 값을 사용한다 (하드코딩 아님)', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const { getByTestId } = render(<TabsLayout />, {
      wrapper: wrapWithTheme('dark', session, user, onboardedProfile),
    });
    const opts = JSON.parse(getByTestId('tabs-navigator').props.screenOptionsJson);
    expect(opts.tabBarActiveTintColor).toBe(darkColors.brand[500]);
    expect(opts.tabBarInactiveTintColor).toBe(darkColors.text.tertiary);
    expect(opts.tabBarStyle.backgroundColor).toBe(darkColors.bg.surface);
    expect(opts.tabBarStyle.borderTopColor).toBe(darkColors.border.default);
  });
});

describe('EC10: 탭바 높이 (Safe Area 무관 최소 보증)', () => {
  it('탭바 높이가 56dp로 설정된다', () => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    const { getByTestId } = render(<TabsLayout />, {
      wrapper: wrapWithTheme('light', session, user, onboardedProfile),
    });
    const opts = JSON.parse(getByTestId('tabs-navigator').props.screenOptionsJson);
    expect(opts.tabBarStyle.height).toBe(56);
  });
});
