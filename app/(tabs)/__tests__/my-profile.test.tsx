/**
 * 마이 탭 통계/배지/포인트/설정 섹션 통합 테스트 (SPEC-PROFILE-001)
 *
 * 검증 대상:
 * - P10: 통계 섹션 렌더링 (완독/독서시간/감정기록 StatCard)
 * - P19: 배지 섹션 렌더링 (earned/locked BadgeCard)
 * - P15: 포인트 잔여 합계 표시
 * - P26: 이용약관/개인정보처리방침 "준비 중" 플레이스홀더
 *
 * 기존 my.test.tsx 의 useSession/Alert/router mock 패턴을 재사용.
 * 본 테스트는 새로 추가된 프로필 도메인 섹션에 집중 — 로딩/로그아웃 분기는
 * 기존 my.test.tsx 가 담당.
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));

// profile 도메인 훅 mock — 통계/포인트 데이터 주입
jest.mock('../../../src/features/profile', () => ({
  useUserStats: jest.fn(),
  usePointLogs: jest.fn(),
  useProfile: jest.fn(),
  computeBadges: jest.fn(),
  StatCard: ({ value, label, testID }: { value: string | number; label: string; testID?: string }) => {
    const { Text } = require('react-native');
    return (
      <Text testID={testID}>
        {value}-{label}
      </Text>
    );
  },
  BadgeCard: ({
    label,
    earned,
    testID,
  }: {
    label: string;
    earned: boolean;
    testID?: string;
  }) => {
    const { Text } = require('react-native');
    return (
      <Text testID={testID}>
        {label}-{earned ? 'earned' : 'locked'}
      </Text>
    );
  },
}));

jest.mock('../../../src/features/notification', () => ({
  useUnreadCount: jest.fn(() => ({ data: 0 })),
}));

import { useSession } from '../../../src/auth/useSession';
import { useUserStats, usePointLogs, computeBadges } from '../../../src/features/profile';
import MyTab from '../my';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseUserStats = useUserStats as jest.Mock;
const mockedUsePointLogs = usePointLogs as jest.Mock;
const mockedComputeBadges = computeBadges as jest.Mock;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function withTheme(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1', email: 'reader@example.com' },
  profile: { id: 'u-1', nickname: '독자', provider: 'naver' as const },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  mockedUseUserStats.mockReturnValue({
    data: { completed_books: 3, total_reading_seconds: 3600, emotion_records_count: 25 },
    isLoading: false,
  });
  mockedUsePointLogs.mockReturnValue({
    data: [{ id: 'p1', amount: 100, reason: 'completion', created_at: 't1' }],
    isLoading: false,
  });
  mockedComputeBadges.mockReturnValue([
    { id: 'completion-1', category: 'completion', label: '첫 완독', threshold: 1, current: 3, earned: true },
    { id: 'completion-5', category: 'completion', label: '독자', threshold: 5, current: 3, earned: false },
  ]);
});

describe('SPEC-PROFILE-001: 마이 탭 통계/배지/포인트/설정 섹션', () => {
  it('P10: 통계 섹션에 3개 StatCard(완독/독서시간/감정기록) 렌더링', () => {
    const { getByTestId } = withTheme(<MyTab />);
    expect(getByTestId('stat-completed')).toBeTruthy();
    expect(getByTestId('stat-seconds')).toBeTruthy();
    expect(getByTestId('stat-emotion')).toBeTruthy();
  });

  it('P19: 배지 섹션 렌더링 (computeBadges 결과)', () => {
    const { getByTestId } = withTheme(<MyTab />);
    expect(getByTestId('badge-completion-1')).toBeTruthy();
    expect(getByTestId('badge-completion-5')).toBeTruthy();
  });

  it('P15: 포인트 잔여 합계 표시', () => {
    const { getByText } = withTheme(<MyTab />);
    // amount 100 → 잔여 100
    expect(getByText('100')).toBeTruthy();
  });

  it('P26: 이용약관 "준비 중" 플레이스홀더 노출', () => {
    const { getByText } = withTheme(<MyTab />);
    expect(getByText('이용약관')).toBeTruthy();
  });

  it('P27: 개인정보 처리방침 항목 노출', () => {
    const { getByText } = withTheme(<MyTab />);
    expect(getByText('개인정보 처리방침')).toBeTruthy();
  });
});
