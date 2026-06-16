/**
 * Book 도메인 barrel (SPEC-BOOK-001)
 *
 * 클라이언트 API(searchBooks, getBookDetail) 공개 진입점.
 */
export { searchBooks } from './searchApi';
export { getBookDetail } from './bookDetailApi';
export type { BookRow, SearchResult, SearchTarget } from '../../types/book';
