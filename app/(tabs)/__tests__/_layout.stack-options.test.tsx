/**
 * (tabs) 동적 라우트 Stack 옵션 테스트
 * SPEC-NAV-001 — REQ-NAV-010, REQ-NAV-011, REQ-NAV-013, 인수 시나리오 S3/S4
 *
 * 검증 대상:
 * - [bookId], clubs/[clubId] Screen이 Tabs에 등록된다 (S3/S4 진입점)
 * - presentation:'modal' 옵셔 명시된다 (REQ-NAV-013)
 * - href:null로 탭바에 표시되지 않는다 (탭 전환 시 스택 유지, S4)
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import fs from 'fs';
import path from 'path';

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

// Screen 등록을 추적
const registeredScreens: { name: string; options?: any }[] = [];
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { View, Text } = require('react-native');
  const collectScreens = (children: React.ReactNode): { name: string; options?: any }[] => {
    const items: { name: string; options?: any }[] = [];
    ReactMod.Children.forEach(children, (child: any) => {
      if (child?.props?.name) {
        items.push({ name: child.props.name, options: child.props.options });
      }
    });
    return items;
  };

  const Tabs = Object.assign(
    ({ children }: any) => {
      const screens = collectScreens(children);
      registeredScreens.push(...screens);
      return ReactMod.createElement(View, { testID: 'tabs-navigator' }, children);
    },
    {
      Screen: ({ name }: { name: string }) =>
        ReactMod.createElement(View, { testID: `tab-screen-${name}` }),
    },
  );

  return {
    Tabs,
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, null, href),
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

const onboardedProfile: UserProfile = {
  id: 'u1',
  nickname: '온',
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
  registeredScreens.length = 0;
});

describe('S3/S4 + REQ-NAV-013: 동적 라우트 등록 + 전환 옵션', () => {
  beforeEach(() => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<TabsLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
  });

  it('[bookId] Screen이 등록된다 (S3 진입점)', () => {
    const book = registeredScreens.find((s) => s.name === '[bookId]');
    expect(book).toBeTruthy();
  });

  it('clubs/[clubId] Screen이 등록된다 (S4 진입점)', () => {
    const club = registeredScreens.find((s) => s.name === 'clubs/[clubId]');
    expect(club).toBeTruthy();
  });

  it('동적 라우트는 href:null로 탭바에 표시되지 않는다 (S4 스택 유지)', () => {
    const book = registeredScreens.find((s) => s.name === '[bookId]');
    const club = registeredScreens.find((s) => s.name === 'clubs/[clubId]');
    expect(book?.options?.href).toBeNull();
    expect(club?.options?.href).toBeNull();
  });

  it('동적 라우트는 headerShown:false로 헤더 없이 풀스크린 렌더링된다 (REQ-NAV-013 기본 슬라이드)', () => {
    const book = registeredScreens.find((s) => s.name === '[bookId]');
    expect(book?.options?.headerShown).toBe(false);
  });
});

/**
 * REQ-SCREEN-043 회귀 방지: (tabs) 하위 모든 라우트 파일이 _layout.tsx 에 <Tabs.Screen> 으로
 * 선언되었는지 전수 검사. 선언 누락 시 expo-router 가 미선언 라우트를 자동으로 탭바에 노출하여
 * SPEC-UI-002 캡슐형 4탭이 깨짐 (과거 PR #87 completion/index 누락 회귀와 동일 패턴).
 *
 * 라우트 name 매핑 규칙: (tabs)/ 기준 파일 경로에서 .tsx 확장자 제거
 *   index.tsx → "index", completion/index.tsx → "completion/index", clubs/[clubId].tsx → "clubs/[clubId]"
 */
const TABS_DIR = path.resolve(__dirname, '..');

function collectRouteNames(dir: string, rel = ''): string[] {
  let names: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // __tests__ 디렉토리와 _layout.tsx 등 _ 접두 파일은 라우트가 아님
    if (entry.name === '__tests__' || entry.name.startsWith('_')) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      names = names.concat(collectRouteNames(full, relPath));
    } else if (entry.name.endsWith('.tsx')) {
      names.push(relPath.replace(/\.tsx$/, ''));
    }
  }
  return names;
}

describe('REQ-SCREEN-043 회귀 방지: (tabs) 모든 라우트 _layout 선언 전수 검사', () => {
  beforeEach(() => {
    const session = { user: { id: 'u1' } } as any;
    const user = { id: 'u1' } as any;
    render(<TabsLayout />, {
      wrapper: wrap({ ...baseAuth, session, user, profile: onboardedProfile }),
    });
  });

  it('선언 누락 라우트가 없어야 한다 (누락 시 expo-router 자동 탭 노출 → 캡슐형 4탭 위반)', () => {
    const routeNames = collectRouteNames(TABS_DIR);
    const declared = new Set(registeredScreens.map((s) => s.name));
    const undeclared = routeNames.filter((n) => !declared.has(n));
    expect(undeclared).toEqual([]);
  });
});
