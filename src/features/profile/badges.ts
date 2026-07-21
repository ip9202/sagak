/**
 * 배지 클라이언트 산정 순수 함수 (SPEC-PROFILE-001 REQ-PROF-007)
 *
 * 별도 배지 테이블 없이 통계 + 포인트 reason 집계 데이터로 매 진입 시 재산정.
 * thresholds 는 미결정 5.1 임시값 — 사용자 피드백으로 v1.1.0 조정 예정.
 *
 * 순수 함수: 사이드 이펙트 없음, 동일 입력 → 동일 출력.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import type { Badge, BadgeCategory, BadgeInput } from './types';

/**
 * 카테고리별 배지 threshold (미결정 5.1 임시값).
 * - completion: 완독 수 1/5/10 권
 * - streak: 연속 독서일 3/7/30 일
 * - emotion: 감정 기록 누적 10/50/100 개
 * - point: 포인트 completion reason 1/5/10 회 (reaction 은 동일 표준 미사용)
 *
 * @MX:NOTE: [AUTO] 임시 threshold — v1.1.0 에서 데이터 기반 확정 예정.
 */
export const BADGE_THRESHOLDS: Record<BadgeCategory, readonly number[]> = {
  completion: [1, 5, 10],
  streak: [3, 7, 30],
  emotion: [10, 50, 100],
  point: [1, 5, 10],
};

/** 카테고리별 배지 라벨 (threshold → 한국어 라벨) */
const LABELS: Record<BadgeCategory, Record<number, string>> = {
  completion: { 1: '첫 완독', 5: '독자', 10: '책벌레' },
  streak: { 3: '3일 연속', 7: '일주일', 30: '한 달' },
  emotion: { 10: '감정 10', 50: '감정 50', 100: '감정 100' },
  point: { 1: '첫 적립', 5: '꾸준함', 10: '수집가' },
};

/** 입력에서 카테고리별 current 값을 추출 */
function currentValue(input: BadgeInput, category: BadgeCategory): number {
  switch (category) {
    case 'completion':
      return input.stats.completed_books;
    case 'streak':
      return input.current_streak;
    case 'emotion':
      return input.stats.emotion_records_count;
    case 'point':
      return input.point_reasons.completion;
  }
}

/**
 * 통계 + 포인트 데이터로 배지 배열을 산정한다.
 * current >= threshold 면 earned=true.
 *
 * @param input stats/current_streak/point_reasons
 * @returns 모든 카테고리×threshold 조합의 Badge 배열
 */
export function computeBadges(input: BadgeInput): Badge[] {
  const categories: BadgeCategory[] = [
    'completion',
    'streak',
    'emotion',
    'point',
  ];
  const result: Badge[] = [];
  for (const category of categories) {
    const thresholds = BADGE_THRESHOLDS[category];
    const current = currentValue(input, category);
    for (const threshold of thresholds) {
      result.push({
        id: `${category}-${threshold}`,
        category,
        label: LABELS[category][threshold] ?? `${threshold}`,
        threshold,
        current,
        earned: current >= threshold,
      });
    }
  }
  return result;
}
