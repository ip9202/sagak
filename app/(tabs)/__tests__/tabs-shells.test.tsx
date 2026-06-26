/**
 * 탭 placeholder 셸 렌더링 테스트 — index/library/clubs/my
 * SPEC-NAV-001 — REQ-NAV-002, 인수 시나리오 T6
 * SPEC-BOOK-001 M4-7 — library 탭이 검색 진입 CTA 빈 상태로 교체됨에 따라 업데이트
 *
 * 각 탭이 헤더 타이틀을 렌더링하는지 검증.
 * library 탭은 SPEC-BOOK-001 M4-7 빈 상태("서재가 비어 있어요") + "책 검색하기" CTA 로 교체.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// SPEC-BOOK-001 M4-7: library 탭이 router.push('/search') 를 사용하므로 mock 필요
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

// SPEC-NAV-001 홈 탭: Feather 아이콘 사용 — 네이티브 의존성 mock (expo-asset/expo-font 회피)
jest.mock('@expo/vector-icons', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: Record<string, unknown>) =>
    ReactMod.createElement(
      Text,
      { testID: 'feather-icon' },
      (props.name as string) || 'icon',
    );
  return {
    __esModule: true,
    Feather: MockIcon,
    default: MockIcon,
  };
});

// SPEC-LIBRARY-001 TASK-009: library 탭이 useSession + useLibrary 사용.
// 탭 셸 렌더링 테스트이므로 빈 결과로 고정.
jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(() => ({
    session: { access_token: 'tok', user: { id: 'u-1' } },
    user: { id: 'u-1' },
    profile: { id: 'u-1', nickname: '독자' },
    loading: false,
    isAuthenticated: true,
    isOnboarded: true,
    signInWithProvider: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  })),
}));
jest.mock('../../../src/features/library/libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(async () => []),
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

// SPEC-NAV-001 홈 탭: useAlarmSettings 소비 — 탭 셸 렌더링 테스트이므로 미설정으로 고정.
jest.mock('../../../src/features/routine/useAlarmSettings', () => ({
  useAlarmSettings: jest.fn(() => ({
    data: { alarm_time: null, alarm_enabled: false },
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

// SPEC-CLUB-002 M4: clubs 탭이 ClubsScreen 으로 교체됨 — useSession/router/hooks 안전망.
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() })),
}));
jest.mock('../../../src/features/club/trackB/hooks', () => ({
  __esModule: true,
  useHostClubs: jest.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
}));

import HomeTab from '../index';
import LibraryTab from '../library';
import ClubsTab from '../clubs';
import MyTab from '../my';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function withTheme(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>
  );
}

describe('T6: 탭 헤더/placeholder 렌더링', () => {
  it('홈 탭이 "오늘의 독서" 헤더를 렌더링한다 (SPEC-NAV-001 F03-Home)', () => {
    // 홈 탭 placeholder → F03-Home 구현으로 교체됨
    withTheme(<HomeTab />);
    expect(screen.getByText('오늘의 독서')).toBeTruthy();
  });

  it('서재 탭이 "서재" 헤더와 빈 상태 CTA "책 검색하기"를 렌더링한다', async () => {
    // SPEC-BOOK-001 M4-7: placeholder → 검색 진입 빈 상태로 교체
    // SPEC-LIBRARY-001 TASK-009: useLibrary 빈 결과 후 빈 상태 CTA 렌더링
    const { findByText, getByText } = withTheme(<LibraryTab />);
    expect(getByText('서재')).toBeTruthy();
    // 빈 상태 CTA 는 getLibrary resolve 후 표시 — waitFor
    expect(await findByText('책 검색하기')).toBeTruthy();
  });

  it('모임 탭이 ClubsScreen 헤더 타이틀 "모임"을 렌더링한다', () => {
    // SPEC-CLUB-002 M4: clubs 탭이 ClubsScreen 으로 교체됨 (placeholder 셸 → 실제 화면).
    withTheme(<ClubsTab />);
    expect(screen.getByText('모임')).toBeTruthy();
  });

  // SPEC-UI-002 PR-2: 마이 탭 헤더 타이틀이 .pen F15-My 기준 "마이페이지"로 재포팅됨.
  // (구 "마이" 단정은 .pen F15-My Title content="마이페이지" 에 맞게 정정)
  it('마이 탭이 헤더 타이틀 "마이페이지"를 렌더링한다', () => {
    withTheme(<MyTab />);
    expect(screen.getByText('마이페이지')).toBeTruthy();
  });
});
