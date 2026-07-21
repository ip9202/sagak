/**
 * React Query 훅 단위 테스트 (SPEC-ROUTINE-001)
 *
 * 검증 대상:
 * - useActiveSession: queryKey, queryFn 전달
 * - useAlarmSettings: queryKey, queryFn 전달
 * - useReadingStats: queryKey, queryFn 전달
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

jest.mock('../sessionApi', () => ({
  getActiveSession: jest.fn(),
}));
jest.mock('../alarmApi', () => ({
  getAlarmSettings: jest.fn(),
  updateAlarmTime: jest.fn(),
  toggleAlarmEnabled: jest.fn(),
}));
jest.mock('../statsApi', () => ({
  getReadingStats: jest.fn(),
}));

import { useActiveSession } from '../useActiveSession';
import { useAlarmSettings } from '../useAlarmSettings';
import { useReadingStats } from '../useReadingStats';
import { getActiveSession } from '../sessionApi';
import { getAlarmSettings } from '../alarmApi';
import { getReadingStats } from '../statsApi';

function createClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

function wrapper(client: QueryClient) {
  return function W({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('SPEC-ROUTINE-001: routine React Query hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useActiveSession: queryFn=getActiveSession, key=ACTIVE_SESSION_QUERY_KEY', async () => {
    (getActiveSession as jest.Mock).mockResolvedValue(null);
    const client = createClient();
    const { result } = renderHook(() => useActiveSession(), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getActiveSession).toHaveBeenCalled();
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual([
      'routine',
      'activeSession',
    ]);
  });

  it('useAlarmSettings: queryFn=getAlarmSettings', async () => {
    (getAlarmSettings as jest.Mock).mockResolvedValue({
      alarm_time: null,
      alarm_enabled: true,
    });
    const client = createClient();
    const { result } = renderHook(() => useAlarmSettings(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAlarmSettings).toHaveBeenCalled();
  });

  it('useReadingStats: queryFn=getReadingStats, key=READING_STATS_QUERY_KEY', async () => {
    (getReadingStats as jest.Mock).mockResolvedValue({
      total_duration_seconds: 0,
      total_sessions: 0,
      current_streak: 0,
      today_duration_seconds: 0,
    });
    const client = createClient();
    const { result } = renderHook(() => useReadingStats(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getReadingStats).toHaveBeenCalled();
    expect(client.getQueryCache().getAll()[0].queryKey).toEqual([
      'routine',
      'readingStats',
    ]);
  });
});
