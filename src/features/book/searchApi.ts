/**
 * 도서 검색 클라이언트 API (REQ-BOOK-001, REQ-BOOK-005)
 *
 * SPEC-API-001 invokeEdgeFunction 을 재사용해 Edge Function(kakao-book-search) 호출.
 * 빈/공백 쿼리는 Edge Function 호출 전에 차단한다 (REQ-BOOK-005, 시나리오 S5).
 */
import { invokeEdgeFunction } from '../../lib/api/edgeFunctions';
import { AppError } from '../../errors';
import type { ErrorCategory } from '../../errors';
import type { SearchResult, SearchTarget } from '../../types/book';

/**
 * Edge Function 응답 계약: { data: SearchResult[] }.
 * 에러는 { error, code } 형태이나 invokeEdgeFunction 이 AppError 로 정규화해 throw 한다.
 */
interface SearchResponse {
  data: SearchResult[];
}

// @MX:ANCHOR: [AUTO] 도서 검색 공개 API — UI(M3/M4) 및 바코드 스캔(M3) 호출부
// @MX:REASON: BookSearchScreen, BarcodeScanner, BookDetailScreen 등 fan_in >= 3 예상 호출부가 의존하며, 빈 쿼리 차단/응답 계약을 위반하면 전체 검색 플로우가 고장난다.
/**
 * REQ-BOOK-001: 도서 검색 API.
 *
 * 빈/공백 쿼리인 경우 Edge Function 을 호출하지 않고 AppError(VALIDATION) 를 throw 한다.
 * 그 외에는 invokeEdgeFunction 으로 kakao-book-search Edge Function 을 호출한다.
 *
 * @param query - 검색어 (빈/공백 불가)
 * @param target - 검색 타겟(title/author/isbn)
 * @returns 검색 결과 배열 (빈 결과 허용, REQ-BOOK-016)
 * @throws {AppError} 빈 쿼리(VALIDATION) 또는 Edge Function 에러
 */
export async function searchBooks(
  query: string,
  target: SearchTarget = 'title'
): Promise<SearchResult[]> {
  // REQ-BOOK-005: 빈/공백 쿼리 차단 — Edge Function 호출 전 검증
  if (!query || query.trim().length === 0) {
    // @MX:NOTE: [AUTO] 검색어를 입력해 주세요 — Edge Function 호출 생략 (시나리오 S5)
    const err = new AppError('검색어를 입력해 주세요', 'VALIDATION_ERROR', 400);
    err.category = 'VALIDATION' as ErrorCategory;
    throw err;
  }

  const response = await invokeEdgeFunction<SearchResponse>('kakao-book-search', {
    query: query.trim(),
    target,
  });

  // 빈 결과 허용 (REQ-BOOK-016, 시나리오 S21)
  return response?.data ?? [];
}
