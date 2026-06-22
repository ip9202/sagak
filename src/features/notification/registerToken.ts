/**
 * 푸시 토큰 서버 등록 (SPEC-NOTIF-001 REQ-NOTIF-003)
 *
 * 인증된 사용자의 Expo Push Token 을 users.push_token 에 UPDATE 한다.
 * RLS(users_update_own_row)가 auth.uid() = id 인 본인 행만 갱신을 허용한다.
 *
 * @MX:NOTE: [AUTO] eq('id', userId) WHERE 필수 — PostgREST(code 21000)는 RLS 와 무관하게
 *   WHERE 없는 UPDATE 를 구문 차단한다. RLS(users_update_own_row)는 이중 안전망이며,
 *   auth.uid() !== id 면 0행 갱신된다. (주석 가정 정정: WHERE 가 있어야 RLS 가 행을 평가한다.)
 * @MX:NOTE: [AUTO] 실패 시 throw → 호출자(usePushTokenRegistration)가 catch 해 swallow.
 *   알림 센터(REQ-NOTIF-005~008)는 푸시 등록 실패와 무관하게 동작한다 (silent failure).
 * @MX:SPEC SPEC-NOTIF-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';

/**
 * Expo Push Token 을 users.push_token 에 등록한다 (REQ-NOTIF-003).
 * WHERE('id', userId) + RLS 가 본인 행 갱신을 이중 보장한다.
 *
 * @param token - getExpoPushTokenAsync().data 문자열
 * @param userId - 인증된 사용자 id (auth.uid). WHERE 절에 사용.
 * @throws AppError - PostgREST error 또는 네트워크 throw 시 normalizeError 래핑
 */
export async function registerPushToken(token: string, userId: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    result = await client
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
