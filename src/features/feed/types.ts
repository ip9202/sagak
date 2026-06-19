/**
 * 피드 도메인 타입 (SPEC-FEED-001 T-A1)
 *
 * 모임(club) 단위 감정 기록 무한 스크롤 피드의 타입 계약.
 * emotion 도메인의 파생 타입을 재사용하고, 피드 전용 쿼리 옵션/커서/페이지 결과만
 * 새로 정의한다.
 *
 * 재사용 원칙 (scope discipline):
 * - EmotionRecordWithAuthor / StickerAggregate / EmotionRecordAuthor /
 *   EmotionRecordRow / Visibility 는 src/features/emotion/types.ts 에서 import.
 * - Feed 도메인은 이들을 재정의하지 않는다 (단일 진실 원천).
 *
 * @MX:NOTE: [AUTO] FeedQueryOptions.currentPage 는 queryKey 에 넣지 않는다 (F9) — currentPage 변경은 서버 재요청 없이 클라이언트 spoilerFilter 로만 재평가한다.
 * @MX:SPEC SPEC-FEED-001
 */
export type {
  EmotionRecordWithAuthor,
  StickerAggregate,
  EmotionRecordAuthor,
  EmotionRecordRow,
  Visibility,
} from '../emotion/types';

import type { EmotionRecordWithAuthor } from '../emotion/types';

/**
 * 피드 조회 옵션.
 * - clubId: 모임 식별자 (REQ-FEED-001 범위)
 * - bookId: 모임의 도서 식별자 (REQ-FEED-003 필터 — 해당 모임 도서 기록만)
 * - currentPage: 시청자의 현재 독서 페이지 (클라이언트 spoilerFilter 기준, F7/F8)
 * - userId: 시청자 식별자 (본인 기록 판정)
 * - limit: 페이지 크기 (기본 20)
 */
export interface FeedQueryOptions {
  clubId: string;
  bookId: string;
  currentPage: number;
  userId: string;
  limit?: number;
}

/**
 * 커서 페이지네이션 커서 (F4 — 중복/누락 없는 안정 시커서).
 * null 이면 첫 페이지. {created_at, id} 복합키로 created_at 이 같아도 id 로 순서가 보장된다.
 */
export interface FeedCursorValue {
  createdAt: string;
  id: string;
}
export type FeedCursor = FeedCursorValue | null;

/**
 * 단일 페이지 조회 결과.
 * - items: 집계 환산된 감정 기록 배열
 * - nextCursor: 다음 페이지 커서. items 가 limit 미만이면 null (마지막 페이지)
 */
export interface FeedPageResult {
  items: EmotionRecordWithAuthor[];
  nextCursor: FeedCursor;
}

/**
 * 스포일러 계산 결과가 부착된 피드 항목 (mapFeedItems 산출물).
 */
export interface FeedItemWithSpoiler extends EmotionRecordWithAuthor {
  isSpoiler: boolean;
}
