/**
 * 프로필 수정 mutation 훅 (SPEC-PROFILE-001 REQ-PROF-002)
 *
 * 성공 시 ['profile'] 쿼리 무효화 → useProfile 재조회로 마이페이지 갱신.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateProfile } from './mutations';
import type { ProfileUpdateInput } from './types';

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, ProfileUpdateInput>({
    mutationFn: (input) => updateProfile(userId, input),
    onSuccess: () => {
      // profile 쿼시 무효화 — 수정 후 마이페이지 최신 반영
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
