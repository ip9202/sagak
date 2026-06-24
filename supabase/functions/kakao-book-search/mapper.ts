/**
 * Kakao 응답 → books 행 매핑 (REQ-BOOK-012, 시나리오 S15)
 *
 * NormalizedBook(authors 배열) → books upsert 행(author 단일 문자열) 변환.
 * 본 모듈은 Deno 글로벌에 의존하지 않는 순수 함수 모듈이다.
 *
 * @MX:NOTE: [AUTO] authors → author join 은 본 모듈에서만 일어난다.
 *           클라이언트는 books.author(단일 문자열)를 그대로 읽는다.
 */
import type { NormalizedBook } from './normalizer.ts';

/**
 * books 테이블 upsert 입력 행 (id/created_at 제외 — DB 가 기본값 사용).
 * 마이그레이션 20240614000002_create_books.sql 컬럼에 대응.
 */
export interface BookUpsertRow {
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  published_at: string | null;
  cover_url: string | null;
  total_pages: number | null;
  kakao_id: string | null;
}

/**
 * REQ-BOOK-012: NormalizedBook → books upsert 행 매핑.
 *
 * 핵심 변환 규칙 (시나리오 S15):
 * - authors(string[]) → author(string) — ', ' 로 결합
 * - published_at, cover_url, total_pages, kakao_id: null 그대로 전달
 * - isbn/title: 필수값 그대로
 *
 * @param book - 정규화된 도서 객체
 * @returns books 테이블 upsert 입력 행
 */
export function mapToBookRow(book: NormalizedBook): BookUpsertRow {
  return {
    isbn: book.isbn,
    title: book.title,
    // @MX:NOTE: [AUTO] authors 배열 → author 단일 문자열 join (books.author NOT NULL)
    author: book.authors.join(', '),
    publisher: book.publisher,
    published_at: book.published_at,
    cover_url: book.cover_url,
    total_pages: book.total_pages,
    kakao_id: book.kakao_id,
  };
}
