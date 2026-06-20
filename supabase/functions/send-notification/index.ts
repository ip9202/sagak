// @MX:NOTE: [AUTO] send-notification Edge Function (SPEC-NOTIF-001 REQ-NOTIF-010~013)
//   Deno entry — tsconfig exclude 대상. 순수 로직은 ./logic.ts, ./templates.ts (jest 단위 테스트 대상).
//
//   책임 (service_role 키로 원자적 수행):
//     1. 요청 검증 (logic.ts): user_id uuid + type ENUM 6종
//     2. 템플릿 적용 (templates.ts): 다정한 톤 title/body 생성
//     3. notifications INSERT (service_role, RLS 우회) — 유일한 INSERT 경로
//     4. 수신자 push_token 조회 (users 테이블)
//     5. 토큰 존재 시 Expo Push API 호출 (expo-push.ts); 미존재/에러 시 INSERT 만 유지
//
//   보안:
//     - service_role 키는 Deno.env 에만 존재 (클라이언트 .env 미포함)
//     - 클라이언트가 직접 호출하지 않는다 (acceptance N24) — 각 도메인 SPEC 서버 로직이 호출
//     - RLS 우회(service_role)지만 입력 계약(logic.ts)으로 필수 필드 + ENUM 강제
//
// @MX:SPEC SPEC-NOTIF-001
import { createClient } from '@supabase/supabase-js';
import { parseRequestBody, buildErrorResponse, buildSuccessResponse } from './logic.ts';
import { buildTemplate } from './templates.ts';
import { sendExpoPush } from './expo-push.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return buildErrorResponse(405, 'method_not_allowed');
  }

  // service_role 클라이언트 (RLS 우회)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    // @MX:WARN: [AUTO] service_role 키 누락 — 배포 설정 오류. 키는 절대 로깅하지 않는다.
    //   @MX:REASON: 키 노출은 RLS 전체 우회 권한 탈취로 이어진다 (acceptance N24 방어).
    return buildErrorResponse(500, 'missing_server_config');
  }

  // 요청 본문 파싱 + 검증 (순수 로직 모듈 위임)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return buildErrorResponse(400, 'invalid_body');
  }

  const parsed = parseRequestBody(rawBody);
  if (!parsed.ok) {
    return buildErrorResponse(parsed.status, parsed.error, parsed.detail);
  }

  const { user_id, type, ref_id, data } = parsed.value;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 2) 템플릿 적용 → title/body (REQ-NOTIF-013)
  const { title, body } = buildTemplate(type, data);

  // 3) notifications INSERT (service_role, RLS 우회 — REQ-NOTIF-011)
  const insertRes = await admin
    .from('notifications')
    .insert({
      user_id,
      type,
      title,
      body,
      ref_id,
      data,
      is_read: false,
    })
    .select('id')
    .single();

  if (insertRes.error || !insertRes.data) {
    return buildErrorResponse(500, 'insert_failed', insertRes.error?.message);
  }
  const notification_id = insertRes.data.id;

  // 4) 수신자 push_token 조회 (REQ-NOTIF-012)
  const tokenRes = await admin
    .from('users')
    .select('push_token')
    .eq('id', user_id)
    .maybeSingle();

  const push_token = tokenRes.data?.push_token ?? null;

  // 5-A) 토큰 미존재 → INSERT 만 유지 (acceptance N28)
  if (!push_token) {
    return buildSuccessResponse({
      success: true,
      notification_id,
      push_sent: false,
    });
  }

  // 5-B) 토큰 존재 → Expo Push API 호출 (REQ-NOTIF-012, acceptance N27)
  const push = await sendExpoPush({
    token: push_token,
    notificationId: notification_id,
    type,
    refId: ref_id,
    title,
    body,
  });

  if (push.ok) {
    return buildSuccessResponse({
      success: true,
      notification_id,
      push_sent: true,
    });
  }

  // 5-C) Expo 에러 시 INSERT 유지 (롤백 X — 알림 센터 가용성 우선, acceptance N29)
  return buildSuccessResponse({
    success: true,
    notification_id,
    push_sent: false,
    push_error: push.error,
  });
});
