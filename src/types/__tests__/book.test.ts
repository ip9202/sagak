/**
 * Book 도메인 타입 테스트 (REQ-BOOK-003, REQ-BOOK-012, REQ-BOOK-015)
 *
 * 인수 시나리오 S3 (정규화 스키마), S15 (books 컬럼 매핑), S16/S19 (BookRow SELECT).
 * 컴파일 타임 타입 계약 + 런타임 타입 가드를 검증한다.
 */
import {
  isSearchResult,
  isBookRow,
  isSearchTarget,
  type BookRow,
  type SearchResult,
  type SearchTarget,
} from '../book';

describe('Book 도메인 타입 (REQ-BOOK-003/012/015)', () => {
  describe('SearchResult (정규화 스키마, 시나리오 S3)', () => {
    it('컴파일 타임: 필수 필드 title/authors/isbn 을 갖는다', () => {
      const result: SearchResult = {
        title: '호모 데우스',
        authors: ['유발 하라리'],
        publisher: '김영사',
        published_at: '2024-01-15',
        cover_url: 'https://example.com/cover.jpg',
        isbn: '9791186565873',
        kakao_id: '12345',
        total_pages: 480,
      };
      expect(result.title).toBe('호모 데우스');
      // @MX:NOTE: [AUTO] authors 는 배열을 유지한다 (클라이언트 계약)
      expect(Array.isArray(result.authors)).toBe(true);
    });

    it('nullable 필드는 null 을 허용한다', () => {
      const result: SearchResult = {
        title: '제목',
        authors: ['저자'],
        publisher: null,
        published_at: null,
        cover_url: null,
        isbn: '9791186565873',
        kakao_id: null,
        total_pages: null,
      };
      expect(result.publisher).toBeNull();
      expect(result.total_pages).toBeNull();
    });
  });

  describe('BookRow (books SELECT, 시나리오 S15/S19)', () => {
    it('books 마이그레이션 컬럼과 정확히 매핑된다', () => {
      const row: BookRow = {
        id: 'uuid-1',
        isbn: '9791186565873',
        title: '호모 데우스',
        author: '유발 하라리',
        publisher: '김영사',
        published_at: '2024-01-15',
        cover_url: 'https://example.com/cover.jpg',
        total_pages: 480,
        kakao_id: '12345',
        created_at: '2024-06-14T00:00:00Z',
      };
      // @MX:NOTE: [AUTO] author 는 단일 문자열(join 된 값) — books 컬럼과 일치
      expect(typeof row.author).toBe('string');
      expect(row.id).toBeDefined();
    });
  });

  describe('SearchTarget (REQ-BOOK-015)', () => {
    it('"title" | "author" | "isbn" 리터럴 유니온이다', () => {
      const title: SearchTarget = 'title';
      const author: SearchTarget = 'author';
      const isbn: SearchTarget = 'isbn';
      expect([title, author, isbn]).toEqual(['title', 'author', 'isbn']);
    });
  });

  describe('타입 가드: isSearchResult', () => {
    it('필수 필드가 모두 있으면 true 를 반환한다', () => {
      expect(
        isSearchResult({
          title: '호모 데우스',
          authors: ['유발 하라리'],
          publisher: null,
          published_at: null,
          cover_url: null,
          isbn: '9791186565873',
          kakao_id: null,
          total_pages: null,
        })
      ).toBe(true);
    });

    it('title 이 누락되면 false 를 반환한다', () => {
      expect(
        isSearchResult({
          authors: ['저자'],
          isbn: '9791186565873',
        })
      ).toBe(false);
    });

    it('authors 가 배열이 아니면 false 를 반환한다', () => {
      expect(
        isSearchResult({
          title: '제목',
          authors: '문자열',
          isbn: '9791186565873',
        })
      ).toBe(false);
    });

    it('isbn 이 누락되면 false 를 반환한다', () => {
      expect(
        isSearchResult({
          title: '제목',
          authors: ['저자'],
        })
      ).toBe(false);
    });
  });

  describe('타입 가드: isBookRow', () => {
    it('books 행 전체 필드가 있으면 true 를 반환한다', () => {
      expect(
        isBookRow({
          id: 'uuid-1',
          isbn: '9791186565873',
          title: '호모 데우스',
          author: '유발 하라리',
          publisher: '김영사',
          published_at: '2024-01-15',
          cover_url: 'https://example.com/cover.jpg',
          total_pages: 480,
          kakao_id: '12345',
          created_at: '2024-06-14T00:00:00Z',
        })
      ).toBe(true);
    });

    it('id 가 누락되면 false 를 반환한다', () => {
      expect(
        isBookRow({
          isbn: '9791186565873',
          title: '제목',
          author: '저자',
        })
      ).toBe(false);
    });
  });

  describe('타입 가드: isSearchTarget', () => {
    it('유효한 리터럴이면 true', () => {
      expect(isSearchTarget('title')).toBe(true);
      expect(isSearchTarget('author')).toBe(true);
      expect(isSearchTarget('isbn')).toBe(true);
    });

    it('잘못된 값이면 false', () => {
      expect(isSearchTarget('publisher')).toBe(false);
      expect(isSearchTarget('')).toBe(false);
      expect(isSearchTarget(123)).toBe(false);
    });
  });
});
