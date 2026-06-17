/**
 * 스티커 반응 클라이언트 API (SPEC-EMOTION-001)
 *
 * sticker_reactions 테이블에 대한 PostgREST 래퍼.
 * (a) precheck: 등록 전 기존 반응 조회 (plan.md 결정 2)
 * (b) create: INSERT — UNIQUE 위반(23505) 은 normalizeError 가 VALIDATION 으로 매핑
 * (c) delete: 본인만 (record_id + user_id 복합 조건, RLS 보조)
 * (d) aggregateByRecord: 타입별 count 집계
 *
 * 정책: 업서트 미적용 — 409 발생 시 기존 반응 유지, 사용자가 명시적 취소 후 재등록 (plan.md 결정 2).
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import type { StickerType } from '../../types';
import type { StickerAggregate, StickerReactionRow } from './types';

/**
 * 스티커 생성 입력. user_id 는 명시적으로 전송한다 (감정 기록과 달리 RLS 가
 * auth.uid() 를 주입하지만, precheck 와의 일관성을 위해 클라이언트에서 전송).
 */
export interface CreateStickerInput {
  recordId: string;
  stickerType: StickerType;
  userId: string;
}

/**
 * 특정 기록에 대한 사용자의 기존 반응을 사전 조회한다 (시나리오 3.3 사전 안내).
 *
 * @returns 기존 반응 행 또는 null (미존재). null 은 에러가 아니다.
 */
export async function precheckSticker(
  recordId: string,
  userId: string,
): Promise<Pick<StickerReactionRow, 'id' | 'sticker_type'> | null> {
  const client = getSupabaseClient();
  let result: {
    data: Pick<StickerReactionRow, 'id' | 'sticker_type'> | null;
    error: unknown;
  };
  try {
    result = await client
      .from('sticker_reactions')
      .select('id,sticker_type')
      .eq('record_id', recordId)
      .eq('user_id', userId)
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
  return result.data ?? null;
}

/**
 * 스티커 반응을 등록한다 (REQ-EMO-006, 시나리오 3.1/3.2/3.3/3.4, EC-3/EC-11).
 *
 * UNIQUE(record_id, user_id) 위반(23505) 은 normalizeError 가 VALIDATION 으로 매핑한다.
 * 업서트 미적용 — 기존 반응은 유지된다 (plan.md 결정 2).
 *
 * @returns 생성된 sticker_reactions 행
 */
export async function createStickerReaction(
  input: CreateStickerInput,
): Promise<StickerReactionRow> {
  const client = getSupabaseClient();
  let result: { data: StickerReactionRow | null; error: unknown };
  try {
    result = await client
      .from('sticker_reactions')
      .insert({
        record_id: input.recordId,
        user_id: input.userId,
        sticker_type: input.stickerType,
      })
      .select()
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('createStickerReaction failed'));
  }
  return result.data;
}

/**
 * 스티커 반응을 취소한다 (REQ-EMO-007, 시나리오 3.5/3.6).
 *
 * 본인만 삭제 가능 — record_id + user_id 복합 조건으로 RLS 보조 필터.
 */
export async function deleteStickerReaction(
  recordId: string,
  userId: string,
): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('sticker_reactions')
      .delete()
      .eq('record_id', recordId)
      .eq('user_id', userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 기록별 스티커 반응을 타입별 count 로 집계한다 (REQ-EMO-006 집계, 시나리오 1.7).
 * sticker_type 만 선택 후 클라이언트에서 count 로 환산한다 (plan.md 결정 3 — GROUP BY 실시간 산출).
 */
export async function aggregateByRecord(
  recordId: string,
): Promise<StickerAggregate[]> {
  const client = getSupabaseClient();
  let result: { data: { sticker_type: StickerType }[] | null; error: unknown };
  try {
    result = await client
      .from('sticker_reactions')
      .select('sticker_type')
      .eq('record_id', recordId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  const rows = result.data ?? [];
  const counts = new Map<StickerType, number>();
  for (const row of rows) {
    counts.set(row.sticker_type, (counts.get(row.sticker_type) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([sticker_type, count]) => ({
    sticker_type,
    count,
  }));
}
