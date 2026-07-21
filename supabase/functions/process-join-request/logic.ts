/**
 * SPEC-CLUB-001 T-008: process-join-request Edge Function 순수 로직 모듈
 *
 * Deno entry(index.ts)가 tsconfig exclude 대상이므로, Deno 글로벌(Deno.serve/Deno.env)에
 * 의존하지 않는 순수 로직을 본 모듈로 분리해 타입 체크 + 단위 테스트 대상으로 만든다.
 *
 * 책임:
 * - 요청 본문 파싱 + 필수 필드 검증 (target_user_id, book_id, requester_id)
 * - E4 message 500자 이중 방어 (client 와 동일 기준)
 * - 표준 JSON 응답 빌더 (CORS preflight 포함)
 * - SPEC-SECURITY-001: verifyAndExtractJwtSub — jose ES256 서명 검증 (Deno.env.get 의존)
 *
 * 주의: verifyAndExtractJwtSub 는 Deno.env.get('SUPABASE_URL') 을 읽으므로 순수 함수가
 * 아니지만, index.ts(tsconfig exclude) 대신 logic.ts 에 배치해 단위 테스트 대상으로
 * 유지한다 (SPEC-SECURITY-001 REQ-SEC-030, lessons #22).
 */

import { jwtVerify, createRemoteJWKSet } from 'jose';

/**
 * E4 message 최대 길이 (client 측 src/features/club/trackA/types.ts 와 동일 기준).
 * @MX:ANCHOR: [AUTO] Edge Function 측 message 길이 제약 — client 와 공유
 * @MX:REASON: client 선검증과 서버 재검증 기준이 어긋나면 사용자가 혼란을 겪는다 (이중 방어).
 */
export const MESSAGE_MAX_LENGTH = 500;

/** Edge Function 정상 응답 본문 */
export interface ProcessJoinResponse {
  ok: boolean;
  club_id: string;
  request_id: string;
}

/** 파싱된 유효 요청 본문 */
export interface JoinRequestBody {
  target_user_id: string;
  book_id: string;
  requester_id: string;
  message: string | null;
}

export type ParseResult =
  | { ok: true; value: JoinRequestBody }
  | { ok: false; status: number; error: string; detail?: string };

/**
 * E4 message 길이 검증 (Edge Function 측 이중 방어).
 * @returns 에러 메시지(초과 시) 또는 null(유효)
 */
export function validateMessage(message: string | null): string | null {
  if (message === null) return null;
  if (message.length <= MESSAGE_MAX_LENGTH) return null;
  return `message must be at most ${MESSAGE_MAX_LENGTH} characters`;
}

/**
 * 운영 배포 보안 요구사항 (SPEC-CLUB-001 progress.md): CORS Origin 화이트리스트.
 * @MX:ANCHOR: [AUTO] CORS 단일 검증/반환 함수 — index.ts 의 preflight + JSON 응답이 모두 경유
 * @MX:REASON: `*` 와일드카드는 악의적 사이트의 인증 요청 헤더 전송을 허용하므로 화이트리스트로 좁힌다.
 */
const ALLOWED_METHODS = 'POST, OPTIONS';
const ALLOWED_HEADERS =
  'authorization, x-client-info, apikey, content-type';

/**
 * 요청 Origin 이 허용 목록에 포함되는지 검증한다.
 *
 * @param origin - 요청의 Origin 헤더 값 (null 허용)
 * @param allowedOrigins - 허용 origin 문자열 배열 (보통 환경 변수에서 쉼표 구분 파싱)
 * @returns 허용 시 해당 origin 문자열, 거부 시 null
 */
export function resolveAllowedOrigin(
  origin: string | null,
  allowedOrigins: readonly string[],
): string | null {
  if (!origin || origin.length === 0) return null;
  if (allowedOrigins.includes(origin)) return origin;
  return null;
}

