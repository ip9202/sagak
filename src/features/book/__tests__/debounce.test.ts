/**
 * shouldSuppressDuplicate 단위 테스트 (SPEC-BOOK-001, REQ-BOOK-009 / S11)
 *
 * 검증 대상(디바운스 계약):
 * - 동일 ISBN 2초 내 재스캔 → true (억제)
 * - 동일 ISBN 2초 경과 후 → false (재허용)
 * - 다른 ISBN → false (항상 허용)
 * - 최초 인식(prevIsbn=null) → false
 * - prevAt=0(이전 기록 없음) → false
 * - 윈도우 경계값(정확히 2000ms) → false (미만일 때만 억제)
 *
 * 컴포넌트 테스트(BarcodeScanner.test.tsx S11) 한계 보완:
 * 컴포넌트는 setScanning(false)(S10) 로 인해 디바운스 분기 도달이 불가하므로,
 * 본 단위 테스트가 REQ-BOOK-009 를 실질 검증한다.
 */
import {
  shouldSuppressDuplicate,
  DUPLICATE_DEBOUNCE_MS,
} from '../debounce';

describe('shouldSuppressDuplicate — REQ-BOOK-009 / S11: 동일 ISBN 디바운스', () => {
  const ISBN_A = '9788966262335';
  const ISBN_B = '9788932917245';

  describe('최초 인식 (이전 기록 없음)', () => {
    it('prevIsbn=null 인 경우 false (허용)', () => {
      expect(shouldSuppressDuplicate(null, ISBN_A, 0, 1000)).toBe(false);
    });

    it('prevAt=0 인 경우 false (이전 시각 없음 → 허용)', () => {
      // prevIsbn 이 있더라도 prevAt=0 이면 이전 기록이 없는 것으로 간주
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_A, 0, 1000)).toBe(false);
    });
  });

  describe('동일 ISBN 2초 내 재스캔 (억제)', () => {
    it('동일 ISBN, 1ms 후 → true (억제)', () => {
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1001)).toBe(true);
    });

    it('동일 ISBN, 500ms 후 → true (억제)', () => {
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1500)).toBe(true);
    });

    it('동일 ISBN, 1999ms 후 → true (억제, 윈도우 직전)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1000 + 1999)
      ).toBe(true);
    });
  });

  describe('동일 ISBN 2초 경과 후 (재허용)', () => {
    it('동일 ISBN, 정확히 2000ms 후 → false (재허용, 경계값)', () => {
      // now - prevAt < windowMs 이므로 2000ms 는 억제 아님(미만이 아님)
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1000 + DUPLICATE_DEBOUNCE_MS)
      ).toBe(false);
    });

    it('동일 ISBN, 2001ms 후 → false (재허용)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1000 + 2001)
      ).toBe(false);
    });

    it('동일 ISBN, 5000ms 후 → false (재허용)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1000 + 5000)
      ).toBe(false);
    });
  });

  describe('다른 ISBN (항상 허용)', () => {
    it('prevIsbn !== currIsbn, 1ms 후 → false (새 ISBN 허용)', () => {
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_B, 1000, 1001)).toBe(false);
    });

    it('prevIsbn !== currIsbn, 100ms 후 → false (새 ISBN 허용)', () => {
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_B, 1000, 1100)).toBe(false);
    });

    it('prevIsbn !== currIsbn, 5000ms 후 → false (새 ISBN 허용)', () => {
      expect(shouldSuppressDuplicate(ISBN_A, ISBN_B, 1000, 6000)).toBe(false);
    });
  });

  describe('커스텀 윈도우 (windowMs 파라미터)', () => {
    it('windowMs=500 인 경우, 동일 ISBN 499ms 후 → true (억제)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1499, 500)
      ).toBe(true);
    });

    it('windowMs=500 인 경우, 동일 ISBN 500ms 후 → false (재허용, 경계)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1500, 500)
      ).toBe(false);
    });

    it('windowMs=500 인 경우, 동일 ISBN 501ms 후 → false (재허용)', () => {
      expect(
        shouldSuppressDuplicate(ISBN_A, ISBN_A, 1000, 1501, 500)
      ).toBe(false);
    });
  });

  describe('DUPLICATE_DEBOUNCE_MS 상수', () => {
    it('기본값은 2000ms 이다', () => {
      expect(DUPLICATE_DEBOUNCE_MS).toBe(2000);
    });
  });
});
