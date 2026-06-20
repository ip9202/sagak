/**
 * SPEC-NOTIF-001: Expo Push API 호출 로직 (REQ-NOTIF-012)
 *
 * POST https://exp.host/api/v2/push/send 로 단일 푸시를 발송한다.
 *
 * 설계 원칙 (REQ-NOTIF-012):
 * - 알림 센터 가용성이 푸시 성공보다 우선 → 본 함수는 실패 시 예외를 throw 하지 않고
 *   { ok:false, error } 를 반환한다. 호출자(index.ts)는 INSERT 를 롤백하지 않는다.
 * - 만료 토큰(DeviceNotRegistered) 등 Expo 에러는 error 문자열로 전달 (acceptance N29).
 *
 * 참고: 본 모듈은 표준 fetch(전역)만 사용 — Deno 글로벌 미사용.
 *       단, index.ts 에서만 import 되므로 tsconfig exclude 대상은 아니다(직접 Deno 글로벌 없음).
 *
 * @MX:SPEC SPEC-NOTIF-001
 */

/** 푸시 발송 입력 */
export interface ExpoPushInput {
  token: string;
  notificationId: string;
  type: string;
  refId: string | null;
  title: string;
  body: string;
}

/** 푸시 발송 결과 — 실패 시 error 포함, 예외 throw 안 함 */
export interface ExpoPushResult {
  ok: boolean;
  error?: string;
}

const EXPO_ENDPOINT = 'https://exp.host/api/v2/push/send';

/**
 * Expo Push API 로 푸시를 발송한다 (REQ-NOTIF-012).
 * 네트워크/Expo 에러 시 throw 하지 않고 { ok:false, error } 반환 (INSERT 유지 목적).
 */
export async function sendExpoPush(input: ExpoPushInput): Promise<ExpoPushResult> {
  const payload = {
    to: input.token,
    title: input.title,
    body: input.body,
    data: {
      notification_id: input.notificationId,
      type: input.type,
      ref_id: input.refId,
    },
    sound: 'default',
    _displayInForeground: false,
  };

  try {
    const res = await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `expo_http_${res.status}` };
    }

    const json = (await res.json()) as {
      data?: { status?: string; message?: string } | Array<{ status?: string; message?: string }>;
    };

    // 단일 토큰 → data 는 객체(또는 배열의 첫 요소)
    const ticket = Array.isArray(json?.data) ? json.data[0] : json?.data;
    if (ticket?.status === 'ok') {
      return { ok: true };
    }
    return {
      ok: false,
      error: ticket?.message ?? 'expo_unknown_error',
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'expo_fetch_failed',
    };
  }
}
