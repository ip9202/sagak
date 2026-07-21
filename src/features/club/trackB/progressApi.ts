/**
 * SPEC-CLUB-002 Track B 진도 동기화 API (M2)
 *
 * - updateProgress: clubs 진도 UPDATE (daily_pages, trigger_page) — REQ-CLUBB-009
 *
 * 권한 모델 (RLS 단일 신뢰 경로):
 * - clubs UPDATE: auth.uid() = host_id (host 만). 비host 시 RLS 가 42501 로 거부.
 * - 클라이언트는 UPDATE 호출만 수행. DB 가 권한을 강제한다.
 *
 * 클라이언트 검증 (보조, REQ-CLUBB-011/012):
 * - 음수/비정수: VALIDATION throw (DB CHECK >= 0 가 2차 방어선)
 * - status='closed': VALIDATION throw (closed 모임 읽기 전용, 가정 2.2.4)
 *
 * 컬럼 정의는 마이그레이션 20240618000006_add_club_reading_plan_columns.sql (NULL 허용, CHECK >= 0).
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import { AppError } from '../../../errors';
import type { ClubUpdate } from './types';

/**
 * 진도 업데이트 입력 (REQ-CLUBB-009).
 *
 * - dailyPages: 일일 권장 페이지 (clubs.daily_pages, NULL 허용)
 * - triggerPage: 트리거 페이지 (clubs.trigger_page, NULL 허용)
 *
 * 두 값 모두 선택 — 부분 업데이트 허용. null 전달 시 해당 컬럼을 NULL 로 초기화.
 */
export interface UpdateProgressInput {
  dailyPages?: number | null;
  triggerPage?: number | null;
}

/**
 * updateProgress 옵션 (REQ-CLUBB-012).
 *
 * - status: 호출부(getClubDetail 등)가 미리 조회한 clubs.status.
 *   'closed' 전달 시 진도 업데이트를 사전 차단한다.
 */
export interface UpdateProgressOptions {
  status?: string;
}

/**
 * 진도 입력값 단건 검증 (REQ-CLUBB-011).
 *
 * - null 은 허용 (컬럼 초기화)
 * - 정수 0 이상 허용 (DB CHECK >= 0 와 일치)
 * - 음수/비정수 시 VALIDATION AppError throw
 */
function validateProgressField(
  value: number | null | undefined,
  fieldName: string,
): void {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 0) {
    const err = new AppError(
      `${fieldName} 은(는) 0 이상의 정수여야 합니다`,
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }
}

/**
 * 모임 진도를 업데이트한다 (REQ-CLUBB-009).
 *
 * - clubs.daily_pages, clubs.trigger_page UPDATE.
 * - RLS(clubs_update_own — auth.uid() = host_id)가 host 만 허용 (REQ-CLUBB-010).
 * - status='closed' 모임은 사전 차단 + DB 레벨 WHERE status='active' 이중 방어 (REQ-CLUBB-012, W1).
 *
 * W1 (TOCTOU 방어): 클라이언트 사전 차단은 호출부의 캐시된 status 에 의존.
 * 다른 기기에서 close → stale 캐시 → 우회 가능. 따라서 UPDATE 쿼리에
 * `.eq('status', 'active')` 조건을 추가해 DB 가 closed 행을 갱신에서 제외한다.
 * PostgREST 는 `.select()` 가 있을 때 갱신된 행 배열을 반환하므로, 빈 배열이면
 * 0 rows(closed 이거나 host 아님)로 판단하여 VALIDATION 으로 차단한다.
 *
 * @param clubId - 대상 clubs.id
 * @param input - 진도 값 (부분 업데이트, null 로 초기화 허용)
 * @param options.status - clubs.status ('closed' 시 사전 차단)
 * @throws AppError VALIDATION(음수/비정수/closed 또는 0 rows)/RLS_DENIED(비host 명시적 거부)/NETWORK
 */
export async function updateProgress(
  clubId: string,
  input: UpdateProgressInput,
  options?: UpdateProgressOptions,
): Promise<void> {
  // REQ-CLUBB-012: closed 모임 진도 업데이트 사전 차단 (빠른 UX 실패)
  if (options?.status === 'closed') {
    const err = new AppError(
      '종료된 모임은 진도를 변경할 수 없습니다',
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }

  // REQ-CLUBB-011: 입력 검증 (음수/비정수)
  validateProgressField(input.dailyPages, 'dailyPages');
  validateProgressField(input.triggerPage, 'triggerPage');

  // UPDATE payload 구성 — 미전달 필드는 제외 (부분 업데이트)
  const payload: ClubUpdate = {};
  if (input.dailyPages !== undefined) {
    payload.daily_pages = input.dailyPages;
  }
  if (input.triggerPage !== undefined) {
    payload.trigger_page = input.triggerPage;
  }

  // W1: DB 레벨 WHERE status='active' + .select() 로 affected rows 확인.
  // - closed 행은 0 rows → VALIDATION throw
  // - 비host RLS 명시적 거부(42501) → error 반환 → RLS_DENIED
  // - 비host RLS silent filter(0 rows) → VALIDATION 범주로 처리 (host/closed 구분 불가)
  const client = getSupabaseClient();
  let result: { data: unknown[] | null; error: unknown };
  try {
    result = await client
      .from('clubs')
      .update(payload)
      .eq('id', clubId)
      .eq('status', 'active')
      .select('id, status');
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);

  // 0 rows = closed 이거나 host 가 아님 (RLS silent filter). 둘 다 진도 변경 불가.
  if (!result.data || result.data.length === 0) {
    const err = new AppError(
      '진도를 변경할 수 없습니다 (종료된 모임이거나 권한이 없습니다)',
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }
}
