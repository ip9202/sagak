/**
 * 독서 알림 설정 API (SPEC-ROUTINE-001 REQ-ROUT-005/006/007)
 *
 * users 테이블의 reading_alarm_time / reading_alarm_enabled 조회/수정.
 * RLS(REQ-DB-014) 가 본인 행만 노출/수정 허용 — 클라이언트 권한 로직 없음.
 *
 * 본 모듈은 설정 값의 저장/조회만 담당하며, 실제 알림 발송은 SPEC-NOTIF-001 이 담당한다.
 *
 * @MX:NOTE: [AUTO] HH:MM → HH:MM:SS 변환 — PostgREST time 타입은 'HH:MM:SS' 형식. 사용자 입력은 보통 HH:MM.
 * @MX:SPEC SPEC-ROUTINE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { ValidationError } from '../../errors';
import { INVALID_TIME_FORMAT } from './copy';
import type { AlarmSettings } from './types';

/** alarm_enabled 서버 기본값 (REQ-DB-001 — boolean DEFAULT true) */
const DEFAULT_ALARM_ENABLED = true;

/**
 * HH:MM 또는 HH:MM:SS 입력값을 검증하고 HH:MM:SS 로 정규화한다.
 * - 시 00~23, 분 00~59, 초 00~59 (생략 시 00)
 *
 * @throws VALIDATION AppError — 형식이 유효하지 않으면
 * @returns 'HH:MM:SS' 정규화 문자열
 */
export function normalizeAlarmTime(input: string): string {
  if (!input || typeof input !== 'string') {
    throw validationError();
  }
  const trimmed = input.trim();
  const match = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(trimmed);
  if (!match) {
    throw validationError();
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  const s = match[3] !== undefined ? Number(match[3]) : 0;
  if (h > 23 || m > 59 || s > 59) {
    throw validationError();
  }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function validationError(): never {
  // VALIDATION 카테고리 에러 — INVALID_TIME_FORMAT 메시지
  const err = new ValidationError(INVALID_TIME_FORMAT);
  err.category = 'VALIDATION';
  throw err;
}

/**
 * 알림 설정을 조회한다 (REQ-ROUT-007).
 * RLS 가 본인 행만 노출한다. 행이 없으면 기본값(null, true) 반환.
 */
export async function getAlarmSettings(): Promise<AlarmSettings> {
  const client = getSupabaseClient();
  let result: {
    data: { reading_alarm_time: string | null; reading_alarm_enabled: boolean | null } | null;
    error: unknown;
  };
  try {
    result = await client
      .from('users')
      .select('reading_alarm_time, reading_alarm_enabled')
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
  return {
    alarm_time: result.data?.reading_alarm_time ?? null,
    alarm_enabled: result.data?.reading_alarm_enabled ?? DEFAULT_ALARM_ENABLED,
  };
}

/**
 * 알림 시간을 설정한다 (REQ-ROUT-005).
 * 입력값을 정규화(HH:MM:SS) 후 UPDATE.
 *
 * @param time HH:MM 또는 HH:MM:SS 형식. 잘못된 형식은 VALIDATION 에러 throw.
 */
export async function updateAlarmTime(time: string): Promise<void> {
  const normalized = normalizeAlarmTime(time);
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    const chain = client
      .from('users')
      .update({ reading_alarm_time: normalized });
    result = await chain;
  } catch (error) {
    // normalizeAlarmTime 검증 실패가 아닌 PostgREST 호출 에러
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 알림 활성화 토글 (REQ-ROUT-006).
 * RLS 가 본인 행만 수정 허용.
 *
 * @param enabled 알림 활성화 여부
 */
export async function toggleAlarmEnabled(enabled: boolean): Promise<void> {
  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    const chain = client
      .from('users')
      .update({ reading_alarm_enabled: enabled });
    result = await chain;
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
