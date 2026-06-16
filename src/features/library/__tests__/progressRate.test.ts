/**
 * calcProgressRate 단위 테스트 (순수 함수)
 * SPEC-LIBRARY-001 — TASK-006 (진행률 백분율 계산)
 *
 * 검증 대상:
 * - calcProgressRate(120, 300) === 40
 * - calcProgressRate(0, 100) === 0
 * - calcProgressRate(50, null) === null (총페이지 미정의 시 계산 불가)
 * - calcProgressRate(null, 300) === null (현재 페이지 미정의)
 * - calcProgressRate(300, 300) === 100 (완독)
 */
import { calcProgressRate } from '../progressRate';

describe('SPEC-LIBRARY-001 TASK-006: calcProgressRate (진행률 백분율)', () => {
  it('현재 페이지 / 총페이지 * 100 의 정수 백분율을 반환한다', () => {
    expect(calcProgressRate(120, 300)).toBe(40);
  });

  it('현재 페이지 0 일 때 0 을 반환한다', () => {
    expect(calcProgressRate(0, 100)).toBe(0);
  });

  it('총페이지와 동일한 페이지일 때 100 을 반환한다 (완독)', () => {
    expect(calcProgressRate(300, 300)).toBe(100);
  });

  it('총페이지가 null 이면 null 을 반환한다 (계산 불가)', () => {
    expect(calcProgressRate(50, null)).toBeNull();
  });

  it('현재 페이지가 null 이면 null 을 반환한다', () => {
    expect(calcProgressRate(null, 300)).toBeNull();
  });

  it('소수점은 버림한다 (정수 백분율)', () => {
    // 100 / 300 = 33.33... → 33
    expect(calcProgressRate(100, 300)).toBe(33);
  });
});
