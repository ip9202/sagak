/**
 * ISBN 검증 모듈 (SPEC-BOOK-001, REQ-BOOK-007, 시나리오 S8/S9/S12)
 *
 * 바코드 스캔 결과(data)가 유효한 ISBN 인지 검증하는 순수 함수.
 * - ISBN-13: 13자리 숫자, 체크디지트 검증 (REQ-BOOK-007 본류)
 * - ISBN-10: 10자리, 마지막 자리 'X' 허용, 가중합 체크디지트 (S12 레거시 호환)
 *
 * 바코드 타입(EAN-13/UPC-A) 과 관계없이 data 자체의 ISBN 여부를 판별한다.
 * 비-ISBN(QR/Code128) 은 호출부에서 타입으로 1차 필터링 후 본 함수로 검증한다.
 */

/**
 * ISBN-13 체크디지트 검증 (REQ-BOOK-007)
 *
 * 알고리즘: 홀수 자리 ×1 + 짝수 자리 ×3 합산 후 10의 배수여야 유효.
 * @param isbn - 13자리 숫자 문자열
 * @returns 체크디지트 통과 여부
 */
export function isValidIsbn13(isbn: string): boolean {
  // @MX:NOTE: [AUTO] ISBN-13 — 정확히 13자리 숫자만 허용 (하이픈/공백 포함 시 false)
  if (!/^\d{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = Number(isbn[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return sum % 10 === 0;
}

/**
 * ISBN-10 체크디지트 검증 (시나리오 S12, 레거시 호환)
 *
 * 알고리즘: 각 자리 ×(10..1) 가중합이 11의 배수여야 유효.
 * 마지막 자리는 'X' (값 10) 허용.
 * @param isbn - 10자리 문자열 (마지막 자리 'X' 허용)
 * @returns 체크디지트 통과 여부
 */
export function isValidIsbn10(isbn: string): boolean {
  // @MX:NOTE: [AUTO] ISBN-10 — 앞 9자리 숫자 + 마지막 자리 숫자 또는 'X'
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = isbn[i];
    const digit = ch === 'X' ? 10 : Number(ch);
    sum += digit * (10 - i);
  }
  return sum % 11 === 0;
}

/**
 * ISBN-13 또는 ISBN-10 여부 통합 검증 (REQ-BOOK-007)
 *
 * BarcodeScanner 의 onBarcodeScanned 에서 사용. EAN-13/UPC-A 타입 필터링 이후
 * data 가 실제 ISBN 인지 확인한다.
 * @param value - 바코드 데이터 문자열
 * @returns ISBN-13 또는 ISBN-10 유효 여부
 */
export function isValidIsbn(value: string): boolean {
  return isValidIsbn13(value) || isValidIsbn10(value);
}