/**
 * CORS preflight(OPTIONS) 응답용 헤더를 생성한다.
 * 허용된 origin 만 Access-Control-Allow-Origin 에 반영된다.
 */
export function buildCorsPreflightHeaders(
  allowedOrigin: string,
): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
  };
}

/**
 * 일반 JSON 응답용 헤더를 생성한다. 허용된 origin 만 CORS 에 반영된다.
 */
export function buildJsonHeaders(
  allowedOrigin: string,
): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
  };
}

/**
 * 표준화된 JSON 에러 응답을 생성한다.
 *
 * @param allowedOrigin - 사전 검증(resolveAllowedOrigin)된 origin. 빈 문자열이면 CORS 헤더 미포함.
 */
export function buildErrorResponse(
  status: number,
  error: string,
  detail?: string,
  allowedOrigin = '',
): Response {
  const body: Record<string, unknown> = { ok: false, error };
  if (detail !== undefined) body.detail = detail;
  const headers =
    allowedOrigin.length > 0
      ? buildJsonHeaders(allowedOrigin)
      : { 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * JWT에서 sub(user_id)를 추출한다. (sub 추출 전용, 서명 미검증)
 *
 * @deprecated SPEC-SECURITY-001 — 본 함수는 서명을 검증하지 않아 단일 방어선(게이트웨이
 *   verify_jwt) 우회 시 인가가 붕괴한다. 신규 코드는 {@link verifyAndExtractJwtSub} 를
 *   사용할 것. 호환성을 위해 정의는 유지하나 호출부는 0건이어야 한다 (REQ-SEC-020~021).
 *
 * @MX:WARN: [AUTO] 서명 미검증 — payload 디코딩만 수행. Supabase 게이트웨이가 JWT 서명을
 *   선검증하므로 본 함수는 sub 추출만 담당. 게이트웨이 우회 시 인가 붕괴 위험.
 *   requester_id == JWT sub 비교는 index.ts 게이트에서 수행(본 함수 범위 밖).
 *   @MX:REASON: service_role 키로 RLS 우회 시 애플리케이션 단 인가 로직이 필수이나,
 *     본 함수는 서명 검증 없이 payload에서 sub 값을 읽기만 하므로 단독 인가 의사결정에
 *     사용되어서는 안 됨. 반드시 게이트웨이 선검증이 전제된 컨텍스트에서만 호출.
 *     SPEC-SECURITY-001 이후 deprecated — verifyAndExtractJwtSub 사용 권장.
 *   @MX:SPEC: SPEC-CLUB-001, SPEC-SECURITY-001
 *
 * @param authHeader — Authorization 헤더 값 (Bearer {token})
 * @returns user_id (JWT sub) 또는 null (파싱 실패)
 */
export function extractJwtSub(authHeader: string | null): string | null {
  // @MX:WARN: [AUTO] deprecated 호출 — SPEC-SECURITY-001. 신규 코드는 verifyAndExtractJwtSub 사용.
  //   @MX:REASON: 본 함수는 서명 미검증이므로 게이트웨이 우회 시 무력화된다.
  console.warn(
    '[SPEC-SECURITY-001] extractJwtSub is deprecated — use verifyAndExtractJwtSub',
  );
  if (!authHeader) {
    return null;
  }

  // Authorization: Bearer {token} 형식 검증
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  try {
    // JWT는 {header}.{payload}.{signature} 형식
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      return null;
    }

    // payload 디코딩 (base64url)
    const payload = jwtParts[1];
    // base64url을 base64로 변환 (- → +, _ → /, 패딩 추가)
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

    // atob를 사용하여 디코딩 (Deno 런타임 지원)
    const decoded = atob(padded);
    const payloadObj = JSON.parse(decoded) as unknown;

    // payload가 object이고 sub 속성이 문자열인지 검증
    if (
      typeof payloadObj === 'object' &&
      payloadObj !== null &&
      'sub' in payloadObj &&
      typeof payloadObj.sub === 'string'
    ) {
      return payloadObj.sub;
    }

    return null;
  } catch {
    // 디코딩 또는 파싱 실패 시 null 반환
    return null;
  }
}

/**
 * SPEC-SECURITY-001: Authorization 헤더에서 JWT 를 추출해 ES256 서명을 검증하고 sub 를 반환한다.
 *
 * L0 게이트웨이(verify_jwt)와 독립적인 2차 방어선. JWKS 는 Supabase Auth 의
 * 공개 엔드포인트에서 createRemoteJWKSet 내장 TTL 캐시로 fetch 한다.
 *
 * 핀 치 (REQ-SEC-040~042):
 * - algorithms: ['ES256'] — HS256 혼동 공격 차단 (실제 Supabase 토큰은 ES256/ECDSA P-256)
 * - issuer: `${SUPABASE_URL}/auth/v1` — 발행자 고정 (실제 Supabase JWT iss 클레임 형태)
 * - audience: 'authenticated' — Supabase Auth 인증 토큰만 수용
 *
 * @MX:NOTE: [AUTO] jose ES256 서명 검증 — 게이트웨이 verify_jwt 와 독립적 2차 방어선.
 *   @MX:REASON: 단일 방어선(verify_jwt) 드리프트/우회 시 service_role RLS bypass 경로가
 *     노출되므로, 앱 계층에서 독립 검증으로 defense-in-depth 확보.
 *   @MX:SPEC: SPEC-SECURITY-001 (REQ-SEC-010, 040~042)
 *
 * @param authHeader — Authorization 헤더 값 ("Bearer {token}")
 * @returns 검증 성공 시 sub(user_id), 실패(서명불일치/만료/HS256/잘못된 issuer·audience/헤더오류) 시 null
 */
export async function verifyAndExtractJwtSub(
  authHeader: string | null,
): Promise<string | null> {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  if (token.length === 0) return null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    // REQ-SEC-041 선행: SUPABASE_URL 누락 시 검증 불가 — fail-closed (null).
    console.error('[SPEC-SECURITY-001] SUPABASE_URL env var missing — cannot verify JWT');
    return null;
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ['ES256'],
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    });
    if (typeof payload.sub === 'string' && payload.sub.length > 0) {
      return payload.sub;
    }
    return null;
  } catch {
    // 서명 불일치, 만료, 알고리즘 혼동, 잘못된 issuer/audience 등 모두 null 처리.
    return null;
  }
}

