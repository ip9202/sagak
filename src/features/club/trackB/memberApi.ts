/**
 * SPEC-CLUB-002 Track B 참가자·상태 관리 API (M3)
 *
 * - getClubMembers: club_members SELECT (해당 모임 전체 멤버) — REQ-CLUBB-013
 * - closeClub: clubs status UPDATE active → closed — REQ-CLUBB-014
 * - reactivateClub: clubs status UPDATE closed → active (양방향 허용) — REQ-CLUBB-015
 * - leaveClub: club_members DELETE 본인 멤버십 — REQ-CLUBB-016
 *
 * 권한 모델 (RLS 단일 신뢰 경로):
 * - club_members SELECT: fn_user_in_club(club_id) true 인 행만 (같은 모임 멤버만).
 * - clubs UPDATE status: auth.uid() = host_id (host 만). 비host 시 0 rows → RLS_DENIED.
 * - club_members DELETE: auth.uid() = user_id (본인 만).
 *
 * 클라이언트 검증은 보조 목적. DB 가 진실.
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import type { ClubMemberRow } from './types';

/** leaveClub 입력 */
export interface LeaveClubInput {
  clubId: string;
  userId: string;
}

/**
 * 모임 멤버 목록을 조회한다 (REQ-CLUBB-013).
 *
 * - club_members 에서 club_id 로 전체 멤버 행을 SELECT.
 * - RLS(club_members_select_same_club — fn_user_in_club)가 같은 모임 멤버만 노출.
 * - host(role='host') 와 member(role='member') 모두 포함.
 *
 * @returns 멤버 행 배열 (빈 결과 가능)
 * @throws AppError RLS/네트워크 에러 시
 */
export async function getClubMembers(
  clubId: string,
): Promise<ClubMemberRow[]> {
  const client = getSupabaseClient();
  let result: { data: ClubMemberRow[] | null; error: unknown };
  try {
    result = await client
      .from('club_members')
      .select('id, club_id, user_id, role, joined_at')
      .eq('club_id', clubId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
  return result.data ?? [];
}

/**
 * 모임을 종료한다 (active → closed, REQ-CLUBB-014).
 *
 * - clubs status 를 'closed' 로 UPDATE.
 * - RLS(clubs_update_own — auth.uid() = host_id)가 host 만 허용. 비host 시 거부.
 * - closed 후 데이터는 보존(FK ON DELETE RESTRICT). 읽기 전용 전환.
 *
 * @throws AppError RLS_DENIED(비host)/네트워크 에러 시
 */
export async function closeClub(clubId: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('clubs')
      .update({ status: 'closed' })
      .eq('id', clubId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
}

/**
 * 종료된 모임을 재활성화한다 (closed → active, REQ-CLUBB-015).
 *
 * - clubs status 를 'active' 로 UPDATE. status ENUM 은 양방향 전환을 허용.
 * - RLS(clubs_update_own)가 host 만 허용.
 *
 * @throws AppError RLS_DENIED(비host)/네트워크 에러 시
 */
export async function reactivateClub(clubId: string): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('clubs')
      .update({ status: 'active' })
      .eq('id', clubId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
}

/**
 * 모임에서 자발적 탈퇴한다 (REQ-CLUBB-016).
 *
 * - club_members 에서 (club_id, user_id=본인) 행을 DELETE.
 * - RLS(club_members_delete_self — auth.uid() = user_id)가 본인 멤버십만 삭제 허용.
 *
 * 주의: host 가 유일 멤버인 상태에서 탈퇴하면 고아 모임이 됨 (미결정 사항 6.2).
 * 본 함수는 경고 로직을 포함하지 않으며, UI 계층(M4)이 사전 경고를 표시한다.
 *
 * @throws AppError RLS_DENIED(타인 멤버십 삭제 시도)/네트워크 에러 시
 */
export async function leaveClub(input: LeaveClubInput): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('club_members')
      .delete()
      .eq('club_id', input.clubId)
      .eq('user_id', input.userId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
}
