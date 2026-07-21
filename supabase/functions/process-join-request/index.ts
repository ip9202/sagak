// @MX:NOTE: [AUTO] process-join-request Edge Function (SPEC-CLUB-001 REQ-CLUBA-006, 결정 5.4)
//   Deno entry — tsconfig exclude 대상. 순수 로직은 ./logic.ts (타입 체크 + 단위 테스트 대상).
//
//   책임 (service_role 키로 원자적 수행):
//     1. 대상 독자(target_user_id)의 활성 group 클럽이 없으면 lazy 생성
//        (handle_new_club_host 트리거가 해당 독자를 host 로 자동 가입)
//     2. 생성/기존 club_id 로 join_requests INSERT (status=pending)
//     3. host 에게 join_request_received 알림 발송 (SPEC-NOTIF-001 연동)
//
//   보안:
//     - service_role 키는 Deno.env 에만 존재 (클라이언트 .env 미포함)
//     - M-1: Authorization 헤더의 JWT 서명 검증 + sub 추출(verifyAndExtractJwtSub, jose ES256) → requester_id 일치 검증 (인가).
//            이중 방어선(SPEC-SECURITY-001): L0 게이트웨이 verify_jwt=true (빌드타임 A1 CI 가드가 config.toml drift 차단)
//            + L1 앱 단 jose 서명 검증 (logic.ts verifyAndExtractJwtSub, 게이트와 독립). extractJwtSub는 deprecated.
//     - M-2: target_user_id 가 user_books_public 공개 독자인지 조회 (위조 방지)
//     - 부수: CORS Origin 화이트리스트(ALLOWED_ORIGINS), UNIQUE(23505)→409 매핑
//     - RLS 우회(service_role)지만 입력 계약(logic.ts)으로 필수 필드 강제
//
//   멱등성 비재시도 정책(invokeEdgeFunction): join_requests(club_id, requester_id) UNIQUE 가
//   중복 부작용을 DB 단에서 차단한다. race condition 시 23505 → 409 응답.
import { createClient } from '@supabase/supabase-js';
import {
  parseRequestBody,
  buildErrorResponse,
  buildSuccessResponse,
  verifyAndExtractJwtSub,
  resolveAllowedOrigin,
  buildCorsPreflightHeaders,
  isUniqueViolation,
  buildLazyClubName,
  buildSendNotificationPayload,
} from './logic.ts';

/**
 * 환경 변수 ALLOWED_ORIGINS (쉼표 구분) 를 배열로 파싱한다.
 * @MX:NOTE: [AUTO] dev/prod 분리 — 배포 시점에 주입, 미설정 시 폐쇄 정책(빈 배열)
 */
