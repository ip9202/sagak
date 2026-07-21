/**
 * ISBN 검증 단위 테스트 (SPEC-BOOK-001, REQ-BOOK-007, S8/S9/S12)
 */
import {
  isValidIsbn13,
  isValidIsbn10,
  isValidIsbn,
} from '../isbn';

describe('isValidIsbn13', () => {
  // REQ-BOOK-007: ISBN-13 유효값 (체크디지트 계산으로 생성)
  it('유효한 ISBN-13 을 통과시킨다 (9788966262335)', () => {
    expect(isValidIsbn13('9788966262335')).toBe(true);
  });

  it('유효한 ISBN-13 을 통과시킨다 (9788932917245)', () => {
    expect(isValidIsbn13('9788932917245')).toBe(true);
  });

  // 시나리오 S9 간접 지원: 체크디지트 오류값은 거부
  it('체크디지트가 틀린 13자리를 거부한다', () => {
    expect(isValidIsbn13('9788966262330')).toBe(false);
  });

  it('길이가 13이 아닌 값을 거부한다', () => {
    expect(isValidIsbn13('978896626233')).toBe(false);
    expect(isValidIsbn13('97889662623322')).toBe(false);
  });

  it('비숫자/하이픈 포함 값을 거부한다', () => {
    expect(isValidIsbn13('978-89-6626-233-2')).toBe(false);
    expect(isValidIsbn13('abcdefghijklm')).toBe(false);
  });

  it('빈 문자열을 거부한다', () => {
    expect(isValidIsbn13('')).toBe(false);
  });
});

describe('isValidIsbn10', () => {
  // S12: ISBN-10 레거시 호환 — 체크디지트 계산으로 생성
  it('유효한 ISBN-10 을 통과시킨다 (8966262333)', () => {
    expect(isValidIsbn10('8966262333')).toBe(true);
  });

  it('마지막 자리 X 인 ISBN-10 을 통과시킨다', () => {
    // 체크디지트 X (값 10) 가 나오는 ISBN-10 예시: 100000001X
    expect(isValidIsbn10('100000001X')).toBe(true);
  });

  it('체크디지트가 틀린 ISBN-10 을 거부한다', () => {
    expect(isValidIsbn10('8966262330')).toBe(false);
  });

  it('길이가 10이 아닌 값을 거부한다', () => {
    expect(isValidIsbn10('896626233')).toBe(false);
    expect(isValidIsbn10('89662623355')).toBe(false);
  });
});

describe('isValidIsbn', () => {
  // REQ-BOOK-007 통합 진입점
  it('ISBN-13 유효값을 통과시킨다', () => {
    expect(isValidIsbn('9788966262335')).toBe(true);
  });

  it('ISBN-10 유효값을 통과시킨다 (S12 호환)', () => {
    expect(isValidIsbn('8966262333')).toBe(true);
  });

  it('비-ISBN 값을 거부한다 (QR 데이터, 일반 문자열)', () => {
    expect(isValidIsbn('https://example.com')).toBe(false);
    expect(isValidIsbn('123456789012')).toBe(false); // 12자리 UPC-A 형태지만 ISBN 아님
    expect(isValidIsbn('NOT_AN_ISBN')).toBe(false);
  });
});
