/**
 * 책 상세 조회 클라이언트 API (REQ-BOOK-013, REQ-BOOK-015)
 *
 * PostgREST 직접 조회로 books 테이블에서 단일 행을 읽는다 (Edge Function 경유 X).
 * SPEC-API-001 classifyError 로 PGRST116 → NOT_FOUND, 42501 → RLS_DENIED 분류.
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { BookRow } from '../../types/book';

// @MX:ANCHOR: [AUTO] 책 상세 조회 공개 API — BookDetailScreen 및 검색 결과 선택 시 호출
// @MX:REASON: BookDetailScreen(M4), 검색 결과 선택(REQ-BOOK-014), 서재 플로우(SPEC-LIBRARY-001) 등 fan_in >= 3 예상 호출부가 의존.
/**
 * REQ-BOOK-015: bookId 로 books 상세 행을 조회한다 (시나리오 S19).
 *
 * supabase.from('books').select('*').eq('id', bookId).single() 실행.
 * - 성공: BookRow 반환
 * - PGRST116(0행): NOT_FOUND AppError (시나리오 S20)
 * - 42501(RLS 거부): RLS_DENIED AppError (시나리오 S22)
 *
 * @param bookId - books.id (UUID)
 * @returns books 행
 * @throws {AppError} NOT_FOUND / RLS_DENIED / NETWORK 등 정규화된 에러
 */
export async function getBookDetail(bookId: string): Promise<BookRow> {
  const client = getSupabaseClient();

  let result: { data: BookRow | null; error: unknown };
  try {
    // @MX:NOTE: [AUTO] PostgREST 직접 조회 — Edge Function 경유 없이 RLS 통과 (REQ-BOOK-013)
    result = await client
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();
  } catch (error) {
    // throw 된 에러도 normalizeError 로 정규화
    throw normalizeError(error);
  }

  // { data, error } 형태로 반환된 에러 처리 (PGRST116, 42501 등)
  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('Book not found'));
  }

  return result.data;
}