function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS');
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const allowedOrigins = parseAllowedOrigins();
  const allowedOrigin = resolveAllowedOrigin(
    req.headers.get('Origin'),
    allowedOrigins,
  );

  // CORS preflight — 허용된 origin 만 Access-Control-Allow-Origin 반영
  if (req.method === 'OPTIONS') {
    if (!allowedOrigin) {
      // 허용되지 않은 origin 의 preflight 는 거부 (CORS 화이트리스트 강제)
      return new Response('forbidden', { status: 403 });
    }
    return new Response('ok', {
      headers: buildCorsPreflightHeaders(allowedOrigin),
    });
  }

  if (req.method !== 'POST') {
    return buildErrorResponse(405, 'method_not_allowed', undefined, allowedOrigin ?? undefined);
  }

  // service_role 클라이언트 (RLS 우회)
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    // @MX:WARN: [AUTO] service_role 키 누락 — 배포 설정 오류. 키는 절대 로깅하지 않는다.
    //   @MX:REASON: 키 노출은 RLS 전체 우회 권한 탈취로 이어진다.
    return buildErrorResponse(500, 'missing_server_config', undefined, allowedOrigin ?? undefined);
  }

  // 요청 본문 파싱 + 검증 (순수 로직 모듈 위임)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return buildErrorResponse(400, 'invalid_body', undefined, allowedOrigin ?? undefined);
  }

  const parsed = parseRequestBody(rawBody);
  if (!parsed.ok) {
    return buildErrorResponse(parsed.status, parsed.error, parsed.detail, allowedOrigin ?? undefined);
  }

  // @MX:NOTE: [AUTO] M-1: JWT 서명 검증(ES256) + sub 추출 + requester_id 일치 비교(인가).
  //   SPEC-SECURITY-001: extractJwtSub(payload 디코딩 only) → verifyAndExtractJwtSub(jose 서명 검증) 교체.
  //   L0 게이트웨이(verify_jwt)와 독립적인 2차 방어선 — 단일 방어선 SPOF 제거.
  //   @MX:REASON: service_role 키로 RLS 우회 시 애플리케이션 단 인가 로직이 필수이며,
  //     서명 검증으로 게이트웨이 드리프트/우회 시에도 인가 붕괴를 막는다.
  //   @MX:SPEC: SPEC-SECURITY-001 (REQ-SEC-011, 012)
  const authHeader = req.headers.get('authorization');
  const jwtSub = await verifyAndExtractJwtSub(authHeader);

  if (!jwtSub) {
    return buildErrorResponse(
      401,
      'invalid_jwt',
      'JWT가 누락되었거나 유효하지 않습니다',
      allowedOrigin ?? undefined,
    );
  }

  if (jwtSub !== parsed.value.requester_id) {
    return buildErrorResponse(
      403,
      'forbidden',
      'requester_id가 JWT sub와 일치하지 않습니다',
      allowedOrigin ?? undefined,
    );
  }

  // @MX:NOTE: [AUTO] M-2: 입력 검증 — target_user_id가 public reader인지 확인 (PR #21 리뷰)
  //   @MX:REASON: user_books_public 뷰가 WHERE is_public=true 로 필터링하므로, 행 존재 자체가 public reader 임을 보장한다. 뷰는 is_public 컬럼을 노출하지 않으므로(보안 리뷰 W2) 행 존재 여부로만 판정한다.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // user_books_public 뷰 조회로 target_user_id가 public reader인지 검증
  const { data: targetUser, error: targetUserError } = await adminClient
    .from('user_books_public')
    .select('user_id')
    .eq('user_id', parsed.value.target_user_id)
    .eq('book_id', parsed.value.book_id)
    .maybeSingle();

  if (targetUserError) {
    console.error('M-2 검증 중 DB 오류:', targetUserError);
    return buildErrorResponse(500, 'database_error', '대상 사용자 조회 실패', allowedOrigin ?? undefined);
  }

  if (!targetUser) {
    return buildErrorResponse(
      400,
      'invalid_target',
      'target_user_id가 존재하지 않거나 공개 프로필이 아닙니다',
      allowedOrigin ?? undefined,
    );
  }

  // ========================================================================
  // 핵심 로직: lazy group 클럽 조회/생성 + join_requests INSERT + 알림 발송
  // ========================================================================

  // 1) target_user_id(host) 의 활성 group 클럽을 clubs 테이블에서 직접 조회.
  //    club_members 조인 불필요 — handle_new_club_host 트리거가 host 멤버십을 보장하므로
  //    clubs.host_id = target_user_id 가 활성 group 클럽 존재 여부의 단일 신호.
  //    idx_clubs_book_id_type_status 인덱스 사용 (book_id + type + status 커버).
  //    clubs 에 UNIQUE(host_id, book_id, type) 가 없으므로 limit(1) 로 잉여 행 회피.
  const { data: existingClubs, error: clubLookupError } = await adminClient
    .from('clubs')
    .select('id')
    .eq('host_id', parsed.value.target_user_id)
    .eq('book_id', parsed.value.book_id)
    .eq('type', 'group')
    .eq('status', 'active')
    .limit(1);

  if (clubLookupError) {
    console.error('클럽 조회 중 DB 오류:', clubLookupError);
    return buildErrorResponse(500, 'database_error', '클럽 조회 실패', allowedOrigin ?? undefined);
  }

  const existingClubId = existingClubs?.[0]?.id ?? null;
  let clubId: string;

  // 2) 클럽이 없으면 lazy 생성 (handle_new_club_host 트리거가 host 자동 가입)
  //    clubs.name NOT NULL → buildLazyClubName 으로 식별 가능한 기본 name 제공
  if (!existingClubId) {
    const { data: newClub, error: clubInsertError } = await adminClient
      .from('clubs')
      .insert({
        name: buildLazyClubName(parsed.value.book_id),
        book_id: parsed.value.book_id,
        host_id: parsed.value.target_user_id,
        type: 'group',
        status: 'active',
      })
      .select('id')
      .single();

    if (clubInsertError || !newClub) {
      console.error('lazy 클럽 생성 실패:', clubInsertError);
      return buildErrorResponse(500, 'club_creation_failed', '클럽 생성에 실패했습니다', allowedOrigin ?? undefined);
    }
    clubId = newClub.id;
  } else {
    clubId = existingClubId;
  }

  // 3) join_requests INSERT (club_id, requester_id=JWT sub, message, status=pending)
  //    UNIQUE(club_id, requester_id) 위반 시 23505 → 409 (이미 요청 보냄)
  const { data: newRequest, error: requestInsertError } = await adminClient
    .from('join_requests')
    .insert({
      club_id: clubId,
      requester_id: parsed.value.requester_id,
      message: parsed.value.message,
      status: 'pending',
    })
    .select('id')
    .single();

  if (requestInsertError) {
    if (isUniqueViolation(requestInsertError)) {
      // 멱등성 비재시도 정책 — 이미 보낸 요청은 409 로 응답 (race condition 포함)
      return buildErrorResponse(
        409,
        'already_requested',
        '이미 해당 독자에게 합류 요청을 보냈습니다',
        allowedOrigin ?? undefined,
      );
    }
    console.error('join_requests INSERT 실패:', requestInsertError);
    return buildErrorResponse(500, 'database_error', '합류 요청 생성 실패', allowedOrigin ?? undefined);
  }

  if (!newRequest) {
    return buildErrorResponse(500, 'database_error', '합류 요청 생성 실패', allowedOrigin ?? undefined);
  }

  // 4) 알림 발송: send-notification Edge Function 호출 (SPEC-NOTIF-001 단일 진실 원칙)
  //    실패 시 INSERT 는 유지 — 사용자에게 200 반환, 알림 누락은 로깅만 (best-effort)
  //    requester nickname 은 users 테이블에서 별도 조회 (data 변수 채움)
  await sendJoinRequestNotification({
    adminClient,
    supabaseUrl,
    serviceRoleKey,
    hostUserId: parsed.value.target_user_id,
    requestId: newRequest.id,
    requesterId: parsed.value.requester_id,
    bookId: parsed.value.book_id,
  });

  // 클라이언트 계약 { ok, club_id, request_id } 유지 — skeleton 'TODO' 제거
  return buildSuccessResponse(
    {
      ok: true,
      club_id: clubId,
      request_id: newRequest.id,
    },
    allowedOrigin ?? undefined,
  );
});

