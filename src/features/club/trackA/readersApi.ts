/**
 * SPEC-CLUB-001 Track A 독자 목록 API (T-002, T-003)
 *
 * - fetchActiveReaders: user_books_public 보안 뷰 소비 (REQ-CLUBA-001/002)
 * - resolveClubIdsForUsers: club_members JOIN으로 user_id → club_id 매핑 (REQ-CLUBA-003)
 *
 * 정책 (사용자 승인 Decision Points):
 * - 정렬: started_reading_at DESC, nullsFirst: false (결정 5.3)
 * - RLS 신뢰: 클라이언트 권한 검사 없음. 에러는 normalizeError로 정규화.
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import type { UserBooksPublicRow } from './types';

// @MX:NOTE: [AUTO] user_books_public 뷰는 제한 컬럼만 노출 (REQ-DB-013e). 베이스 테이블 직조회 금지.
const READERS_SELECT = 'user_id, book_id, current_page, started_reading_at';

/**
 * 특정 책의 공개 독자 목록을 user_books_public 뷰에서 조회한다.
 *
 * - book_id 필수 필터
 * - started_reading_at DESC 정렬 (최근 시작 우선)
 * - 제한 컬럼만 SELECT (보안 뷰 노출 컬럼 준수)
 *
 * @returns 공개 독자 Row 배열 (빈 결과 가능)
 * @throws AppError RLS/네트워크 에러 시
 */
export async function fetchActiveReaders(
  bookId: string,
): Promise<UserBooksPublicRow[]> {
  const client = getSupabaseClient();

  let result: { data: UserBooksPublicRow[] | null; error: unknown };
  try {
    result = await client
      .from('user_books_public')
      .select(READERS_SELECT)
      .eq('book_id', bookId)
      .order('started_reading_at', { ascending: false, nullsFirst: false });
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? [];
}

/** club_members JOIN(clubs) 결과 행 형태. club_id 는 중첩 객체로 평탄화된다. */
interface ClubMemberClubRow {
  user_id: string;
  club_id: { id: string };
}

/**
 * 주어진 user_id 배열에 대해 각 독자가 속한 활성 group 클럽 id 를 매핑한다.
 *
 * - clubs.type='group', status='active' 필터 (PostgREST 임베디드 필터)
 * - club_members JOIN으로 user_id → club_id
 * - 그룹 없는 독자는 결과 맵에서 누락 (호출부가 undefined → null 처리)
 *
 * @returns { [userId]: clubId } 맵
 */
export async function resolveClubIdsForUsers(
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const client = getSupabaseClient();

  let result: { data: ClubMemberClubRow[] | null; error: unknown };
  try {
    result = await client
      .from('club_members')
      .select('user_id, club_id!inner(id)')
      .eq('club_id.type', 'group')
      .eq('club_id.status', 'active')
      .in('user_id', userIds);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  const map: Record<string, string> = {};
  for (const row of result.data ?? []) {
    // 동일 user 가 여러 활성 group 에 속할 수 있으나, Track A MVP는 첫 매핑을 사용한다.
    const clubId = row.club_id?.id;
    if (typeof clubId === 'string' && clubId.length > 0 && !map[row.user_id]) {
      map[row.user_id] = clubId;
    }
  }
  return map;
}