/**
 * 표준화된 JSON 성공 응답을 생성한다.
 *
 * @param allowedOrigin - 사전 검증(resolveAllowedOrigin)된 origin. 빈 문자열이면 CORS 헤더 미포함.
 */
export function buildSuccessResponse(
  payload: ProcessJoinResponse,
  allowedOrigin = '',
): Response {
  const headers =
    allowedOrigin.length > 0
      ? buildJsonHeaders(allowedOrigin)
      : { 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(payload), { status: 200, headers });
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 요청 본문을 파싱하고 필수 필드를 검증한다.
 *
 * 필수: target_user_id, book_id, requester_id (빈 문자열 불가)
 * 선택: message (null 허용, 500자 초과 시 400)
 *
 * @returns ParseResult — ok=true 시 value, ok=false 시 status/error
 */
export function parseRequestBody(rawBody: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, status: 400, error: 'invalid_body' };
  }

  const obj = parsed as Record<string, unknown>;

  if (!isString(obj.target_user_id)) {
    return { ok: false, status: 400, error: 'missing_target_user_id' };
  }
  if (!isString(obj.book_id)) {
    return { ok: false, status: 400, error: 'missing_book_id' };
  }
  if (!isString(obj.requester_id)) {
    return { ok: false, status: 400, error: 'missing_requester_id' };
  }

  // message 는 선택 — null/문자열만 허용
  const messageRaw = obj.message;
  let message: string | null = null;
  if (typeof messageRaw === 'string') {
    message = messageRaw;
  } else if (messageRaw !== undefined && messageRaw !== null) {
    return { ok: false, status: 400, error: 'invalid_message_type' };
  }

  const lengthError = validateMessage(message);
  if (lengthError) {
    return { ok: false, status: 400, error: 'message_too_long', detail: lengthError };
  }

  return {
    ok: true,
    value: {
      target_user_id: obj.target_user_id,
      book_id: obj.book_id,
      requester_id: obj.requester_id,
      message,
    },
  };
}

