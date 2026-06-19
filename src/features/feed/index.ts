/**
 * Feed 도메인 barrel (SPEC-FEED-001)
 *
 * 현재 노출:
 * - useClubFeed: 모임 피드 무한 스크롤 훅
 * - fetchClubFeedPage: 커서 페이지네이션 클라이언트 API
 * - isSpoilerForRecord / mapFeedItems: 스포일러 판정 순수함수
 * - ClubFeedScreen: 피드 화면 컴포넌트
 * - useClubFeedRealtime: Realtime 구독 훅 (Phase C)
 * - 타입: FeedQueryOptions, FeedCursor, FeedPageResult, FeedItemWithSpoiler
 *
 * @MX:SPEC SPEC-FEED-001
 */
export { useClubFeed } from './useClubFeed';
export type { UseClubFeedArgs } from './useClubFeed';
export { useClubFeedRealtime } from './useClubFeedRealtime';
export type {
  UseClubFeedRealtimeArgs,
  UseClubFeedRealtimeResult,
} from './useClubFeedRealtime';
export { fetchClubFeedPage } from './queries';
export {
  isSpoilerForRecord,
  mapFeedItems,
} from './spoilerFilter';
export { ClubFeedScreen } from './components/ClubFeedScreen';
export type { ClubFeedScreenProps } from './components/ClubFeedScreen';
export type {
  FeedQueryOptions,
  FeedCursor,
  FeedCursorValue,
  FeedPageResult,
  FeedItemWithSpoiler,
} from './types';
