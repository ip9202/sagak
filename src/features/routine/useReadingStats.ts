/**
 * 독서 통계 React Query 훅 (SPEC-ROUTINE-001 REQ-ROUT-008)
 *
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { useQuery } from '@tanstack/react-query';
import { getReadingStats } from './statsApi';
import type { ReadingStats } from './types';

export const READING_STATS_QUERY_KEY = ['routine', 'readingStats'] as const;

export function useReadingStats(): ReturnType<
  typeof useQuery<ReadingStats, Error>
> {
  return useQuery<ReadingStats, Error>({
    queryKey: READING_STATS_QUERY_KEY,
    queryFn: getReadingStats,
  });
}