// ============================================================================
// 운영 배포 보안 요구사항 (SPEC-CLUB-001 progress.md) — skeleton 완성용 순수 로직
// ============================================================================

/** PostgREST/Supabase UNIQUE 위반 에러 코드 */
const UNIQUE_VIOLATION_CODE = '23505';

/**
 * Supabase/PostgREST 에러 객체가 UNIQUE 위반(23505)인지 검사한다.
 *
 * join_requests(club_id, requester_id) UNIQUE 위반 시 호출자가 409 응답으로 변환한다.
 * 멱등성 비재시도 정책(invokeEdgeFunction)과 race condition 방어 목적.
 *
 * @param error - Supabase client 의 error 필드 (code 속성 포함 가능)
 * @returns 23505 위반 시 true, 그 외 false
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === UNIQUE_VIOLATION_CODE;
}

/**
 * lazy 생성되는 group 클럽의 name 을 생성한다.
 *
 * clubs.name 은 NOT NULL 이므로 lazy INSERT 시 반드시 값이 필요하다.
 * 도메인 의미(사용자 노출 이름)는 본 skeleton 범위가 아니므로 식별 가능한 형식만 제공.
 *
 * @param bookId - clubs.book_id 로 사용되는 UUID
 * @returns `group-{bookId 앞 8자}` 형식의 name
 */
export function buildLazyClubName(bookId: string): string {
  const prefix = bookId.length >= 8 ? bookId.slice(0, 8) : bookId;
  return `group-${prefix}`;
}

/**
 * SPEC-NOTIF-001 send-notification Edge Function 호출 바디 빌더.
 * @MX:ANCHOR: [AUTO] join_request_received 알림 페이로드 단일 진실 — index.ts 가 경유하는 유일 빌더
 * @MX:REASON: 템플릿 변수(requester_nickname, club_title) 키 불일치는 알림 문구 깨짐으로 이어진다.
 *
 * @param input.hostUserId - 알림 수신자 = lazy 생성된 클럽의 host(target_user_id)
 * @param input.requestId - 생성된 join_requests.id (ref_id 로 사용, 딥링크용)
 * @param input.requesterNickname - 요청자 닉네임 (null 시 빈 문자열 graceful degradation)
 * @param input.clubTitle - 클럽 표시명 (보통 buildLazyClubName 결과)
 * @returns send-notification 요청 본문 (user_id, type, ref_id, data)
 */
export interface SendNotificationPayloadInput {
  hostUserId: string;
  requestId: string;
  requesterNickname: string | null;
  clubTitle: string;
}

/** send-notification 호출 바디 (logic.ts 의 SendNotificationBody 와 구조 일치) */
export interface SendNotificationPayload {
  user_id: string;
  type: 'join_request_received';
  ref_id: string;
  data: {
    requester_nickname: string;
    club_title: string;
  };
}

export function buildSendNotificationPayload(
  input: SendNotificationPayloadInput,
): SendNotificationPayload {
  return {
    user_id: input.hostUserId,
    type: 'join_request_received',
    ref_id: input.requestId,
    data: {
      // @MX:NOTE: [AUTO] requester_nickname null 시 빈 문자열 — SPEC-NOTIF-001 acceptance N33 (graceful degradation)
      requester_nickname: input.requesterNickname ?? '',
      club_title: input.clubTitle,
    },
  };
}
