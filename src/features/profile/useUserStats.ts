/**
 * 독서 통계 집계 훅 (SPEC-PROFILE-001 REQ-PROF-004/005)
 *
 * staleTime 5분 (미결정 5.2 임시값) — 네트워크 요청 빈도 감소.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { useQuery } from '@tanstack/react-query';
import { getUserStats } from './queries';
import type { UserStats } from './types';

/** 통계 staleTime 5분 (미결정 5.2 임시값) */
export const USER_STATS_STALE_TIME = 5 * 60 * 1000;

export const USER_STATS_QUERY_KEY = (userId: string) =>
  ['user-stats', userId] as const;

export function useUserStats(userId: string) {
  return useQuery<UserStats, Error>({
    queryKey: USER_STATS_QUERY_KEY(userId),
    queryFn: () => getUserStats(userId),
    staleTime: USER_STATS_STALE_TIME,
    enabled: Boolean(userId),
  });
}
