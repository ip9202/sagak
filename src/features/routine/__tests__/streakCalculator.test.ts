/**
 * streakCalculator 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-009)
 *
 * 검증 대상 — 자정(local tz) 기준 streak 계산 (미결정 6.1 임시방침):
 * - R19: 연속 3일 streak → 3
 * - R20: 마지막 세션이 3일 전 → 0 (연속 끊김)
 * - 오늘 세션 없고 어제만 있으면 → 0 (오늘 기준 역순 검사 실패)
 * - ended_at null(활성 세션) 무시
 * - 빈 배열 → 0
 *
 * pure 함수 — Date.now() 주입 가능.
 */
import { calculateStreak } from '../streakCalculator';

describe('SPEC-ROUTINE-001 REQ-ROUT-009: calculateStreak (자정 기준)', () => {
  // 기준일: 2026-06-15 정오 (로컬 tz). 테스트 데이터도 로컬 naive 시간 사용 — tz 독립성 확보.
  const NOW = new Date('2026-06-15T12:00:00');

  it('R19: 오늘/어제/그저께 세션 → streak 3', () => {
    const endedAts = [
      '2026-06-15T08:00:00', // 오늘
      '2026-06-14T22:00:00', // 어제
      '2026-06-13T10:00:00', // 그저께
    ];
    expect(calculateStreak(endedAts, NOW)).toBe(3);
  });

  it('R20: 마지막 세션이 3일 전 → streak 0 (연속 끊김)', () => {
    const endedAts = ['2026-06-12T10:00:00']; // 3일 전
    expect(calculateStreak(endedAts, NOW)).toBe(0);
  });

  it('오늘 세션 없고 어제만 있으면 → streak 0 (오늘 기준 역순 실패)', () => {
    const endedAts = ['2026-06-14T10:00:00']; // 어제만
    expect(calculateStreak(endedAts, NOW)).toBe(0);
  });

  it('오늘 세션 있고 5일 연속 → streak 5', () => {
    const endedAts = [
      '2026-06-15T08:00:00',
      '2026-06-14T08:00:00',
      '2026-06-13T08:00:00',
      '2026-06-12T08:00:00',
      '2026-06-11T08:00:00',
    ];
    expect(calculateStreak(endedAts, NOW)).toBe(5);
  });

  it('중간에 빠진 날이 있으면 streak 는 거기서 멈춘다', () => {
    // 오늘, 어제, 3일 전(그저께 결번)
    const endedAts = [
      '2026-06-15T08:00:00',
      '2026-06-14T08:00:00',
      '2026-06-12T08:00:00',
    ];
    expect(calculateStreak(endedAts, NOW)).toBe(2);
  });

  it('ended_at null/빈문자열 무시', () => {
    const endedAts = [
      null,
      '',
      '2026-06-15T08:00:00', // 오늘만 유효
    ];
    expect(calculateStreak(endedAts as string[], NOW)).toBe(1);
  });

  it('빈 배열 → streak 0', () => {
    expect(calculateStreak([], NOW)).toBe(0);
  });

  it('하루에 여러 세션 → 중복 날짜는 1로 카운트', () => {
    const endedAts = [
      '2026-06-15T08:00:00',
      '2026-06-15T20:00:00', // 오늘 중복
      '2026-06-14T08:00:00', // 어제
    ];
    expect(calculateStreak(endedAts, NOW)).toBe(2);
  });
});
