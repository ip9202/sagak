/**
 * useCompletionDiaryList 훅 (SPEC-COMPLETION-002, REQ-COMP2-002/007/014/015)
 *
 * fetchCompletionDiaryList 를 react-query 로 감싸 캐싱/로딩/에러/빈 상태를 담당한다.
 *
 * 계약:
 * - queryKey: ['completion','diary-list'] (trackB 접두부 컨벤션 준수)
 * - enabled: userId 가 비어 있으면 비활성화
 * - isEmpty: 성공 + 길이 0 시 true (F08-Empty 렌더 분기)
 * - refetch: 당겨서 새로고침 (REQ-COMP2-007)
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */
import { useQuery } from '@tanstack/react-query';
import { fetchCompletionDiaryList } from './completionDiaryListApi';

// @MX:NOTE: [AUTO] completion 캐시 queryKey 루트 — 향후 detail/entry 계열 확장 시 prefix 매칭용.
const COMPLETION_KEY_ROOT = ['completion'] as const;

/**
 * 완독 다이어리 리스트를 조회하는 훅.
 *
 * @param userId - 사용자 ID (빈 문자열이면 쿼리 비활성화)
 * @returns react-query 결과 + isEmpty 편의 플래그
 */
export function useCompletionDiaryList(userId: string) {
  const query = useQuery({
    queryKey: [...COMPLETION_KEY_ROOT, 'diary-list', userId],
    enabled: userId.length > 0,
    queryFn: () => fetchCompletionDiaryList(),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    isSuccess: query.isSuccess,
    error: query.error,
    refetch: query.refetch,
    // @MX:NOTE: [AUTO] isEmpty — 성공 + 길이 0 일 때만 true. F08-Empty 렌더 분기의 단일 진실.
    isEmpty: query.isSuccess && (query.data?.length ?? 0) === 0,
  };
}
