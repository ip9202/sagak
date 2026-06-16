/**
 * 바코드 디바운스 판정 순수 함수 (SPEC-BOOK-001 M3, REQ-BOOK-009 / S11)
 *
 * BarcodeScanner 의 동일 ISBN 중복 인식 방지 로직(lastIsbnRef + lastScannedAtRef,
 * DUPLICATE_DEBOUNCE_MS=2000) 을 순수 함수로 추출.
 *
 * 추출 배경: 컴포넌트 테스트에서 setScanning(false)(S10 카메라 중지) 로 인해
 * 디바운스 분기가 도달 불가 → REQ-BOOK-009 를 실질 검증하기 어려웠음.
 * 순수 함수 분리로 단위 테스트가 디바운스 계약을 직접 검증.
 *
 * @MX:ANCHOR: [AUTO] shouldSuppressDuplicate — BarcodeScanner 디바운스 계약
 * @MX:REASON: BarcodeScanner.handleBarcodeScanned 이 매 스캔마다 호출하며, 동일 ISBN 2초 내 억제 계약을 위반하면 API 중복 호출이 발생한다.
 */

/**
 * REQ-BOOK-009 / S11: 동일 ISBN 중복 인식 방지 디바운스 윈도우 (ms)
 * 2초 — 사용자가 같은 바코드를 연속 스캔해도 API 중복 호출 방지.
 */
export const DUPLICATE_DEBOUNCE_MS = 2000;

/**
 * 동일 ISBN 중복 인식 억제 여부를 판정한다 (순수 함수).
 *
 * 계약:
 * - prevIsbn === currIsbn 이고 (now - prevAt) < windowMs 인 경우 → true (억제)
 * - prevIsbn !== currIsbn 인 경우 → false (새 ISBN, 허용)
 * - prevIsbn 이 null 인 경우 → false (최초 인식, 허용)
 * - prevAt 이 0 인 경우(이전 기록 없음) → false (허용)
 * - 동일 ISBN 이라도 windowMs 경과 후 → false (재허용)
 *
 * @param prevIsbn - 이전에 인식된 ISBN (없으면 null)
 * @param currIsbn - 현재 인식된 ISBN
 * @param prevAt   - 이전 인식 시각(ms epoch, 없으면 0)
 * @param now      - 현재 시각(ms epoch)
 * @param windowMs - 디바운스 윈도우(기본 DUPLICATE_DEBOUNCE_MS=2000)
 * @returns true 면 현재 스캔을 억제(중복), false 면 허용(신규)
 */
export function shouldSuppressDuplicate(
  prevIsbn: string | null,
  currIsbn: string,
  prevAt: number,
  now: number,
  windowMs: number = DUPLICATE_DEBOUNCE_MS
): boolean {
  // 이전 기록이 없으면 항상 허용
  if (prevIsbn === null || prevAt === 0) return false;

  // 다른 ISBN 이면 억제하지 않음
  if (prevIsbn !== currIsbn) return false;

  // 동일 ISBN: 윈도우 내면 억제, 경과 후면 재허용
  return now - prevAt < windowMs;
}
