/**
 * 알림 센터 PostgREST 쿼리 + 읽음 변이 (SPEC-NOTIF-001 REQ-NOTIF-005~008)
 *
 * 조회/카운트/읽음 처리를 PostgREST 직접 호출로 수행 (Edge Function 불필요).
 * RLS(notifications_select_own / notifications_update_own)가 본인 행만 노출/수정 허용한다.
 * 클라이언트는 INSERT 권한이 없다 (서버 send-notification 만 INSERT).
 *
 * @MX:NOTE: [AUTO] 인덱스 (user_id, is_read) 로 카운트/필터 최적화 (SPEC-DB-001 0013).
 * @MX:SPEC SPEC-NOTIF-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { NotificationRow } from './types';

/** 목록 조회 상한 (무한 스크롤 전 MVP 고정 페이지) */
const LIST_LIMIT = 50;

/**
 * 인증된 사용자의 알림 목록을 created_at DESC 순으로 조회한다 (REQ-NOTIF-005).
 * RLS 가 auth.uid() = user_id 인 행만 반환한다.
 */
export async function getNotifications(): Promise<NotificationRow[]> {
  const client = getSupabaseClient();
  let result: { data: NotificationRow[] | null; error: unknown };
  try {
    result = await client
      .from('notifications')
      .select('id, user_id, type, title, body, ref_id, is_read, data, created_at')
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? [];
}

/**
 * 읽지 않은 알림 개수를 반환한다 (REQ-NOTIF-006).
 * PostgREST Prefer: count=exact 헤더로 is_read=false 행 개수 카운트.
 */
export async function getUnreadCount(): Promise<number> {
  const client = getSupabaseClient();
  let result: { count: number | null; error: unknown };
  try {
    result = await client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.count ?? 0;
}

/**
 * 개별 알림을 읽음 처리한다 (REQ-NOTIF-007).
 * RLS(notifications_update_own)가 본인 행만 갱신 허용. 이미 읽음이어도 멱등 (acceptance N15).
 */
export async function markNotificationRead(id: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    result = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 읽지 않은 모든 알림을 일괄 읽음 처리한다 (REQ-NOTIF-008).
 *
 * `.eq('is_read', false)` 만으로 충분하다 — RLS(notifications_update_own,
 * auth.uid() = user_id)가 서버에서 본인 행으로 자동 제한한다. 클라이언트가 보유한
 * user_id 를 쿼리에 명시하면 RLS 와 중복되어 단일 진실이 훼손된다 (PR #34 리뷰 m4).
 *
 * @MX:NOTE: [AUTO] 명시적 user_id 필터 불필요 — RLS 가 본인 행 갱신을 단독 보장.
 *   @MX:REASON: 클라이언트 전달 user_id 가 auth.uid() 와 불일치해도 RLS 가 0행 갱신으로 차단한다 (방어적 깊이는 RLS 단층이면 충분).
 */
export async function markAllNotificationsRead(): Promise<void> {
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    result = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
