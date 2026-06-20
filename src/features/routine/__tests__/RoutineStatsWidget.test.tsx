/**
 * RoutineStatsWidget 렌더 테스트 (SPEC-ROUTINE-001)
 *
 * 검증 대상:
 * - 위젯 렌더 → routine-stats-widget + "오늘의 독서" 타이틀
 * - 목표 대비 진행률 표시 (ProgressBar current/total)
 * - 목표 달성(today >= goal) → GOAL_ACHIEVED 메시지 표시
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 네이티브 모듈 mock (my.test.tsx 패턴 차용)
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// ProgressBar 내부 LinearGradient mock — jsdom 환경 호환
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: (props: any) => <View {...props} />,
  };
});

jest.mock('../index', () => {
  const actual = jest.requireActual('../index');
  return {
    ...actual,
    useReadingStats: jest.fn(),
    getDailyGoal: jest.fn(),
    GOAL_ACHIEVED: '오늘의 목표, 가볍게 닿았네요. 수고했어요',
    DEFAULT_DAILY_GOAL_SECONDS: 900,
  };
});

import { RoutineStatsWidget } from '../components/RoutineStatsWidget';
import { useReadingStats, getDailyGoal } from '../index';

const mockedUseReadingStats = useReadingStats as jest.MockedFunction<typeof useReadingStats>;
const mockedGetDailyGoal = getDailyGoal as jest.MockedFunction<typeof getDailyGoal>;

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-ROUTINE-001: RoutineStatsWidget 렌더링', () => {
  it('위젯 렌더 → routine-stats-widget + "오늘의 독서"', async () => {
    mockedUseReadingStats.mockReturnValue({
      data: { total_duration_seconds: 0, total_sessions: 0, current_streak: 0, today_duration_seconds: 0 },
      isLoading: false,
    } as any);
    mockedGetDailyGoal.mockResolvedValue(900);

    const { getByTestId, getByText } = withTheme(<RoutineStatsWidget />);
    expect(getByTestId('routine-stats-widget')).toBeTruthy();
    expect(getByText('오늘의 독서')).toBeTruthy();
  });

  it('목표 미달성 → GOAL_ACHIEVED 메시지 미표시', async () => {
    mockedUseReadingStats.mockReturnValue({
      data: { total_duration_seconds: 100, total_sessions: 1, current_streak: 1, today_duration_seconds: 300 },
      isLoading: false,
    } as any);
    mockedGetDailyGoal.mockResolvedValue(900);

    const { queryByTestId } = withTheme(<RoutineStatsWidget />);
    await waitFor(() => {
      expect(mockedGetDailyGoal).toHaveBeenCalled();
    });
    expect(queryByTestId('routine-goal-achieved')).toBeNull();
  });

  it('목표 달성(today >= goal) → routine-goal-achieved 메시지 표시', async () => {
    mockedUseReadingStats.mockReturnValue({
      data: { total_duration_seconds: 1800, total_sessions: 2, current_streak: 1, today_duration_seconds: 900 },
      isLoading: false,
    } as any);
    mockedGetDailyGoal.mockResolvedValue(900);

    const { getByTestId } = withTheme(<RoutineStatsWidget />);
    await waitFor(() => {
      expect(getByTestId('routine-goal-achieved')).toBeTruthy();
    });
  });
});
