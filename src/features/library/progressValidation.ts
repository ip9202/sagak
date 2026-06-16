/**
 * 진행률 페이지 검증 (순수 함수) — SPEC-LIBRARY-001 TASK-005
 *
 * updateProgress 호출 전 current_page 의 유효성을 검증한다.
 * - 음수: 허용 안 함 (VALIDATION)
 * - total_pages 초과: 허용 안 함 (VALIDATION)
 * - total_pages=null: 총페이지 미정의 — ceiling 검증 생략 (허용)
 *
 * 반환값: null 이면 유효, AppError 이면 유효하지 않음.
 */
import { AppError } from '../../errors';

// @MX:NOTE: [AUTO] 페이지 검증 규칙 — 음수 금지, total_pages 초과 금지(단, total_pages=null 은 ceiling 미적용). DB CHECK 제약이 없으므로 앱 단에서 선검증한다.
// @MX:SPEC SPEC-LIBRARY-001
/**
 * current_page 가 유효한지 검증한다.
 *
 * @param currentPage - 업데이트할 현재 페이지 (0 이상 정수)
 * @param totalPages - 책의 총 페이지 수 (null 이면 ceiling 검증 생략)
 * @returns 유효하면 null, 아니면 VALIDATION AppError
 */
export function validatePage(
  currentPage: number,
  totalPages: number | null,
): AppError | null {
  // 1. 음수 검증
  if (currentPage < 0) {
    const err = new AppError(
      `현재 페이지는 0 이상이어야 합니다: ${currentPage}`,
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    return err;
  }

  // 2. total_pages 초과 검증 (total_pages 가 null 이면 생략)
  if (totalPages !== null && currentPage > totalPages) {
    const err = new AppError(
      `현재 페이지(${currentPage})가 총 페이지(${totalPages})를 초과합니다`,
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    return err;
  }

  return null;
}
