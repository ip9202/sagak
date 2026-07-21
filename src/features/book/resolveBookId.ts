/**
 * resolveBookId — ISBN → books.id(UUID) 매핑 (SPEC-LIBRARY-001 TASK-002)
 *
 * 서재/진행률 플로우에서 ISBN 만 알고 있는 경우, user_books.book_id(FK→books.id) 가
 * 필요하므로 ISBN 으로 books.id 를 읽기 전용 조회한다.
 *
 * 제약:
 * - 읽기 전용 조회만 수행 (SELECT). books 행을 생성하지 않는다 — 생성은 SPEC-BOOK-001 책임.
 * - ISBN 이 미등록(0행)인 경우 NOT_FOUND AppError 로 명확히 알린다 (maybeSingle 사용).
 *
 * fan_in: 검색 결과 선택(search.tsx), 책 추가(addBook), 상세 진입(bookDetail) ≥ 3 예상.
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { AppError } from '../../errors';

// @MX:ANCHOR: [AUTO] ISBN→UUID 매핑 공개 API — 서재/검색/상세 진입의 공통 의존 (fan_in ≥ 3)
// @MX:REASON: search.tsx(검색 결과 선택), libraryApi.addBook(서재 등록), BookDetailScreen(상세 진입) 등 최소 3개 호출부가 의존하며, 잘못된 매핑은 서재 전체 데이터 무결성을 훼손한다.
// @MX:SPEC SPEC-LIBRARY-001
/**
 * ISBN 으로 books.id(UUID) 를 조회한다.
 *
 * PostgREST: books.select('id').eq('isbn', isbn).maybeSingle()
 * - 성공: books.id 문자열 반환
 * - 0행(미등록 ISBN): NOT_FOUND AppError throw
 * - RLS 거부(42501): RLS_DENIED AppError throw
 * - 네트워크 예외: NETWORK AppError throw (normalizeError 경유)
 *
 * @param isbn - 13자리 ISBN 문자열 (검증은 호출부 책임)
 * @returns books.id (UUID)
 * @throws {AppError} NOT_FOUND / RLS_DENIED / NETWORK 등 정규화된 에러
 */
export async function resolveBookId(isbn: string): Promise<string> {
  const client = getSupabaseClient();

  let result: { data: { id: string } | null; error: unknown };
  try {
    // @MX:NOTE: [AUTO] maybeSingle 사용 — ISBN 은 UNIQUE 이므로 0행 또는 1행만 가능. single() 은 0행에서 PGRST116 에러를 던지지만, maybeSingle 은 {data:null,error:null} 로 구분 가능하여 NOT_FOUND 와 RLS 를 명확히 분리할 수 있다.
    result = await client
      .from('books')
      .select('id')
      .eq('isbn', isbn)
      .maybeSingle();
  } catch (error) {
    // throw 된 예외도 정규화 (TypeError → NETWORK 등)
    throw normalizeError(error);
  }

  if (result.error) {
    // RLS(42501) / 네트워크 / 서버 등은 classifyError 가 분류
    throw normalizeError(result.error);
  }

  // error 가 null 인데 data 도 null 이면 미등록 ISBN → NOT_FOUND
  if (!result.data) {
    // @MX:NOTE: [AUTO] ISBN 미등록 — books 행이 없음. 생성은 SPEC-BOOK-001 책임이므로 여기서는 NOT_FOUND 로 알리기만 한다.
    const err = new AppError(
      `등록되지 않은 ISBN 입니다: ${isbn}`,
      'NOT_FOUND',
      404,
    );
    err.category = 'NOT_FOUND';
    throw err;
  }

  return result.data.id;
}
