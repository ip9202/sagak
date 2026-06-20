/**
 * computeBadges 단위 테스트 (SPEC-PROFILE-001 REQ-PROF-007)
 *
 * 검증 대상 (acceptance P19/P20/P22):
 * - P19: 완독 수 1 → first book 배지 획득, reader/bookworm 잠김
 * - P20: 감정 기록 수 15 → 10개 배지 획득, 50/100 배지 잠김
 * - P22: 모든 지표 0 → 전체 배지 잠김
 * - 카테고리별 thresholds (미결정 5.1 임시값) 일관성
 * - current >= threshold → earned=true
 * - 순수 함수성: 동일 입력 → 동일 출력, 사이드 이펙트 없음
 */
import { computeBadges, BADGE_THRESHOLDS } from '../badges';
import type { BadgeInput } from '../types';

describe('SPEC-PROFILE-001 REQ-PROF-007: computeBadges', () => {
  const emptyInput: BadgeInput = {
    stats: { completed_books: 0, emotion_records_count: 0 },
    current_streak: 0,
    point_reasons: { completion: 0, reaction: 0 },
  };

  describe('P19: 완독 배지 (completion)', () => {
    it('완독 수 1 → first book(1권) 획득, reader(5)/bookworm(10) 잠김', () => {
      const badges = computeBadges({
        ...emptyInput,
        stats: { completed_books: 1, emotion_records_count: 0 },
      });
      const completion = badges.filter((b) => b.category === 'completion');
      const firstBook = completion.find((b) => b.threshold === 1);
      const reader = completion.find((b) => b.threshold === 5);
      const bookworm = completion.find((b) => b.threshold === 10);

      expect(firstBook?.earned).toBe(true);
      expect(reader?.earned).toBe(false);
      expect(bookworm?.earned).toBe(false);
    });

    it('완독 수 5 → first book + reader 획득, bookworm 잠김', () => {
      const badges = computeBadges({
        ...emptyInput,
        stats: { completed_books: 5, emotion_records_count: 0 },
      });
      const completion = badges.filter((b) => b.category === 'completion');
      expect(completion.find((b) => b.threshold === 1)?.earned).toBe(true);
      expect(completion.find((b) => b.threshold === 5)?.earned).toBe(true);
      expect(completion.find((b) => b.threshold === 10)?.earned).toBe(false);
    });
  });

  describe('P20: 감정 기록 배지 (emotion)', () => {
    it('감정 기록 수 15 → 10개 배지 획득, 50/100 배지 잠김', () => {
      const badges = computeBadges({
        ...emptyInput,
        stats: { completed_books: 0, emotion_records_count: 15 },
      });
      const emotion = badges.filter((b) => b.category === 'emotion');
      expect(emotion.find((b) => b.threshold === 10)?.earned).toBe(true);
      expect(emotion.find((b) => b.threshold === 50)?.earned).toBe(false);
      expect(emotion.find((b) => b.threshold === 100)?.earned).toBe(false);
    });
  });

  describe('streak 배지 (연속 독서일)', () => {
    it('연속 7일 → 3일/7일 배지 획득, 30일 잠김', () => {
      const badges = computeBadges({
        ...emptyInput,
        current_streak: 7,
      });
      const streak = badges.filter((b) => b.category === 'streak');
      expect(streak.find((b) => b.threshold === 3)?.earned).toBe(true);
      expect(streak.find((b) => b.threshold === 7)?.earned).toBe(true);
      expect(streak.find((b) => b.threshold === 30)?.earned).toBe(false);
    });
  });

  describe('point 배지 (completion/reaction reason)', () => {
    it('completion reason 3회 → 1회/5회 잠김 기준으로 1회 획득', () => {
      const badges = computeBadges({
        ...emptyInput,
        point_reasons: { completion: 3, reaction: 0 },
      });
      const point = badges.filter((b) => b.category === 'point');
      expect(point.find((b) => b.threshold === 1)?.earned).toBe(true);
      expect(point.find((b) => b.threshold === 5)?.earned).toBe(false);
      expect(point.find((b) => b.threshold === 10)?.earned).toBe(false);
    });
  });

  describe('P22: 모든 지표 0 → 전체 잠김', () => {
    it('신규 사용자(모두 0) → 모든 배지 earned=false', () => {
      const badges = computeBadges(emptyInput);
      expect(badges.length).toBeGreaterThan(0);
      expect(badges.every((b) => b.earned === false)).toBe(true);
    });
  });

  describe('current/threshold 정확성', () => {
    it('각 배지의 current 값은 입력 소스를 반영한다', () => {
      const input: BadgeInput = {
        stats: { completed_books: 4, emotion_records_count: 60 },
        current_streak: 5,
        point_reasons: { completion: 8, reaction: 2 },
      };
      const badges = computeBadges(input);
      const completion = badges.find(
        (b) => b.category === 'completion' && b.threshold === 1,
      );
      const emotion = badges.find(
        (b) => b.category === 'emotion' && b.threshold === 50,
      );
      const streak = badges.find(
        (b) => b.category === 'streak' && b.threshold === 3,
      );
      const point = badges.find(
        (b) => b.category === 'point' && b.threshold === 5,
      );

      expect(completion?.current).toBe(4);
      expect(emotion?.current).toBe(60);
      expect(streak?.current).toBe(5);
      expect(point?.current).toBe(8);
    });
  });

  describe('순수 함수성', () => {
    it('동일 입력 → 동일 출력', () => {
      const a = computeBadges(emptyInput);
      const b = computeBadges(emptyInput);
      expect(a).toEqual(b);
    });

    it('입력 객체를 변이하지 않는다', () => {
      const input: BadgeInput = {
        stats: { completed_books: 2, emotion_records_count: 5 },
        current_streak: 3,
        point_reasons: { completion: 1, reaction: 0 },
      };
      const snapshot = JSON.stringify(input);
      computeBadges(input);
      expect(JSON.stringify(input)).toBe(snapshot);
    });
  });

  describe('BADGE_THRESHOLDS 일관성 (미결정 5.1 임시값)', () => {
    it('completion thresholds = [1, 5, 10]', () => {
      expect(BADGE_THRESHOLDS.completion).toEqual([1, 5, 10]);
    });
    it('streak thresholds = [3, 7, 30]', () => {
      expect(BADGE_THRESHOLDS.streak).toEqual([3, 7, 30]);
    });
    it('emotion thresholds = [10, 50, 100]', () => {
      expect(BADGE_THRESHOLDS.emotion).toEqual([10, 50, 100]);
    });
    it('point thresholds = [1, 5, 10]', () => {
      expect(BADGE_THRESHOLDS.point).toEqual([1, 5, 10]);
    });
  });
});
