/**
 * Book 도메인 barrel (SPEC-BOOK-001 / SPEC-LIBRARY-001)
 *
 * 클라이언트 API(searchBooks, getBookDetail, resolveBookId) 공개 진입점.
 * BarcodeScanner 컴포넌트(M3) 및 ISBN 검증 모듈 노출.
 * resolveBookId (ISBN→UUID 매핑) 는 SPEC-LIBRARY-001 TASK-002 에서 추가.
 */
export { searchBooks } from './searchApi';
export { getBookDetail } from './bookDetailApi';
export { resolveBookId } from './resolveBookId';
export { BarcodeScanner } from './BarcodeScanner';
export type { BarcodeScannerProps } from './BarcodeScanner';
export { isValidIsbn, isValidIsbn13, isValidIsbn10 } from './isbn';
export type { BookRow, SearchResult, SearchTarget } from '../../types/book';
