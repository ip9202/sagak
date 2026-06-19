// @MX:NOTE: [AUTO] process-join-request Edge Function (SPEC-CLUB-001 REQ-CLUBA-006, 결정 5.4)
//   Deno entry — tsconfig exclude 대상. 순수 로직은 ./logic.ts (타입 체크 + 단위 테스트 대상).
//
//   책임 (service_role 키로 원자적 수행):
//     1. 대상 독자(target_user_id)의 활성 group 클럽이 없으면 lazy 생성
//        (handle_new_club_host 트리거가 해당 독자를 host 로 자동 가입)
//     2. 생성/기존 club_id 로 join_requests INSERT (status=pending)
//     3. TODO(SPEC-NOTIF-001): host 에게 join_request_received 알림 발송 훅
//
//   보안:
//     - service_role 키는 Deno.env 에만 존재 (클라이언트 .env 미포함)
//     - verify_jwt=true (기본): 호출자의 Supabase JWT 검증 → requester_id 신뢰
//     - RLS 우회(service_role)지만 입력 계약(logic.ts)으로 필수 필드 강제
//
//   현재 상태: skeleton — lazy 그룹 생성 + INSERT 로직은 TODO.
//   멱등성 비재시도 정책(invokeEdgeFunction)을 고려해 중복 부작용 방지 필요.
import { createClient } from '@supabase/supabase-js';
import {
  parseRequestBody,
  buildErrorResponse,
  buildSuccessResponse,
} from './logic.ts';

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
    //   @MX:REASON: 키 노출은 RLS 전체 우회 권한 탈취로 이어진다.
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

  // parsed.value 검증 통과 — lazy 그룹 생성 + INSERT 실행 컨텍스트 확보.
  // createClient 는 구현 단계에서 service_role 클라이언트 생성에 사용된다.
  const _adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  void _adminClient; // skeleton — 실제 로직 채울 때 사용

  // TODO(SPEC-CLUB-001 T-008 skeleton):
  //   1. club_members JOIN clubs 에서 target_user_id 의 활성 group 조회
  //   2. 없으면 clubs INSERT (book_id, host_id=target_user_id, type=group, status=active)
  //      → handle_new_club_host 트리거가 target 을 host 로 자동 가입
  //   3. join_requests INSERT (club_id, requester_id, message, status=pending)
  //      → UNIQUE(club_id, requester_id) 위반 시 409 응답
  //   4. TODO(SPEC-NOTIF-001): host 알림 발송

  // @MX:TODO: [AUTO] lazy 그룹 생성 + join_requests INSERT 구현 (skeleton 단계)
  return buildSuccessResponse({
    ok: true,
    club_id: 'TODO',
    request_id: 'TODO',
  });
});
