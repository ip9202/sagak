/**
 * mapper 단위 테스트 (REQ-BOOK-012, 시나리오 S15)
 *
 * Kakao document / NormalizedBook → books upsert 행 변환 검증.
 * authors 배열 → author 단일 문자열(', ' join), datetime → date 매핑을 검증.
 */
import { mapToBookRow } from '../mapper';
import type { NormalizedBook } from '../normalizer';

describe('mapToBookRow (REQ-BOOK-012, 시나리오 S15)', () => {
  it('NormalizedBook 을 books upsert 행으로 매핑한다', () => {
    const book: NormalizedBook = {
      title: '호모 데우스',
      authors: ['유발 하라리'],
      publisher: '김영사',
      published_at: '2017-01-20',
      cover_url: 'https://example.com/cover.jpg',
      isbn: '9791186565873',
      kakao_id: null,
      total_pages: null,
    };

    const row = mapToBookRow(book);

    expect(row).toMatchObject({
      isbn: '9791186565873',
      title: '호모 데우스',
      author: '유발 하라리',
      publisher: '김영사',
      published_at: '2017-01-20',
      cover_url: 'https://example.com/cover.jpg',
      total_pages: null,
      kakao_id: null,
    });
  });

  it('authors 가 여러 명이면 ", " 로 join 한다 (시나리오 S15 핵심)', () => {
    const book: NormalizedBook = {
      title: '공저 도서',
      authors: ['저자1', '저자2', '저자3'],
      publisher: null,
      published_at: null,
      cover_url: null,
      isbn: '111',
      kakao_id: null,
      total_pages: null,
    };

    const row = mapToBookRow(book);

    // @MX:NOTE: [AUTO] authors 배열 → author 단일 문자열 join — books.author 컬럼 계약
    expect(row.author).toBe('저자1, 저자2, 저자3');
  });

  it('NOT NULL 컬럼(title, author, isbn)은 항상 채워진다', () => {
    const book: NormalizedBook = {
      title: '제목',
      authors: ['저자'],
      publisher: null,
      published_at: null,
      cover_url: null,
      isbn: '9791186565873',
      kakao_id: null,
      total_pages: null,
    };

    const row = mapToBookRow(book);

    expect(row.title).toBe('제목');
    expect(row.author).toBe('저자');
    expect(row.isbn).toBe('9791186565873');
  });

  it('nullable 필드는 null 그대로 매핑된다', () => {
    const book: NormalizedBook = {
      title: '제목',
      authors: ['저자'],
      publisher: null,
      published_at: null,
      cover_url: null,
      isbn: '1',
      kakao_id: null,
      total_pages: null,
    };

    const row = mapToBookRow(book);

    expect(row.publisher).toBeNull();
    expect(row.published_at).toBeNull();
    expect(row.cover_url).toBeNull();
    expect(row.total_pages).toBeNull();
    expect(row.kakao_id).toBeNull();
  });
});
