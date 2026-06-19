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
 *
 * 주의: 본 모듈은 Supabase 클라이언트/DB 접근을 수행하지 않는다. DB 로직은 index.ts 가 담당.
 */

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

/** 공통 CORS + JSON 헤더 */
const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

/**
 * 표준화된 JSON 에러 응답을 생성한다.
 */
export function buildErrorResponse(
  status: number,
  error: string,
  detail?: string,
): Response {
  const body: Record<string, unknown> = { ok: false, error };
  if (detail !== undefined) body.detail = detail;
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * 표준화된 JSON 성공 응답을 생성한다.
 */
export function buildSuccessResponse(payload: ProcessJoinResponse): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: JSON_HEADERS,
  });
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
