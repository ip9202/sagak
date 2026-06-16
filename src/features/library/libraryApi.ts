/**
 * 서재 클라이언트 API (SPEC-LIBRARY-001)
 *
 * user_books 테이블에 대한 CRUD + 진행률/상태/공개여부 mutation 을 제공한다.
 * 모든 호출은 getSupabaseClient 를 경유하며, 에러는 normalizeError/classifyError 로
 * 정규화한다.
 *
 * 정책 (SPEC 미결정 5.1~5.4):
 * - 정렬: last_progress_at DESC (5.2)
 * - 삭제: 단일 항목만, 자식 데이터(emotion_records 등) 가 있으면 DB FK 가 차단 (5.3)
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { validatePage } from './progressValidation';
import type {
  AddBookInput,
  DeleteBookInput,
  LibraryFilter,
  LibraryItem,
  ProgressUpdate,
  StatusUpdate,
  UserBookRow,
  VisibilityUpdate,
} from './types';

// @MX:NOTE: [AUTO] 서재 조회 SELECT 컬럼 — user_books 전체 + books 조인(id,title,author,cover_url,total_pages). cover_url/total_pages 는 nullable.
const LIBRARY_SELECT = '*, books(id,title,author,cover_url,total_pages)';

/**
 * user_books 에 새 항목을 INSERT 한다.
 *
 * 기본 status: 'reading' (사용자가 서재에 추가하면 읽기 시작 상태로 간주).
 * UNIQUE(book_id, user_id) 위반(23505) → VALIDATION (이미 등록된 책).
 *
 * @returns 생성된 user_books 행
 */
export async function addBook(input: AddBookInput): Promise<UserBookRow> {
  const client = getSupabaseClient();
  let result: { data: UserBookRow | null; error: unknown };
  try {
    result = await client
      .from('user_books')
      .insert({
        book_id: input.bookId,
        user_id: input.userId,
        status: input.status ?? 'reading',
      })
      .select()
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('addBook failed'));
  }
  return result.data;
}

/**
 * 사용자의 서재 목록을 조회한다.
 *
 * - user_id 필수 필터 (RLS 보조)
 * - status 선택 필터 (reading/completed/shelved)
 * - books 조인으로 책 메타 포함
 * - last_progress_at DESC 정렬 (5.2)
 */
export async function getLibrary(filter: LibraryFilter): Promise<LibraryItem[]> {
  const client = getSupabaseClient();

  let query = client
    .from('user_books')
    .select(LIBRARY_SELECT)
    .eq('user_id', filter.userId);

  if (filter.status) {
    query = query.eq('status', filter.status);
  }

  let result: { data: LibraryItem[] | null; error: unknown };
  try {
    result = await query.order('last_progress_at', { ascending: false });
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? [];
}

/**
 * 단일 서재 항목을 book_id 로 조회한다 (상세 화면용).
 *
 * 사용자가 서재 탭을 거치지 않고 상세로 직접 진입하는 경로(search → /book/<id>)를
 * 지원하기 위해 user_books 를 book_id + user_id 로 단일 행 조회한다.
 * - 0행(서재 미등록 책): null 반환 (에러 아님 — UI 에서 "서재에 추가" CTA 표시)
 * - RLS/네트워크 에러: AppError throw
 *
 * @MX:NOTE: [AUTO] 단일 항목 조회 — BookDetailScreen(TASK-010) 진입 경로. null 은 미등록을 의미해 에러가 아님.
 * @MX:SPEC SPEC-LIBRARY-001
 */
export async function getLibraryItem(
  bookId: string,
  userId: string,
): Promise<LibraryItem | null> {
  const client = getSupabaseClient();

  let result: { data: LibraryItem | null; error: unknown };
  try {
    result = await client
      .from('user_books')
      .select(LIBRARY_SELECT)
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? null;
}

/**
 * 서재 항목을 DELETE 한다.
 *
 * id + user_id 복합 조건으로 RLS 보조 필터를 적용한다.
 * 자식 데이터(emotion_records, completion_reports 등) 가 있으면 FK 제약이 차단한다 (5.3).
 */
export async function deleteBook(input: DeleteBookInput): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('user_books')
      .delete()
      .eq('id', input.id)
      .eq('user_id', input.userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 서재 항목의 current_page 를 UPDATE 한다.
 *
 * 제약 (AC-TRIG-001):
 * - payload 는 { current_page } 만 포함한다. last_progress_at 은 DB 트리거가 관리.
 * - 업데이트 전 validatePage 로 음수/초과를 선검증한다 (totalPages 옵션 전달 시).
 *
 * @param input.id - user_books.id
 * @param input.userId - RLS 보조 필터
 * @param input.currentPage - 새 현재 페이지
 * @param input.totalPages - 선택: ceiling 검증용 총페이지 (null 시 생략)
 */
export async function updateProgress(
  input: ProgressUpdate & { totalPages?: number | null },
): Promise<void> {
  // 검증: 음수/초과 사전 차단
  const validationError = validatePage(input.currentPage, input.totalPages ?? null);
  if (validationError) {
    throw validationError;
  }

  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    // @MX:NOTE: [AUTO] current_page 만 전달 — last_progress_at 은 DB 트리거가 갱신 (AC-TRIG-001). payload 에 포함하면 트리거와 충돌한다.
    result = await client
      .from('user_books')
      .update({ current_page: input.currentPage })
      .eq('id', input.id)
      .eq('user_id', input.userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 서재 항목의 status 를 UPDATE 한다 (reading/completed/shelved).
 */
export async function updateStatus(input: StatusUpdate): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('user_books')
      .update({ status: input.status })
      .eq('id', input.id)
      .eq('user_id', input.userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 서재 항목의 is_public(공개 여부) 을 UPDATE 한다.
 */
export async function updateVisibility(input: VisibilityUpdate): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('user_books')
      .update({ is_public: input.isPublic })
      .eq('id', input.id)
      .eq('user_id', input.userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}
