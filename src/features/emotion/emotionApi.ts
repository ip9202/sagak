/**
 * 감정 기록 클라이언트 API (SPEC-EMOTION-001)
 *
 * emotion_records 테이블에 대한 PostgREST 래퍼.
 * 모든 호출은 getSupabaseClient 를 경유하며, 에러는 normalizeError 로 정규화한다.
 *
 * 정책 (plan.md 결정 1):
 * - Edge Function 없이 PostgREST 직접 호출
 * - user_id 는 RLS(auth.uid()) 가 자동 주입 — 클라이언트에서 전송하지 않는다
 * - 사전 검증(content 비어있지 않음, visibility=club 시 club_id 필수) 을 클라이언트에서 수행하여
 *   불필요한 PostgREST 호출을 막는다 (시나리오 1.3, 1.4).
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import { getSupabaseClient } from '../../lib/supabase/client';
import { normalizeError } from '../../lib/api/errors';
import { AppError } from '../../errors';
import type { Database } from '../../types/supabase';
import type { StickerType } from '../../types';
import type {
  CreateEmotionInput,
  EmotionListResult,
  EmotionRecordRow,
  EmotionRecordWithAuthor,
  EmotionSortOption,
  ListEmotionOptions,
  StickerAggregate,
  UpdateEmotionInput,
} from './types';

/** 빈 content 검증 에러 코드 */
const EMPTY_CONTENT_CODE = 'EMPTY_CONTENT';
/** club_id 누락 검증 에러 코드 */
const CLUB_ID_REQUIRED_CODE = 'CLUB_ID_REQUIRED';

/**
 * 클라이언트 사전 검증 — PostgREST 호출 전 입력값을 확인한다.
 * - content 가 trim 후 빈 문자열이면 VALIDATION AppError
 * - visibility=club 인데 clubId 가 없으면 VALIDATION AppError
 */
