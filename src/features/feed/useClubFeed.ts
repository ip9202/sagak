/**
 * 모임 피드 React Query 무한 스크롤 훅 (SPEC-FEED-001 T-A4)
 *
 * TanStack React Query v5 useInfiniteQuery 로 커서 페이지네이션을 구성한다.
 *
 * queryKey 전략 (F9 핵심):
 * - ['feed','club',clubId] — currentPage 를 넣지 않는다.
 * - currentPage 변경은 서버 재요청 없이 클라이언트 spoilerFilter(isSpoilerForRecord /
 *   mapFeedItems) 로만 재평가한다. 캐시된 items 를 동일하게 두고 진도만 바뀌므로
 *   네트워크 비용 없이 스포일러 상태가 전환된다.
 *
 * enabled: clubId/bookId/userId 중 하나라도 비어있으면 비활성화 (useLibraryItem 패턴).
 *
 * @MX:NOTE: [AUTO] queryKey 에 currentPage 미포함은 의도적 — F9 요구사항. queryKey/currentPage 분리를 위해 훅 인자를 명시적으로 받는다.
 * @MX:SPEC SPEC-FEED-001
 */
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { fetchClubFeedPage } from './queries';
import type { FeedCursor, FeedPageResult } from './types';

/**
 * feed 쿼리 캐시 키 (useClubFeedRealtime 과 공유 — F9: currentPage 미포함).
 * 단일 진실 원천: 이 키 형태가 바뀌면 Realtime invalidate 대상과 캐시가 어긋나
 * 실시간 반영(F12/F14)과 진도 재평가(F9)가 모두 깨진다.
 */
export const FEED_QUERY_KEY = (clubId: string): readonly unknown[] =>
  ['feed', 'club', clubId] as const;

export interface UseClubFeedArgs {
  clubId: string;
  bookId: string;
  currentPage: number;
  userId: string;
  /** 페이지 크기 (기본 20) */
  limit?: number;
}

/**
 * 모임 피드 무한 스크롤 조회 훅.
 *
 * @returns useInfiniteQuery 결과 — data.pages 는 FeedPageResult[], pageParam 은 FeedCursor
 */
// @MX:NOTE: [AUTO] 모임 피드 데이터 조회 훅 — 현재 fan_in 1(ClubFeedScreen). fan_in 3 도달 시 ANCHOR 승격.
// @MX:NOTE: [AUTO] useInfiniteQuery 제네릭 — <TData, TError, TQueryData, TQueryKey, TPageParam>. TPageParam=FeedCursor 로 고정하여 pageParam/initialPageParam/getNextPageParam 타입이 일치한다.
export function useClubFeed(args: UseClubFeedArgs) {
  return useInfiniteQuery<
    FeedPageResult,
    Error,
    InfiniteData<FeedPageResult, FeedCursor>,
    readonly unknown[],
    FeedCursor
  >({
    queryKey: FEED_QUERY_KEY(args.clubId),
    queryFn: ({ pageParam }) =>
      fetchClubFeedPage({
        clubId: args.clubId,
        bookId: args.bookId,
        currentPage: args.currentPage,
        userId: args.userId,
        limit: args.limit,
        cursor: pageParam,
      }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:
      args.clubId.length > 0 &&
      args.bookId.length > 0 &&
      args.userId.length > 0,
  });
}
