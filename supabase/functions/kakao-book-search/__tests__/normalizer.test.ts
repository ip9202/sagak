/**
 * normalizer 단위 테스트 (REQ-BOOK-003, 시나리오 S3)
 *
 * Kakao documents[] → SearchResult[] 변환을 검증한다.
 * Deno 글로벌에 의존하지 않는 순수 함수이므로 jest 로 테스트한다.
 */
import { normalizeKakaoDocuments, type KakaoDocument } from '../normalizer';

describe('normalizeKakaoDocuments (REQ-BOOK-003, 시나리오 S3)', () => {
  it('유효한 documents 를 SearchResult[] 로 정규화한다', () => {
    const documents: KakaoDocument[] = [
      {
        title: '호모 데우스',
        authors: ['유발 하라리'],
        contents: '내용...',
        url: 'https://...',
        isbn: '9791186565873 8932917245',
        datetime: '2017-01-20T00:00:00.000+09:00',
        publishers: ['김영사'],
        price: 0,
        sale_price: 0,
        thumbnail: 'https://example.com/cover.jpg',
        status: '정상판매',
        translators: [],
      },
    ];

    const result = normalizeKakaoDocuments(documents);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: '호모 데우스',
      authors: ['유발 하라리'],
      publisher: '김영사',
      cover_url: 'https://example.com/cover.jpg',
      isbn: '9791186565873',
      total_pages: null,
    });
    // @MX:NOTE: [AUTO] datetime(ISO datetime) → published_at(ISO date YYYY-MM-DD) 변환
    expect(result[0].published_at).toBe('2017-01-20');
  });

  it('isbn 이 공백 구분(여러 값)인 경우 첫 값을 사용한다', () => {
    const documents: KakaoDocument[] = [
      {
        title: '제목',
        authors: ['저자'],
        isbn: '9791186565873 8932917245',
      } as KakaoDocument,
    ];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].isbn).toBe('9791186565873');
  });

  it('title 이 없는 도서는 제외된다 (필수 필드)', () => {
    const documents = [
      { authors: ['저자'], isbn: '9791186565873' },
      { title: '유효', authors: ['저자'], isbn: '111' },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('유효');
  });

  it('authors 가 빈 배열이거나 없는 도서는 제외된다', () => {
    const documents = [
      { title: 'A', isbn: '1' }, // authors 없음
      { title: 'B', authors: [], isbn: '2' }, // 빈 배열
      { title: 'C', authors: ['저자'], isbn: '3' }, // 유효
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('C');
  });

  it('isbn 이 없는 도서는 제외된다', () => {
    const documents = [
      { title: 'A', authors: ['저자'] }, // isbn 없음
      { title: 'B', authors: ['저자'], isbn: '' }, // 빈 문자열
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result).toHaveLength(0);
  });

  it('빈 documents 배열은 빈 배열을 반환한다 (빈 결과 허용, REQ-BOOK-016)', () => {
    const result = normalizeKakaoDocuments([]);
    expect(result).toEqual([]);
  });

  it('publishers 배열이 비어 있으면 publisher 는 null 이다', () => {
    const documents = [
      { title: 'A', authors: ['저자'], isbn: '1', publishers: [] },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].publisher).toBeNull();
  });

  it('publishers 가 여러 값이면 첫 값을 사용한다', () => {
    const documents = [
      {
        title: 'A',
        authors: ['저자'],
        isbn: '1',
        publishers: ['출판사1', '출판사2'],
      },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].publisher).toBe('출판사1');
  });

  it('thumbnail 이 없으면 cover_url 은 null 이다', () => {
    const documents = [
      { title: 'A', authors: ['저자'], isbn: '1' },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].cover_url).toBeNull();
  });

  it('datetime 이 없으면 published_at 은 null 이다', () => {
    const documents = [
      { title: 'A', authors: ['저자'], isbn: '1' },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].published_at).toBeNull();
  });

  it('kakao_id 는 없으면 null 이다', () => {
    const documents = [
      { title: 'A', authors: ['저자'], isbn: '1' },
    ] as unknown as KakaoDocument[];

    const result = normalizeKakaoDocuments(documents);

    expect(result[0].kakao_id).toBeNull();
  });
});
