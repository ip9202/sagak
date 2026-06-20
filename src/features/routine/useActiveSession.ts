/**
 * 활성 세션 React Query 훅 (SPEC-ROUTINE-001)
 *
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { useQuery } from '@tanstack/react-query';
import { getActiveSession } from './sessionApi';
import type { ReadingSessionRow } from './types';

export const ACTIVE_SESSION_QUERY_KEY = ['routine', 'activeSession'] as const;

export function useActiveSession(): ReturnType<
  typeof useQuery<ReadingSessionRow | null, Error>
> {
  return useQuery<ReadingSessionRow | null, Error>({
    queryKey: ACTIVE_SESSION_QUERY_KEY,
    queryFn: getActiveSession,
  });
}