function validateCreateInput(input: CreateEmotionInput): void {
  if (input.content.trim().length === 0) {
    const err = new AppError('내용을 입력해주세요', EMPTY_CONTENT_CODE, 400);
    err.category = 'VALIDATION';
    throw err;
  }
  if (input.visibility === 'club' && !input.clubId) {
    const err = new AppError(
      '모임 감정 기록은 모임을 선택해야 합니다',
      CLUB_ID_REQUIRED_CODE,
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }
}

/**
 * 감정 기록을 생성한다 (REQ-EMO-001, 시나리오 1.1, 1.2).
 *
 * user_id 는 전송하지 않는다 — RLS INSERT 정책이 auth.uid() 로 주입한다.
 * 사전 검증 실패 시 PostgREST 를 호출하지 않고 VALIDATION AppError 를 throw 한다.
 *
 * @returns 생성된 emotion_records 행
 */
export async function createEmotionRecord(
  input: CreateEmotionInput,
): Promise<EmotionRecordRow> {
  validateCreateInput(input);

  const client = getSupabaseClient();
  let result: { data: EmotionRecordRow | null; error: unknown };
  // @MX:NOTE: [AUTO] user_id 는 전송하지 않는다 — RLS INSERT 정책(auth.uid()) 이 자동 주입. gen-types Insert 는 user_id 를 required 로 표기하지만 DB 컬럼에 DEFAULT(auth.uid()) 가 있어 PostgREST 는 생략을 허용한다. 타입 충돌은 Omit 으로 우회한다.
  type EmotionInsert =
    Database['public']['Tables']['emotion_records']['Insert'];
  const payload = {
    book_id: input.bookId,
    page_number: input.pageNumber,
    content: input.content,
    visibility: input.visibility,
    club_id: input.visibility === 'club' ? input.clubId : null,
  } as EmotionInsert;
  try {
    result = await client
      .from('emotion_records')
      .insert(payload)
      .select()
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('createEmotionRecord failed'));
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// T-003: list (조회 + 작성자 조인 + 스티커 집계 + 스포일러 분할)
// ---------------------------------------------------------------------------

/**
 * PostgREST select 컬럼 — emotion_records 본문 + users 조인(nickname/avatar) +
 * sticker_reactions 집계. sticker_type 만 선택하여 원시 행 배열을 받은 뒤 클라이언트에서 count 로 환산한다.
 */
const EMOTION_LIST_SELECT =
  '*, users(nickname,avatar_url), sticker_reactions(sticker_type)';

/**
 * PostgREST 응답의 원시 sticker_reactions 행 (집계 전).
 * GROUP BY 대신 단순 join 결과로 type 만 수집한다.
 */
interface RawStickerRow {
  sticker_type: StickerType;
}

/**
 * PostgREST list 응답 원시 형태 — 클라이언트에서 EmotionRecordWithAuthor 로 환산한다.
 */
interface RawListRow extends EmotionRecordRow {
  users: { nickname: string; avatar_url: string | null } | null;
  sticker_reactions: RawStickerRow[];
}

/**
 * 원시 sticker 행 배열을 타입별 count 로 집계한다 (시나리오 1.7).
 */
function aggregateStickers(raw: RawStickerRow[] | null | undefined): StickerAggregate[] {
  if (!raw || raw.length === 0) return [];
  const counts = new Map<StickerType, number>();
  for (const row of raw) {
    const t = row.sticker_type;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([sticker_type, count]) => ({
    sticker_type,
    count,
  }));
}

/**
 * 단일 행을 환산한다 (sticker 집계 포함).
 */
function toWithAuthor(raw: RawListRow): EmotionRecordWithAuthor {
  return {
    ...(raw as EmotionRecordRow),
    users: raw.users ?? null,
    sticker_reactions: aggregateStickers(raw.sticker_reactions),
  };
}

/**
 * 감정 기록 목록을 조회한다 (REQ-EMO-002, 시나리오 1.6/1.7, EC-7/EC-8).
 *
 * 단일 PostgREST 쿼리로:
 * (a) RLS visible 행 조회 (서버 select_visible 정책)
 * (b) users 조인(nickname/avatar_url)
 * (c) sticker_reactions 집계 원시 행
 * 이후 클라이언트에서 page_number > currentPage 기준으로 safe/spoiler 분할.
 *
 * 스포일러 분할 규칙 (EC-7, EC-8):
 * - page_number <= currentPage → safe
 * - page_number > currentPage → spoiler
 * - 단, 본인(user_id === userId) 기록은 currentPage 와 무관하게 항상 safe
 * - page_number 가 null 이면 0 으로 취급
 *
 * @MX:NOTE: [AUTO] 스포일러 분할은 클라이언트 책임 (plan.md 결정 4) — RLS 는 행 격리만 수행하므로 진도 기반 필터링은 앱 계층에서 한다.
 * @MX:SPEC SPEC-EMOTION-001
 */
export async function listEmotionRecords(
  options: ListEmotionOptions,
): Promise<EmotionListResult> {
  const sort: EmotionSortOption = options.sort ?? 'time';
  const client = getSupabaseClient();

  let query = client
    .from('emotion_records')
    .select(EMOTION_LIST_SELECT)
    .eq('book_id', options.bookId);

  if (sort === 'time') {
    query = query.order('created_at', { ascending: false });
  } else {
    // page: page_number ASC 1차, created_at ASC 2차 (시나리오 4.4)
    query = query
      .order('page_number', { ascending: true })
      .order('created_at', { ascending: true });
  }

  let result: { data: RawListRow[] | null; error: unknown };
  try {
    result = await query;
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }

  const rows = result.data ?? [];
  const safe: EmotionRecordWithAuthor[] = [];
  const spoiler: EmotionRecordWithAuthor[] = [];

  for (const raw of rows) {
    const record = toWithAuthor(raw);
    const pageNum = raw.page_number ?? 0;
    const isOwn = raw.user_id === options.userId;
    // 본인 기록은 항상 safe.
    // 타인 기록: currentPage > 0 일 때만 page_number <= currentPage 가 safe (EC-8 경계).
    // currentPage === 0 (독서 전) 이면 타인 기록은 모두 spoiler (EC-7).
    const isSafe =
      isOwn || (options.currentPage > 0 && pageNum <= options.currentPage);
    if (isSafe) {
      safe.push(record);
    } else {
      spoiler.push(record);
    }
  }

  return { safe, spoiler };
}

// ---------------------------------------------------------------------------
// T-004: update / delete (본인만 — RLS 보조 필터로 user_id eq 추가)
// ---------------------------------------------------------------------------

/**
 * UpdateEmotionInput → DB Update payload 변환.
 * page_number, user_id, book_id, id 는 고정이므로 patch 에서 제외한다 (시나리오 1.10).
 * clubId 가 명시된 경우(값 또는 null) 에만 club_id 를 포함한다.
 */
function buildUpdatePatch(patch: UpdateEmotionInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (patch.content !== undefined) {
    payload.content = patch.content;
  }
  if (patch.visibility !== undefined) {
    payload.visibility = patch.visibility;
  }
  if (patch.clubId !== undefined) {
    payload.club_id = patch.clubId;
  }
  return payload;
}

/**
 * 감정 기록을 수정한다 (REQ-EMO-003, 시나리오 1.8/1.9/1.10, 4.5/4.6).
 *
 * 본인만 수정 가능 — id + user_id 복합 조건으로 RLS 보조 필터를 건다.
 * content/visibility/club_id 만 patch 한다. page_number/user_id/book_id 는 고정.
 * RLS 거부(타인 기록) 시 42501 → RLS_DENIED.
 */
export async function updateEmotionRecord(
  id: string,
  patch: UpdateEmotionInput,
  userId: string,
): Promise<void> {
  const client = getSupabaseClient();
  type EmotionUpdate =
    Database['public']['Tables']['emotion_records']['Update'];
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('emotion_records')
      .update(buildUpdatePatch(patch) as EmotionUpdate)
      .eq('id', id)
      .eq('user_id', userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

/**
 * 감정 기록을 삭제한다 (REQ-EMO-004, 시나리오 1.11/1.12).
 *
 * 본인만 삭제 가능 — id + user_id 복합 조건. 연관 sticker_reactions 는
 * FK ON DELETE CASCADE 로 서버가 자동 삭제한다 (시나리오 1.11).
 * RLS 거부(타인 기록) 시 42501 → RLS_DENIED.
 */
export async function deleteEmotionRecord(id: string, userId: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('emotion_records')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error) {
    throw normalizeError(result.error);
  }
}

