/**
 * 스포일러 판정 순수함수 (SPEC-FEED-001 T-A2, F7/F8/EC-7/EC-8)
 *
 * emotion 도메인의 listEmotionRecords safe/spoiler 분할 규칙의 SSOT(Single Source of Truth).
 * Feed 도메인은 무한 스크롤 + 진도 변경 시 서버 재요청 없이 클라이언트에서 재평가(F9)해야 하므로
 * 별도 순수함수로 노출한다. emotion 도메인은 이 함수를 import하여 인라인 분할을 제거했다
 * (이슈 #27 제안4, SPEC-FEED-001).
 *
 * 규칙:
 * - 본인 기록(user_id === viewerUserId) → 항상 spoiler 아님
 * - currentPage === 0 (독서 전) → 타인 기록은 모두 spoiler (EC-7)
 * - page_number > currentPage → spoiler (currentPage > 0 일 때)
 * - page_number <= currentPage → spoiler 아님 (EC-8 경계 포함)
 * - page_number null → 0 취급
 *
 * @MX:NOTE: [AUTO] emotionApi.ts 가 이 함수를 SSOT로 사용하며 인라인 분할을 제거함 — 두 도메인 규칙이 어긋나면 스포일러 UX 가 일관성을 잃는다(SPEC-FEED-001, 이슈 #27 제안4). feed 도메인의 클라이언트 재평가(F9)를 위해 순수함수로 노출한다.
 * @MX:SPEC SPEC-FEED-001
 */
import type {
  EmotionRecordWithAuthor,
} from '../emotion/types';
import type { FeedItemWithSpoiler } from './types';

/**
 * 단일 기록에 대해 시청자 기준 스포일러 여부를 판정한다.
 *
 * @param record - 감정 기록 (user_id, page_number 포함)
 * @param currentPage - 시청자의 현재 독서 페이지
 * @param viewerUserId - 시청자 식별자
 * @returns true 면 스포일러(블러 대상), false 면 노출
 */
export function isSpoilerForRecord(
  record: Pick<EmotionRecordWithAuthor, 'user_id' | 'page_number'>,
  currentPage: number,
  viewerUserId: string,
): boolean {
  const isOwn = record.user_id === viewerUserId;
  if (isOwn) {
    return false;
  }
  const pageNum = record.page_number ?? 0;
  // currentPage === 0 (독서 전) → 타인 기록은 모두 spoiler (EC-7).
  // currentPage > 0 일 때만 page_number <= currentPage 가 safe (EC-8 경계).
  const isSafe = currentPage > 0 && pageNum <= currentPage;
  return !isSafe;
}

/**
 * 피드 항목 배열 각각에 isSpoiler 계산 결과를 부여한다.
 * 원본 항목의 모든 필드를 보존하고 isSpoiler 만 추가한다.
 *
 * @param items - 집계 환산된 감정 기록 배열
 * @param currentPage - 시청자의 현재 독서 페이지
 * @param viewerUserId - 시청자 식별자
 * @returns isSpoiler 가 부착된 항목 배열 (입력 순서 보존)
 */
export function mapFeedItems(
  items: EmotionRecordWithAuthor[],
  currentPage: number,
  viewerUserId: string,
): FeedItemWithSpoiler[] {
  return items.map((item) => ({
    ...item,
    isSpoiler: isSpoilerForRecord(item, currentPage, viewerUserId),
  }));
}
