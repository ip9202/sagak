/**
 * React Query 훅 단위 테스트 (SPEC-PROFILE-001 REQ-PROF-001/004/005/006)
 *
 * 검증 대상:
 * - P13/P14: useUserStats staleTime 5분 (캐시 적중)
 * - P1: useProfile 호출 시 getProfile 위임
 * - P10: useUserStats 호출 시 getUserStats 위임
 * - P15: usePointLogs 호출 시 getPointLogs 위임
 * - updateProfile mutation 성공 시 ['profile'] invalidate
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { useProfile, PROFILE_QUERY_KEY } from '../useProfile';
import {
  useUserStats,
  USER_STATS_QUERY_KEY,
  USER_STATS_STALE_TIME,
} from '../useUserStats';
import { usePointLogs, POINT_LOGS_QUERY_KEY } from '../usePointLogs';
import { useUpdateProfile } from '../useUpdateProfile';

// queries/mutations mock — 위임 검증용
jest.mock('../queries', () => ({
  getProfile: jest.fn(),
  getUserStats: jest.fn(),
  getPointLogs: jest.fn(),
}));
jest.mock('../mutations', () => ({
  updateProfile: jest.fn(),
  validateProfileInput: jest.fn(() => ({ valid: true })),
  NICKNAME_MAX_LENGTH: 20,
}));

import { getProfile, getUserStats, getPointLogs } from '../queries';
import { updateProfile } from '../mutations';

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, Wrapper };
}

describe('SPEC-PROFILE-001 hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useProfile: getProfile 위임 + query key 포함 userId', async () => {
    (getProfile as jest.Mock).mockResolvedValue({ id: 'u-1', nickname: '독자' });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProfile('u-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getProfile).toHaveBeenCalledWith('u-1');
    expect(result.current.data?.nickname).toBe('독자');
    expect(PROFILE_QUERY_KEY('u-1')).toEqual(['profile', 'u-1']);
  });

  it('useUserStats: getUserStats 위임 + staleTime 5분', async () => {
    (getUserStats as jest.Mock).mockResolvedValue({
      completed_books: 3,
      total_reading_seconds: 3600,
      emotion_records_count: 10,
    });
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUserStats('u-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getUserStats).toHaveBeenCalledWith('u-1');
    expect(USER_STATS_STALE_TIME).toBe(5 * 60 * 1000);
    expect(USER_STATS_QUERY_KEY('u-1')).toEqual(['user-stats', 'u-1']);
  });

  it('usePointLogs: getPointLogs 위임', async () => {
    (getPointLogs as jest.Mock).mockResolvedValue([
      { id: 'p1', amount: 100, reason: 'completion', created_at: 't1' },
    ]);
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => usePointLogs('u-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getPointLogs).toHaveBeenCalledWith('u-1');
    expect(result.current.data).toHaveLength(1);
    expect(POINT_LOGS_QUERY_KEY('u-1')).toEqual(['point-logs', 'u-1']);
  });

  it('useUpdateProfile: 성공 시 profile 쿼리 무효화', async () => {
    (updateProfile as jest.Mock).mockResolvedValue(undefined);
    const { client, Wrapper } = createWrapper();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateProfile('u-1'), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({ nickname: '새닉', avatar_url: null });
    expect(updateProfile).toHaveBeenCalledWith('u-1', {
      nickname: '새닉',
      avatar_url: null,
    });
    // ['profile'] 키 무효화 호출 검증
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile'] });
  });
});
