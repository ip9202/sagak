/**
 * SPEC-CLUB-002 Track B 모임 생성/조회 API (M1)
 *
 * - createClub: clubs INSERT (type='group' 강제, host_id 주입, name 매핑) — REQ-CLUBB-001~005
 * - verifyHostMembership: club_members 재조회로 handle_new_club_host 트리거 동작 관측 — REQ-CLUBB-007
 * - getClubDetail: clubs 단일 행 조회 (모든 authenticated 허용) — REQ-CLUBB-017
 *
 * 아키텍처 (CLUB-001 trackA 와 동일 패턴):
 * - 클라이언트는 clubs INSERT 만 수행. club_members INSERT 는 DB 트리거(handle_new_club_host)가 단독 처리 (REQ-CLUBB-006).
 * - RLS 가 단일 신뢰 경로. 클라이언트 검증은 트리거 실패 감지 목적 (REQ-CLUBB-007).
 *
 * 스키마 주의 (progress.md 참조):
 * - gen-types clubs.Insert 필드: book_id, host_id, name, type, description?, max_members?
 * - SPEC 가정(title/daily_pages/trigger_page/duration_days)은 실제 스키마에 없음. name 사용.
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import { AppError } from '../../../errors';
import {
  TRACKB_REQUIRED_TYPE,
  type ClubInsert,
  type ClubMemberRow,
  type ClubRow,
  type CreateClubInput,
} from './types';

/** createClub 입력 타입 재export (호출부 편의) */
export type { CreateClubInput };

/** verifyHostMembership 입력 */
export interface VerifyHostMembershipInput {
  clubId: string;
  hostId: string;
}

/** clubs SELECT 공통 컬럼 (gen-types Row 전체) */
const CLUB_SELECT = '*';

/**
 * max_members 입력값 검증 (W3).
 *
 * - null 은 허용 (DB DEFAULT 10 또는 NULL)
 * - 정수 1 이상 허용 (상한으로서의 의미)
 * - 음수/0/비정수 시 VALIDATION throw
 *   (0명 출발 정책 REQ-CLUBB-003 은 max_members 미전달로 달성하므로,
 *    0 은 상한으로 의미상 모순 → 거부)
 */
function validateMaxMembers(value: number | null | undefined): void {
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || value < 1) {
    const err = new AppError(
      'maxMembers 은(는) 1 이상의 정수여야 합니다',
      'VALIDATION_ERROR',
      400,
    );
    err.category = 'VALIDATION';
    throw err;
  }
}

/**
 * Track B 모임을 생성한다 (REQ-CLUBB-001~005).
 *
 * - type 은 'group' 으로 강제 (REQ-CLUBB-002). 호출부에서 전달받지 않는다.
 * - host_id 는 입력값 그대로 INSERT 본문에 포함 — RLS WITH CHECK(host_id = auth.uid()) 를 통과해야 함.
 * - 0명 출발 허용: max_members 미전달 시 payload 에 포함하지 않음 (REQ-CLUBB-003).
 * - club_members INSERT 는 DB 트리거(handle_new_club_host)가 단독 수행 — 클라이언트 개입 없음 (REQ-CLUBB-006).
 *
 * @returns 생성된 clubs 행 (.select().single())
 * @throws AppError RLS/네트워크/검증 에러 시
 */
export async function createClub(input: CreateClubInput): Promise<ClubRow> {
  // W3: max_members 입력 검증 (음수/0/비정수 거부, 0명 출발은 미전달로 달성)
  validateMaxMembers(input.maxMembers);

  const payload: ClubInsert = {
    book_id: input.bookId,
    host_id: input.hostId,
    name: input.name,
    type: TRACKB_REQUIRED_TYPE,
  };
  if (input.description !== undefined) {
    payload.description = input.description;
  }
  if (input.maxMembers !== undefined) {
    payload.max_members = input.maxMembers;
  }

  const client = getSupabaseClient();
  let result: { data: ClubRow | null; error: unknown };
  try {
    result = await client
      .from('clubs')
      .insert(payload)
      .select(CLUB_SELECT)
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('createClub failed'));
  }
  return result.data;
}

/**
 * clubs INSERT 성공 후 host 멤버십 행 존재 여부를 확인한다 (REQ-CLUBB-007).
 *
 * - handle_new_club_host 트리거가 동일 트랜잭션에서 (club_id, host_id, role='host') 행을 생성했는지 검증.
 * - 행이 존재하면 true (트리거 정상 동작). 없으면 false (트리거 미배포/실패 — 사전 감지).
 * - RLS(club_members_select_same_club / fn_user_in_club)가 host 본인 행 조회를 허용 (REQ-CLUBB-008).
 *
 * @returns host 멤버십 존재 여부
 * @throws AppError RLS/네트워크 에러 시
 */
export async function verifyHostMembership(
  input: VerifyHostMembershipInput,
): Promise<boolean> {
  const client = getSupabaseClient();
  let result: { data: ClubMemberRow | null; error: unknown };
  try {
    result = await client
      .from('club_members')
      .select('id, club_id, user_id, role, joined_at')
      .eq('club_id', input.clubId)
      .eq('user_id', input.hostId)
      .eq('role', 'host')
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
  return result.data !== null;
}

/**
 * 모임 상세를 조회한다 (REQ-CLUBB-017).
 *
 * - clubs 단일 행 조회 (.eq('id').single()).
 * - RLS(clubs_select_all — authenticated SELECT USING(true))가 모든 사용자 조회를 허용 (공개 탐색).
 *
 * @returns clubs 행
 * @throws AppError NOT_FOUND/RLS/네트워크 에러 시
 */
export async function getClubDetail(clubId: string): Promise<ClubRow> {
  const client = getSupabaseClient();
  let result: { data: ClubRow | null; error: unknown };
  try {
    result = await client
      .from('clubs')
      .select(CLUB_SELECT)
      .eq('id', clubId)
      .single();
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('getClubDetail failed'));
  }
  return result.data;
}
