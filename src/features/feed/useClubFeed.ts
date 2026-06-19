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
// @MX:ANCHOR: [AUTO] 모임 피드 화면(SPEC-FEED-001 Phase B) 의 단일 진입점 — fan_in >= 3 예상 (ClubFeedScreen, 부모 모임 화면, 향후 푸시 딥링크)
// @MX:REASON: 쿼리 키/커서/활성화 조건 계약이 바뀌면 무한 스크롤 일관성과 F9 진도 재평가가 깨진다.
// @MX:NOTE: [AUTO] useInfiniteQuery 제네릭 — <TData, TError, TQueryData, TQueryKey, TPageParam>. TPageParam=FeedCursor 로 고정하여 pageParam/initialPageParam/getNextPageParam 타입이 일치한다.
export function useClubFeed(args: UseClubFeedArgs) {
  return useInfiniteQuery<
    FeedPageResult,
    Error,
    InfiniteData<FeedPageResult, FeedCursor>,
    readonly unknown[],
    FeedCursor
  >({
    queryKey: ['feed', 'club', args.clubId],
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
