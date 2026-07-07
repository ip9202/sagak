/**
 * 모임 피드 클라이언트 API (SPEC-FEED-001 T-A3)
 *
 * emotion_records 테이블에 대한 PostgREST 커서 페이지네이션 래퍼.
 * - 모임(club) 단위 + 모임 도서(book) 범위 필터 (REQ-FEED-001, REQ-FEED-003)
 * - visibility='club' 만 (공개 기록은 별도 피드)
 * - created_at DESC, id DESC 복합 정렬 (안정 커서용)
 * - 커서 페이지네이션 (F4 — .or() 복합 표현식으로 중복/누락 없는 시커서)
 *
 * 호출은 getSupabaseClient 를 경유하고 에러는 normalizeError 로 정규화한다.
 *
 * @MX:NOTE: [AUTO] RLS(REQ-DB-016) 는 비멤버 행 격리를 서버에서 수행한다 — 본 함수는 쿼리 구성만 담당하며 RLS 를 mock/우회하지 않는다.
 * @MX:NOTE: [AUTO] 집계/환산 헬퍼(aggregateStickers/toWithAuthor) 와 select 상수(EMOTION_LIST_SELECT), 원시 행 타입(RawListRow/RawStickerRow) 는 emotion 도메인 barrel(../emotion) 에서 import 한다 — 단일 소스 DRY (이슈 #27 해소). feed.fetchClubFeedPage 와 emotion.listEmotionRecords 양쪽이 동일 emotion_records 리스트 조회 형태를 공유하므로 규칙이 절대 어긋나지 않는다.
 * @MX:SPEC SPEC-FEED-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { toWithAuthor, EMOTION_LIST_SELECT } from '../emotion';
import type { RawListRow } from '../emotion';
import type { FeedCursor, FeedPageResult, FeedQueryOptions } from './types';

/** 페이지 크기 기본값 (REQ-FEED-002) */
const DEFAULT_PAGE_LIMIT = 20;

/**
 * 모임 피드의 단일 페이지를 조회한다 (REQ-FEED-001/002/003, F1/F3/F4/F5/F6).
 *
 * 필터: club_id, visibility='club', book_id.
 * 정렬: created_at DESC, id DESC (안정 커서용 복합 정렬).
 * 커서: 주어지면 .or() 복합 표현식으로 이전 페이지 마지막 행 이전만 조회.
 *
 * @returns items(집계 환산) + nextCursor(마지막 페이지면 null)
 */
export async function fetchClubFeedPage(
  opts: FeedQueryOptions & { cursor?: FeedCursor },
): Promise<FeedPageResult> {
  const limit = opts.limit ?? DEFAULT_PAGE_LIMIT;
  const client = getSupabaseClient();

  let query = client
    .from('emotion_records')
    .select(EMOTION_LIST_SELECT)
    .eq('club_id', opts.clubId)
    .eq('visibility', 'club')
    .eq('book_id', opts.bookId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (opts.cursor) {
    // F4: created_at.lt 커서 OR (created_at.eq 커서 AND id.lt 커서)
    // 동일 created_at 행이라도 id DESC 로 순서가 보장되어 중복/누락이 없다.
    const { createdAt, id } = opts.cursor;
    const orExpr = `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`;
    query = query.or(orExpr);
  }

  let result: { data: RawListRow[] | null; error: unknown };
  try {
    result = await query.limit(limit);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  const rows = result.data ?? [];
  const items = rows.map(toWithAuthor);

  // nextCursor: limit 도달 시 마지막 항목 커서, 미만이면 null (마지막 페이지)
  const nextCursor: FeedCursor =
    items.length >= limit
      ? {
          createdAt: items[items.length - 1].created_at,
          id: items[items.length - 1].id,
        }
      : null;

  return { items, nextCursor };
}
