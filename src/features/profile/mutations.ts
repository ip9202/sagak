/**
 * 프로필 수정 mutation (SPEC-PROFILE-001 REQ-PROF-002/003)
 *
 * users UPDATE where id=eq.userId (RLS 자기 행만 — REQ-DB-014 UPDATE).
 * 수정 필드: nickname, avatar_url 두 개만 (미결정 5.3 임시 방침).
 * email/provider/role/reading_alarm_* 은 수정 불가 (입력에 노출 안 함).
 *
 * nickname 클라이언트 검증(빈값/길이) 후 UPDATE — 서버 NOT NULL CHECK 가 2차 방어(P9).
 * 패턴: routine/alarmApi.ts (update chain) 참조.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { ValidationError } from '../../errors';
import type { ProfileUpdateInput } from './types';

/** nickname 최대 길이 (미결정 5.1/5.3 임시값 — 서버 NOT NULL CHECK 는 별도) */
export const NICKNAME_MAX_LENGTH = 20;

/** nickname 빈값/공백 검증용 메시지 */
const INVALID_NICKNAME_MESSAGE = '닉네임을 입력해 주세요';
const NICKNAME_TOO_LONG_MESSAGE = '닉네임은 20자 이내로 입력해 주세요';

/**
 * nickname/avatar_url 입력을 클라이언트 측에서 검증한다 (REQ-PROF-003).
 * - nickname 빈값/공백 → 무효
 * - nickname 21자 이상 → 무효
 * - avatar_url null 허용 (삭제 가능)
 */
export function validateProfileInput(
  input: ProfileUpdateInput,
): { valid: boolean; message?: string } {
  const trimmed = input.nickname.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: INVALID_NICKNAME_MESSAGE };
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return { valid: false, message: NICKNAME_TOO_LONG_MESSAGE };
  }
  return { valid: true };
}

/**
 * 자기 프로필을 수정한다 (REQ-PROF-002).
 * 클라이언트 검증 후 users UPDATE. RLS 가 타인 행 수정 차단.
 *
 * @param userId auth.uid()
 * @param input nickname (필수), avatar_url (nullable)
 * @throws VALIDATION AppError — nickname 빈값/길이 초과
 */
export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<void> {
  const validation = validateProfileInput(input);
  if (!validation.valid) {
    const err = new ValidationError(validation.message ?? INVALID_NICKNAME_MESSAGE);
    err.category = 'VALIDATION';
    throw err;
  }

  const client = getSupabaseClient();
  let result: { error: unknown };
  try {
    result = await client
      .from('users')
      .update({ nickname: input.nickname.trim(), avatar_url: input.avatar_url })
      .eq('id', userId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) {
    throw normalizeError(result.error);
  }
}