/**
 * 호스트에게 join_request_received 알림을 발송한다 (SPEC-NOTIF-001 연동).
 *
 * 단일 진실 원칙(REQ-NOTIF-010): notifications INSERT + Expo Push 경로를
 * send-notification Edge Function 으로 위임. 본 함수는 HTTP fetch 래퍼 역할만 수행.
 *
 * 실패 처리: 알림은 best-effort — 발송 실패 시 join_requests INSERT 는 유지되며
 * 호출자에게 영향을 주지 않는다 (console.error 로깅만).
 *
 * @MX:NOTE: [AUTO] 알림 누락 허용 정책 — 합류 요청 자체의 성공이 알림보다 우선
 */
async function sendJoinRequestNotification(args: {
  adminClient: ReturnType<typeof createClient>;
  supabaseUrl: string;
  serviceRoleKey: string;
  hostUserId: string;
  requestId: string;
  requesterId: string;
  bookId: string;
}): Promise<void> {
  try {
    // requester nickname 조회 (알림 data 변수)
    const { data: requester, error: requesterError } = await args.adminClient
      .from('users')
      .select('nickname')
      .eq('id', args.requesterId)
      .maybeSingle();

    if (requesterError) {
      console.error('알림용 requester 조회 실패:', requesterError);
      // nickname 조회 실패해도 알림 발송 시도 (graceful degradation — 빈 문자열)
    }

    const requesterNickname = requester?.nickname ?? null;
    const clubTitle = buildLazyClubName(args.bookId);

    const payload = buildSendNotificationPayload({
      hostUserId: args.hostUserId,
      requestId: args.requestId,
      requesterNickname,
      clubTitle,
    });

    // send-notification Edge Function 호출 (service_role 내부 fetch)
    const functionUrl = `${args.supabaseUrl}/functions/v1/send-notification`;
    const resp = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.serviceRoleKey}`,
        apikey: args.serviceRoleKey,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      // 알림 발송 실패 — join_requests INSERT 는 유지, 로깅만
      const errorBody = await resp.text().catch(() => '');
      console.error('send-notification 호출 실패:', {
        status: resp.status,
        body: errorBody.slice(0, 200),
      });
    }
  } catch (err) {
    // 네트워크/예외 — 알림 누락 허용 정책
    console.error('sendJoinRequestNotification 예외:', err);
  }
}
