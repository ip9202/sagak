/**
 * 감정 아카이브 도메인 barrel (SPEC-EMOTION-001)
 *
 * emotion 도메인 공개 API 를 단일 진입점으로 노출한다.
 *
 * 현재 노출:
 * - CRUD: createEmotionRecord / listEmotionRecords / updateEmotionRecord / deleteEmotionRecord
 * - 공유 헬퍼 (SPEC-FEED-001 DRY, 이슈 #27 — feed.fetchClubFeedPage 가 emotion_records
 *   리스트 조회/집계/환산 로직을 emotion 과 단일 소스로 공유):
 *     - aggregateStickers: 원시 sticker 행 → 타입별 count 집계
 *     - toWithAuthor: PostgREST 원시 행 → EmotionRecordWithAuthor 환산
 *     - EMOTION_LIST_SELECT: emotion_records 리스트 조회 select 문자열
 * - 타입(types.ts re-export): EmotionRecordRow, EmotionRecordWithAuthor, StickerAggregate,
 *   RawStickerRow, RawListRow 등
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
export {
  createEmotionRecord,
  listEmotionRecords,
  updateEmotionRecord,
  deleteEmotionRecord,
  aggregateStickers,
  toWithAuthor,
  EMOTION_LIST_SELECT,
} from './emotionApi';
export type {
  Visibility,
  EmotionRecordRow,
  StickerReactionRow,
  StickerTypeValue,
  EmotionRecordAuthor,
  StickerAggregate,
  EmotionRecordWithAuthor,
  RawStickerRow,
  RawListRow,
  EmotionSortOption,
  CreateEmotionInput,
  UpdateEmotionInput,
  ListEmotionOptions,
  EmotionListResult,
} from './types';
