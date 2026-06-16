/**
 * formatPublishedMonth 단위 테스트 (SPEC-BOOK-001, REQ-BOOK-014/REQ-BOOK-015)
 *
 * 검증 대상:
 * - null/빈 문자열 → null
 * - 길이 7 미만 → null
 * - 유효 ISO(YYYY-MM-DD) → "YYYY.MM"
 * - 월 경계값 (YYYY-MM-01, YYYY-MM-31)
 * - 날짜 구분자가 없는 변형 케이스(방어)
 */
import { formatPublishedMonth } from '../format';

describe('formatPublishedMonth — REQ-BOOK-014/015: 출판일 ISO → "YYYY.MM"', () => {
  describe('null/falsy 입력 방어', () => {
    it('null 입력 시 null 을 반환한다', () => {
      expect(formatPublishedMonth(null)).toBeNull();
    });

    it('빈 문자열 입력 시 null 을 반환한다', () => {
      expect(formatPublishedMonth('')).toBeNull();
    });
  });

  describe('길이 7 미만 입력 방어', () => {
    it('길이 6 입력("2021-0") 시 null 을 반환한다', () => {
      expect(formatPublishedMonth('2021-0')).toBeNull();
    });

    it('길이 3 입력("abc") 시 null 을 반환한다', () => {
      expect(formatPublishedMonth('abc')).toBeNull();
    });
  });

  describe('유효 ISO 포맷 변환', () => {
    it('유효 ISO "2021-06-15" → "2021.06"', () => {
      expect(formatPublishedMonth('2021-06-15')).toBe('2021.06');
    });

    it('월 경계값 1일 "2021-01-01" → "2021.01"', () => {
      expect(formatPublishedMonth('2021-01-01')).toBe('2021.01');
    });

    it('월 경계값 12월 "2021-12-31" → "2021.12"', () => {
      expect(formatPublishedMonth('2021-12-31')).toBe('2021.12');
    });

    it('연도 자릿수가 다른 "2020-03-08" → "2020.03"', () => {
      expect(formatPublishedMonth('2020-03-08')).toBe('2020.03');
    });

    it('정확히 길이 7 인 입력 "2021-06" → "2021.06" (길이 7 임계값 통과)', () => {
      expect(formatPublishedMonth('2021-06')).toBe('2021.06');
    });
  });

  describe('날짜 구분자 변형 케이스 (방어적 검증)', () => {
    it('슬래시 구분자 "2021/06/15" → 앞 7자리 취해 "2021/06" (replace 는 하이픈만 치환)', () => {
      // 구현은 slice(0,7) + replace('-', '.') — 슬래시는 치환되지 않으므로 그대로 잔존.
      // 이는 기존 동작이며 Kakao API 는 항상 YYYY-MM-DD 를 반환하므로 실경로 영향 없음.
      expect(formatPublishedMonth('2021/06/15')).toBe('2021/06');
    });

    it('T 포함 ISO8601 "2021-06-15T10:30:00" → 앞 7자리 "2021.06"', () => {
      expect(formatPublishedMonth('2021-06-15T10:30:00')).toBe('2021.06');
    });
  });
});
