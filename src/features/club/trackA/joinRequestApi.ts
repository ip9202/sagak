/**
 * SPEC-CLUB-001 Track A 합류 요청 API (T-004, T-006, T-007)
 *
 * - createJoinRequest: join_requests INSERT (REQ-CLUBA-004/005)
 * - fetchMyJoinRequests: 본인(requester) 요청 조회
 * - fetchIncomingJoinRequests: host 수신 요청 조회
 * - respondToJoinRequest: status UPDATE accepted/declined (REQ-CLUBA-007/008/009)
 * - confirmMembership: club_members 재조회로 트리거 동작 관측 (REQ-CLUBA-010/011/012)
 *
 * 상태 기계 정책 (DB 주도 — 클라이언트 재검증 없음):
 * - INSERT 시 status 는 DB 기본값(pending). payload 에 미포함.
 * - terminal 상태 재설정은 guard_join_request_status_trigger(BEFORE UPDATE)가 차단.
 *   클라이언트는 예외를 normalizeError 로 VALIDATION 처리만.
 * - club_members INSERT 는 join_request_accept_trigger(AFTER UPDATE)가 단독 수행.
 *   클라이언트는 INSERT 하지 않고 confirmMembership 으로 재조회 관측.
 */
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import { AppError } from '../../../errors';
import {
  MESSAGE_MAX_LENGTH,
  validateMessageLength,
  type ClubMemberRow,
  type JoinRequestInsert,
  type JoinRequestRow,
  type JoinResponseAction,
} from './types';

// @MX:NOTE: [AUTO] join_requests SELECT — club_id 임베디드 조인으로 host 필터링 (수신 요청 조회용)
const JOIN_REQUEST_SELECT =
  'id, club_id, requester_id, message, status, created_at, responded_at, club_id!inner(host_id)';

/** createJoinRequest 입력 */
export interface CreateJoinRequestInput {
  clubId: string;
  requesterId: string;
  message: string | null;
}

/** respondToJoinRequest 입력 */
export interface RespondToJoinRequestInput {
  requestId: string;
  status: JoinResponseAction;
}

/** confirmMembership 입력 */
export interface ConfirmMembershipInput {
  clubId: string;
  userId: string;
}

/**
 * 새 합류 요청을 INSERT 한다. status 는 DB 기본값 'pending' (payload 미포함).
 *
 * - E4 이중 방어: message 500자 초과 시 INSERT 전 선검증 (client 측)
 * - UNIQUE(club_id, requester_id) 위반(23505) → VALIDATION (이미 요청 보냄)
 * - RLS(42501) → RLS_DENIED
 *
 * @returns 생성된 join_requests 행
 */
export async function createJoinRequest(
  input: CreateJoinRequestInput,
): Promise<JoinRequestRow> {
  // E4 선검증 (이중 방어 — Edge Function 이 동일 기준으로 재검증)
  const lengthError = validateMessageLength(input.message);
  if (lengthError) {
    const err = new AppError(lengthError, 'MESSAGE_TOO_LONG', 400);
    err.category = 'VALIDATION';
    throw err;
  }

  const payload: JoinRequestInsert = {
    club_id: input.clubId,
    requester_id: input.requesterId,
    message: input.message,
  };

  const client = getSupabaseClient();
  let result: { data: JoinRequestRow | null; error: unknown };
  try {
    result = await client
      .from('join_requests')
      .insert(payload)
      .select(
        'id, club_id, requester_id, message, status, created_at, responded_at',
      )
      .single();
  } catch (error) {
    throw normalizeError(error);
  }

  if (result.error || !result.data) {
    throw normalizeError(result.error ?? new Error('createJoinRequest failed'));
  }
  return result.data;
}

/**
 * 본인(requester)이 보낸 요청 목록을 조회한다.
 * RLS(join_requests_insert_own 계열 select 정책)가 requester 본인 행만 노출.
 */
export async function fetchMyJoinRequests(
  requesterId: string,
): Promise<JoinRequestRow[]> {
  const client = getSupabaseClient();
  let result: { data: JoinRequestRow[] | null; error: unknown };
  try {
    result = await client
      .from('join_requests')
      .select(
        'id, club_id, requester_id, message, status, created_at, responded_at',
      )
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false });
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
  return result.data ?? [];
}

/** join_requests 행 + 임베디드 club(host_id). fetchIncomingJoinRequests 전용. */
type JoinRequestWithClub = Omit<JoinRequestRow, 'club_id'> & {
  club_id: { host_id: string };
};

/**
 * host 가 수신한 요청 목록을 조회한다.
 * club_id.host_id 임베디드 필터로 host 본인 클럽의 요청만 노출 (RLS join_requests_update_host 보조).
 */
export async function fetchIncomingJoinRequests(
  hostId: string,
): Promise<JoinRequestRow[]> {
  const client = getSupabaseClient();
  let result: { data: JoinRequestWithClub[] | null; error: unknown };
  try {
    result = await client
      .from('join_requests')
      .select(JOIN_REQUEST_SELECT)
      .eq('club_id.host_id', hostId)
      .order('created_at', { ascending: false });
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
  // 임베디드 club_id 객체는 호출부에 노출하지 않고 평탄화된 JoinRequestRow 만 반환
  return (result.data ?? []) as unknown as JoinRequestRow[];
}

/**
 * host 가 요청의 status 를 accepted 또는 declined 로 전환한다.
 *
 * - status + responded_at(now) 만 UPDATE. club_members INSERT 는 DB 트리거가 수행.
 * - terminal 상태 재설정 시 guard_join_request_status_trigger(BEFORE UPDATE)가 RAISE EXCEPTION
 *   → PostgREST HTTP 400 → classifyError VALIDATION (REQ-CLUBA-008)
 * - RLS(join_requests_update_host) 위반(42501) → RLS_DENIED (REQ-CLUBA-007)
 */
export async function respondToJoinRequest(
  input: RespondToJoinRequestInput,
): Promise<void> {
  const client = getSupabaseClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from('join_requests')
      .update({
        status: input.status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', input.requestId);
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
}

/**
 * accepted 전환 후 트리거가 추가한 멤버십을 재조회로 관측한다 (REQ-CLUBA-011).
 *
 * - club_members 를 (club_id, user_id) 로 단일 행 조회
 * - 멤버가 아니면 null 반환 (에러 아님 — 트리거가 아직 발화 안 했거나 declined)
 * - RLS(club_members_select_same_club / fn_user_in_club)가 같은 클럽 멤버만 조회 허용
 *
 * @returns 멤버십 행 또는 null
 */
export async function confirmMembership(
  input: ConfirmMembershipInput,
): Promise<ClubMemberRow | null> {
  const client = getSupabaseClient();
  let result: { data: ClubMemberRow | null; error: unknown };
  try {
    result = await client
      .from('club_members')
      .select('id, club_id, user_id, role, joined_at')
      .eq('club_id', input.clubId)
      .eq('user_id', input.userId)
      .maybeSingle();
  } catch (error) {
    throw normalizeError(error);
  }
  if (result.error) throw normalizeError(result.error);
  return result.data ?? null;
}

// MESSAGE_MAX_LENGTH 재export (Edge Function logic 모듈과 공유)
export { MESSAGE_MAX_LENGTH };
