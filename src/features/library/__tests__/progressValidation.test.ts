/**
 * progressValidation 단위 테스트 (순수 함수)
 * SPEC-LIBRARY-001 — TASK-005 (진행률 페이지 검증 규칙)
 *
 * 검증 대상:
 * - 음수 페이지 → VALIDATION AppError
 * - total_pages 초과 → VALIDATION AppError
 * - total_pages=null 인 경우 ceiling 검증 생략 (null 허용)
 * - 정상 범위 → null 반환 (에러 없음)
 */
import { validatePage } from '../progressValidation';

describe('SPEC-LIBRARY-001 TASK-005: validatePage (순수 검증 함수)', () => {
  it('음수 페이지는 VALIDATION 에러를 반환한다', () => {
    const err = validatePage(-1, 100);
    expect(err).not.toBeNull();
    expect(err).toMatchObject({ name: 'AppError', category: 'VALIDATION' });
  });

  it('0 페이지는 정상으로 간주한다 (시작 전)', () => {
    expect(validatePage(0, 100)).toBeNull();
  });

  it('total_pages 초과 페이지는 VALIDATION 에러를 반환한다', () => {
    const err = validatePage(101, 100);
    expect(err).not.toBeNull();
    expect(err).toMatchObject({ name: 'AppError', category: 'VALIDATION' });
  });

  it('total_pages 와 동일한 페이지는 정상이다 (완독)', () => {
    expect(validatePage(100, 100)).toBeNull();
  });

  it('total_pages=null 인 경우 ceiling 검증을 생략한다 (미정의 총페이지)', () => {
    expect(validatePage(50, null)).toBeNull();
    expect(validatePage(9999, null)).toBeNull();
  });

  it('범위 내 페이지는 null 을 반환한다 (에러 없음)', () => {
    expect(validatePage(50, 100)).toBeNull();
  });
});
