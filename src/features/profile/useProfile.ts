/**
 * 자기 프로필 조회 훅 (SPEC-PROFILE-001 REQ-PROF-001)
 *
 * staleTime 0 (기본값) — 수정 후 즉시 최신 반영.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { useQuery } from '@tanstack/react-query';
import { getProfile } from './queries';
import type { Profile } from './types';

export const PROFILE_QUERY_KEY = (userId: string) => ['profile', userId] as const;

export function useProfile(userId: string) {
  return useQuery<Profile | null, Error>({
    queryKey: PROFILE_QUERY_KEY(userId),
    queryFn: () => getProfile(userId),
    enabled: Boolean(userId),
  });
}
