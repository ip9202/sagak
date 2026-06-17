/**
 * 스티커 반응 React Query 훅 (SPEC-EMOTION-001 T-007)
 *
 * - useCreateSticker: precheck → create. 기존 반응 시 create 생략(에러). 409 수신 시 전파.
 * - useDeleteSticker: 본인 반응 취소.
 * - useReplaceSticker: DELETE → POST 순차 (시나리오 3.7).
 *
 * 캐시 무효화는 emotion list 키로 전파한다 — sticker 집계가 list 응답에 포함되므로
 * 별도 sticker 캐시를 두지 않는다 (plan.md 결정 3).
 *
 * @MX:NOTE: [AUTO] 스티커 반응 뮤테이션의 단일 진입점. TimelineScreen 의 EmotionRecordCard 가 소비한다.
 * @MX:WARN: [AUTO] useReplaceSticker 는 DELETE → POST 두 단계 뮤테이션으로, 중간 실패 시 부분 완료 상태가 발생할 수 있다.
 * @MX:REASON: 업서트 미적용 정책(plan.md 결정 2) 로 인해 교체를 2단계로 수행해야 하며, 네트워크 실패 시 사용자에게 재시도 안내가 필요하다.
 * @MX:SPEC SPEC-EMOTION-001
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppError } from '../../errors';
import {
  createStickerReaction,
  deleteStickerReaction,
  precheckSticker,
} from './stickerApi';
import type { StickerType } from '../../types';

/** emotion list 캐시 루트 키 — sticker 집계가 list 응답에 포함되어 함께 갱신된다. */
function emotionRootKey(bookId: string, userId: string): readonly unknown[] {
  return ['emotion', { bookId, userId }];
}

export interface UseStickerArgs {
  recordId: string;
  userId: string;
  bookId: string;
}

/**
 * 스티커 반응 등록 mutation (REQ-EMO-006, 시나리오 3.1/3.3, EC-11).
 *
 * 흐름:
 * 1. precheckSticker 로 기존 반응 조회
 * 2. 기존 반응이 있으면 create 를 호출하지 않고 AppError(VALIDATION) throw —
 *    409 사전 방지 + UI 에서 "이미 반응한 기록입니다" 안내
 * 3. 없으면 createStickerReaction 호출
 * 4. 서버 409(23505) 수신 시 그대로 전파 — getUserFriendlyMessage 가 매핑
 * 5. 성공 시 emotion list 캐시 invalidate (집계 갱신)
 */
export function useCreateSticker(args: UseStickerArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stickerType: StickerType) => {
      const existing = await precheckSticker(args.recordId, args.userId);
      if (existing) {
        // 기존 반응 존재 — create 생략, 클라이언트 측 409 등가 에러
        const err = new AppError(
          '이미 반응한 기록입니다',
          '23505',
          409,
        );
        err.category = 'VALIDATION';
        throw err;
      }
      return createStickerReaction({
        recordId: args.recordId,
        stickerType,
        userId: args.userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: emotionRootKey(args.bookId, args.userId),
      });
    },
  });
}

/**
 * 스티커 반응 취소 mutation (REQ-EMO-007, 시나리오 3.5).
 * 성공 시 emotion list 캐시 invalidate.
 */
export function useDeleteSticker(args: UseStickerArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteStickerReaction(args.recordId, args.userId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: emotionRootKey(args.bookId, args.userId),
      });
    },
  });
}

/**
 * 스티커 종류 교체 mutation (시나리오 3.7).
 * DELETE(기존 반응 취소) → POST(새 종류 등록) 순차 실행.
 * 중간(POST) 실패 시 기존 반응은 이미 삭제된 상태로, 사용자에게 재시도 안내.
 */
export function useReplaceSticker(args: UseStickerArgs) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stickerType: StickerType) => {
      // 1단계: 기존 반응 취소 (없어도 RLS DELETE 는 no-op)
      await deleteStickerReaction(args.recordId, args.userId);
      // 2단계: 새 종류 등록 — 실패 시 에러 전파 (기존 반응은 이미 삭제됨)
      return createStickerReaction({
        recordId: args.recordId,
        stickerType,
        userId: args.userId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: emotionRootKey(args.bookId, args.userId),
      });
    },
  });
}
