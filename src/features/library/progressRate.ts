/**
 * 진행률 백분율 계산 (순수 함수) — SPEC-LIBRARY-001 TASK-006
 *
 * 현재 페이지와 총 페이지 수로 읽기 진행률(0~100 정수 백분율)을 계산한다.
 * - 둘 중 하나라도 null 이면 null 반환 (계산 불가)
 * - 소수점은 버림 (Math.floor)
 * - 0~100 범위 보장 (완독 시 100)
 */

// @MX:NOTE: [AUTO] 진행률 계산 — currentPage/totalPages 가 null 이면 미정의 상태로 간주해 null 반환. UI 에서 분기 처리한다.
// @MX:SPEC SPEC-LIBRARY-001
/**
 * 진행률 백분율을 계산한다.
 *
 * @param currentPage - 현재 읽은 페이지 (null 시 미정의)
 * @param totalPages - 책의 총 페이지 수 (null 시 미정의)
 * @returns 0~100 정수 백분율, 또는 null (둘 중 하나라도 null)
 */
export function calcProgressRate(
  currentPage: number | null,
  totalPages: number | null,
): number | null {
  // 둘 중 하나라도 null 이면 계산 불가
  if (currentPage === null || totalPages === null) {
    return null;
  }

  // totalPages 가 0 인 경우 0 반환 (0으로 나누기 방지)
  if (totalPages === 0) {
    return 0;
  }

  const rate = (currentPage / totalPages) * 100;
  // 소수점 버림, 0~100 범위 보장
  return Math.max(0, Math.min(100, Math.floor(rate)));
}
