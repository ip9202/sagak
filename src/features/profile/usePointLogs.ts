/**
 * 포인트 내역 조회 훅 (SPEC-PROFILE-001 REQ-PROF-006)
 *
 * staleTime 5분 (미결정 5.2 임시값 — 통계와 동일).
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { useQuery } from '@tanstack/react-query';
import { getPointLogs } from './queries';
import type { PointLog } from './types';

/** 포인트 staleTime 5분 (미결정 5.2 임시값) */
export const POINT_LOGS_STALE_TIME = 5 * 60 * 1000;

export const POINT_LOGS_QUERY_KEY = (userId: string) =>
  ['point-logs', userId] as const;

export function usePointLogs(userId: string) {
  return useQuery<PointLog[], Error>({
    queryKey: POINT_LOGS_QUERY_KEY(userId),
    queryFn: () => getPointLogs(userId),
    staleTime: POINT_LOGS_STALE_TIME,
    enabled: Boolean(userId),
  });
}
