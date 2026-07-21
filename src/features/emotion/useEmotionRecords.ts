/**
 * 감정 기록 React Query 훅 (SPEC-EMOTION-001 T-006)
 *
 * - useEmotionRecords: list 조회 (useQuery)
 * - useCreateEmotionRecord / useUpdateEmotionRecord / useDeleteEmotionRecord: mutation
 *
 * queryKey 전략 (useLibrary 패턴 준수):
 * - 루트 키: ['emotion', { bookId, userId }] — mutation 시 전체 invalidate
 * - list 키: ['emotion', 'list', { bookId, userId, sort }] — sort 별 캐시 분리
 *
 * @MX:NOTE: [AUTO] 감정 기록 캐싱/뮤테이션의 단일 진입점. EmotionInputScreen/TimelineScreen 이 소비한다.
 * @MX:SPEC SPEC-EMOTION-001
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEmotionRecord,
  deleteEmotionRecord,
  listEmotionRecords,
  updateEmotionRecord,
} from './emotionApi';
import type {
  CreateEmotionInput,
  EmotionListResult,
  EmotionSortOption,
  UpdateEmotionInput,
} from './types';

/** emotion 쿼리키 루트 — bookId/userId 기준으로 모든 emotion 캐시 매칭 */
function emotionRootKey(bookId: string, userId: string): readonly unknown[] {
  return ['emotion', { bookId, userId }];
}

// @MX:ANCHOR: [AUTO] useEmotionRecords 계열 — 감정 기록 조회/뮤테이션 공개 훅 (fan_in >= 3 예상: EmotionInputScreen, TimelineScreen, 부모 도메인)
// @MX:REASON: 두 화면과 향후 모임 피드(SPEC-FEED-001) 확장이 모두 이 훅에 의존하며, queryKey/필터 계약이 바뀌면 캐시 일관성이 깨진다.
export interface UseEmotionRecordsArgs {
  bookId: string;
  userId: string;
  currentPage: number;
  sort?: EmotionSortOption;
}

/**
 * 감정 기록 목록을 조회한다 (safe/spoiler 분할 결과).
 * userId 가 빈 문자열이면 쿼리를 비활성화한다.
 */
export function useEmotionRecords(args: UseEmotionRecordsArgs) {
  return useQuery<EmotionListResult>({
    queryKey: [
      'emotion',
      'list',
      { bookId: args.bookId, userId: args.userId, sort: args.sort },
    ],
    queryFn: () =>
      listEmotionRecords({
        bookId: args.bookId,
        userId: args.userId,
        currentPage: args.currentPage,
        sort: args.sort,
      }),
    enabled: args.userId.length > 0,
  });
}

export interface UseCreateEmotionRecordArgs {
  bookId: string;
  userId: string;
}

/**
 * 감정 기록 생성 mutation (REQ-EMO-001).
 * 성공 시 emotion 루트 키를 invalidate 하여 목록을 새로고침한다.
 */
export function useCreateEmotionRecord(args: UseCreateEmotionRecordArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateEmotionInput, 'bookId'>) =>
      createEmotionRecord({ ...input, bookId: args.bookId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emotionRootKey(args.bookId, args.userId) });
    },
  });
}

export interface UseUpdateEmotionRecordArgs {
  bookId: string;
  userId: string;
}
export interface UpdateEmotionMutationInput {
  id: string;
  patch: UpdateEmotionInput;
}

/**
 * 감정 기록 수정 mutation (REQ-EMO-003).
 * 성공 시 emotion 루트 키를 invalidate 한다.
 */
export function useUpdateEmotionRecord(args: UseUpdateEmotionRecordArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateEmotionMutationInput) =>
      updateEmotionRecord(input.id, input.patch, args.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emotionRootKey(args.bookId, args.userId) });
    },
  });
}

export interface UseDeleteEmotionRecordArgs {
  bookId: string;
  userId: string;
}

/**
 * 감정 기록 삭제 mutation (REQ-EMO-004).
 * 성공 시 emotion 루트 키를 invalidate 한다.
 */
export function useDeleteEmotionRecord(args: UseDeleteEmotionRecordArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmotionRecord(id, args.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: emotionRootKey(args.bookId, args.userId) });
    },
  });
}
