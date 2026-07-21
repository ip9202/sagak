/**
 * SPEC-NOTIF-001: send-notification Edge Function 순수 로직 모듈
 *
 * Deno entry(index.ts)는 tsconfig exclude 대상이므로, Deno 글로벌(Deno.serve/Deno.env)에
 * 의존하지 않는 순수 로직을 본 모듈로 분리해 타입 체크 + 단위 테스트(jest) 대상으로 만든다.
 *
 * 책임:
 * - 요청 본문 파싱 + 검증 (user_id uuid, type ENUM 6종, ref_id uuid 선택, data 객체 선택)
 * - 표준 JSON 응답 빌더 (CORS preflight 헤더 포함)
 *
 * 주의: 본 모듈은 Supabase 클라이언트/DB 접근/네트워크를 수행하지 않는다.
 *       notifications INSERT, Expo Push API 호출은 index.ts / expo-push.ts 가 담당.
 *
 * @MX:SPEC SPEC-NOTIF-001
 */

/**
 * SPEC-NOTIF-001 알림 타입 6종 (DB notification_type ENUM 과 동기화).
 * @MX:ANCHOR: [AUTO] 알림 ENUM 6종 — DB 스키마(0003_enrich_notifications_for_notif)와 단일 진실
 * @MX:REASON: client/Edge Function/DB 간 ENUM 불일치는 알림 누락/오발송을 유발한다.
 */
export const NOTIFICATION_TYPES = [
  'reading_reminder',
  'join_request_received',
  'join_accepted',
  'sticker_received',
  'completion',
  'club_signal',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** 파싱된 유효 요청 본문 (REQ-NOTIF-010 요청 스키마) */
export interface SendNotificationBody {
  user_id: string;
  type: NotificationType;
  ref_id: string | null;
  data: Record<string, unknown> | null;
}

/** Edge Function 정상 응답 본문 (REQ-NOTIF-012 — push_sent/push_error 포함) */
export interface SendSuccessPayload {
  success: true;
  notification_id: string;
  push_sent: boolean;
  push_error?: string;
}

export type ParseResult =
  | { ok: true; value: SendNotificationBody }
  | { ok: false; status: number; error: string; detail?: string };

// UUID v4 형식 (gen_random_uuid 산출물)
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 공통 CORS + JSON 헤더 */
const JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

/** 값이 ENUM 6종 중 하나인지 검증한다 (REQ-NOTIF-011). */
export function isValidNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

/** 값이 UUID 형식인지 검증한다. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * 표준화된 JSON 에러 응답을 생성한다.
 * 본문: { success: false, error, detail? }
 */
export function buildErrorResponse(
  status: number,
  error: string,
  detail?: string,
): Response {
  const body: Record<string, unknown> = { success: false, error };
  if (detail !== undefined) body.detail = detail;
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

/**
 * 표준화된 JSON 성공 응답을 생성한다 (REQ-NOTIF-012).
 * 본문: { success, notification_id, push_sent, push_error? }
 */
export function buildSuccessResponse(payload: SendSuccessPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: JSON_HEADERS,
  });
}

/**
 * 요청 본문을 파싱하고 필드를 검증한다 (REQ-NOTIF-010/011).
 *
 * 필수: user_id(uuid), type(ENUM 6종)
 * 선택: ref_id(uuid|null), data(객체|null)
 *
 * ENUM 위반 시 400 + detail `"Invalid notification type: <X>"` (SPEC acceptance N26).
 *
 * @returns ParseResult — ok=true 시 value, ok=false 시 status/error/detail
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

  // user_id 필수 + uuid
  if (!isUuid(obj.user_id)) {
    return { ok: false, status: 400, error: 'missing_or_invalid_user_id' };
  }

  // type 필수 + ENUM 6종
  if (!isValidNotificationType(obj.type)) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_notification_type',
      detail: `Invalid notification type: ${String(obj.type)}`,
    };
  }

  // ref_id 선택 — uuid 또는 null/undefined
  let ref_id: string | null = null;
  if (obj.ref_id !== undefined && obj.ref_id !== null) {
    if (!isUuid(obj.ref_id)) {
      return { ok: false, status: 400, error: 'invalid_ref_id' };
    }
    ref_id = obj.ref_id;
  }

  // data 선택 — 객체 또는 null/undefined (배열은 허용하지 않음: 템플릿 변수는 키-값)
  let data: Record<string, unknown> | null = null;
  if (obj.data !== undefined && obj.data !== null) {
    if (typeof obj.data !== 'object' || Array.isArray(obj.data)) {
      return { ok: false, status: 400, error: 'invalid_data' };
    }
    data = obj.data as Record<string, unknown>;
  }

  return {
    ok: true,
    value: {
      user_id: obj.user_id,
      type: obj.type,
      ref_id,
      data,
    },
  };
}
