/**
 * 푸시 토큰 서버 등록 (SPEC-NOTIF-001 REQ-NOTIF-003)
 *
 * 인증된 사용자의 Expo Push Token 을 users.push_token 에 UPDATE 한다.
 * RLS(users_update_own_row)가 auth.uid() = id 인 본인 행만 갱신을 허용한다.
 *
 * @MX:NOTE: [AUTO] 명시적 user_id 필터(eq('user_id', ...)) 불필요 — RLS 가 본인 행 갱신을 단독 보장.
 *   PR #34 리뷰 m4(markAllNotificationsRead)와 동일 원칙: 클라이언트 user_id 는 auth.uid() 와
 *   불일치해도 RLS 가 0행 갱신으로 차단하며, 쿼리에 명시하면 단일 진실이 훼손된다.
 * @MX:NOTE: [AUTO] 실패 시 throw → 호출자(usePushTokenRegistration)가 catch 해 swallow.
 *   알림 센터(REQ-NOTIF-005~008)는 푸시 등록 실패와 무관하게 동작한다 (silent failure).
 * @MX:SPEC SPEC-NOTIF-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';

/**
 * Expo Push Token 을 users.push_token 에 등록한다 (REQ-NOTIF-003).
 * RLS 가 본인 행 갱신을 보장한다 (user_id 필터 명시 금지).
 *
 * @param token - getExpoPushTokenAsync().data 문자열
 * @throws AppError - PostgREST error 또는 네트워크 throw 시 normalizeError 래핑
 */
export async function registerPushToken(token: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    result = await client
      .from('users')
      .update({ push_token: token });
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
