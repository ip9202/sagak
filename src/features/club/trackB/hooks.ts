/**
 * SPEC-CLUB-002 Track B React Query 훅 (M4 — UI 계층)
 *
 * 위임 1~3(데이터 계층)의 API 를 React Query 로 감싸 캐싱/분기/invalidation 을 담당한다.
 *
 * 계약:
 * - useHostClubs: 현재 사용자가 host 인 모임 목록 조회 (clubs SELECT + host_id 필터)
 *   queryKey=['club','trackb','host',userId]
 * - useClubDetail: getClubDetail 단일 행. queryKey=['club','trackb','detail',clubId]
 * - useClubMembers: getClubMembers. queryKey=['club','trackb','members',clubId]
 * - useCreateClub: createClub → verifyHostMembership 검증 → (진도 계획 있으면) updateProgress 2단계
 *   성공 후 host/detail 캐시 invalidate
 * - useUpdateProgress: updateProgress. 성공 후 detail 캐시 invalidate
 * - useCloseClub / useReactivateClub: 상태 전환. 성공 후 detail/host 캐시 invalidate
 * - useLeaveClub: 본인 탈퇴. 성공 후 host/detail/members 캐시 invalidate
 *
 * @MX:SPEC SPEC-CLUB-002
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { normalizeError } from '../../../lib/api/errors';
import {
  closeClub,
  createClub,
  getClubDetail,
  getClubMembers,
  leaveClub,
  reactivateClub,
  updateProgress,
  verifyHostMembership,
  type CreateClubInput,
  type LeaveClubInput,
} from './api';
import type {
  ClubRow,
  CreateClubInput as DomainCreateClubInput,
} from './types';

/**
 * 호스트 모임 목록 + 멤버 수.
 *
 * useHostClubs 가 `clubs` 행에 더해 `club_members` 집계(count) 를 단일 라운드트립으로
 * 함께 가져온 결과 행. `member_count` 는 queryFn 에서 PostgREST embedded aggregate
 * (`club_members(count)`) 결과를 평탄화한 값이다.
 *
 * @MX:SPEC SPEC-UI-002
 */
export type HostClubWithCount = ClubRow & { member_count: number };

// @MX:NOTE: [AUTO] trackB 캐시 queryKey 접두부 — host/detail/members 계열을 일괄 매칭용
const CLUBB_KEY_ROOT = ['club', 'trackb'] as const;

/**
 * 모임 생성 시 UI 폼에서 수집하는 전체 입력.
 *
 * 도메인 CreateClubInput(name/description/maxMembers) + 진도 계획(dailyPages/triggerPage).
 * 진도 계획 컬럼은 gen-types clubs.Insert 에 노출되지 않아(데이터 계층 메모 참조),
 * createClub 이후 updateProgress 로 별도 UPDATE 한다 (2단계 시퀀스).
 */
export interface ClubFormInput {
  bookId: string;
  hostId: string;
  name: string;
  description?: string | null;
  maxMembers?: number | null;
  dailyPages?: number | null;
  triggerPage?: number | null;
}

/**
 * 현재 사용자가 host 인 모임 목록을 멤버 수와 함께 조회한다.
 *
 * - clubs SELECT 를 host_id 로 필터.
 * - PostgREST embedded aggregate `club_members(count)` 로 각 모임의 멤버 수를
 *   본문 목록과 단일 라운드트립으로 함께 가져온다 (N+1 회피). clubs.id ←
 *   club_members.club_id FK 를 PostgREST 가 자동 탐지한다.
 * - RLS(clubs_select_all — USING(true))가 모든 authenticated 의 clubs SELECT 를 허용.
 *   host_id 필터는 클라이언트 보조 검증. 빈 userId 면 비활성화.
 * - club_members SELECT RLS(fn_user_in_club)는 같은 모임 멤버만 노출하나,
 *   host 본인이 모든 host 모임에 가입되어 있으므로 host 모임의 멤버 수는 정확.
 * - 최신 생성순(created_at DESC).
 *
 * @MX:ANCHOR: [AUTO] useHostClubs — 모임 탭 목록 단일 진입점. member_count 계약이 ClubsScreen ClubCard 에 전파된다.
 * @MX:REASON: clubs 목록 + 멤버 수를 단일 라운드트립으로 결합하며, select 문자열/평탄화 로직이 바뀌면 ClubsScreen 의 `멤버 N명` 표시가 깨진다.
 */
export function useHostClubs(userId: string) {
  return useQuery<HostClubWithCount[]>({
    queryKey: [...CLUBB_KEY_ROOT, 'host', userId],
    enabled: userId.length > 0,
    queryFn: async (): Promise<HostClubWithCount[]> => {
      const client = getSupabaseClient();
      // PostgREST embedded aggregate — 단일 라운드트립으로 clubs 본문 + club_members 집계.
      let result: {
        data:
          | (ClubRow & {
              club_members: { count: number }[] | null;
            })[]
          | null;
        error: unknown;
      };
      try {
        result = await client
          .from('clubs')
          .select('*, club_members(count)')
          .eq('host_id', userId)
          .order('created_at', { ascending: false });
      } catch (error) {
        throw normalizeError(error);
      }
      if (result.error) throw normalizeError(result.error);
      // club_members 집계 배열 → 단일 member_count 로 평탄화 (누락/에러 시 0).
      const rows = result.data ?? [];
      return rows.map((row) => {
        const count = row.club_members?.[0]?.count;
        const { club_members: _drop, ...rest } = row;
        return {
          ...rest,
          member_count: typeof count === 'number' ? count : 0,
        };
      });
    },
  });
}

/**
 * 모임 상세를 조회한다 (REQ-CLUBB-017).
 * 빈 clubId 면 비활성화.
 */
export function useClubDetail(clubId: string) {
  return useQuery<ClubRow>({
    queryKey: [...CLUBB_KEY_ROOT, 'detail', clubId],
    enabled: clubId.length > 0,
    queryFn: () => getClubDetail(clubId),
  });
}

/**
 * 모임 멤버 목록을 조회한다 (REQ-CLUBB-013).
 * 빈 clubId 면 비활성화.
 */
export function useClubMembers(clubId: string) {
  return useQuery({
    queryKey: [...CLUBB_KEY_ROOT, 'members', clubId],
    enabled: clubId.length > 0,
    queryFn: () => getClubMembers(clubId),
  });
}

/**
 * 모임을 생성한다 (REQ-CLUBB-001~008).
 *
 * 2단계 시퀀스:
 * 1. createClub(name/description/maxMembers) — host_id 주입, type='group' 강제
 * 2. verifyHostMembership — handle_new_club_host 트리거 동작 관측 (REQ-CLUBB-007)
 * 3. (진도 계획 있으면) updateProgress(dailyPages/triggerPage)
 *
 * 검증 실패(트리거 미동작) 시에도 clubs 행은 이미 생성됐으므로 에러를 throw 한다.
 * 성공 후 host/detail 캐시를 invalidate 한다.
 *
 * @MX:ANCHOR: [AUTO] useCreateClub — 모임 생성 화면(ClubCreateScreen) 의 단일 진입점. 2단계 시퀀스 계약이 상세/목록 화면에 전파된다.
 * @MX:REASON: ClubsScreen/NewClubCTA 가 이 훅의 반환(newClub.id)에 의존하며, 시퀀스 순서가 바뀌거나 검증 단계가 생략되면 트리거 미배포가 미감지 상태로 남는다.
 */
export function useCreateClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClubFormInput): Promise<ClubRow> => {
      const domainInput: CreateClubInput = {
        bookId: input.bookId,
        hostId: input.hostId,
        name: input.name,
      };
      if (input.description !== undefined) {
        domainInput.description = input.description;
      }
      if (input.maxMembers !== undefined) {
        domainInput.maxMembers = input.maxMembers;
      }

      const newClub = await createClub(domainInput);

      const hostOk = await verifyHostMembership({
        clubId: newClub.id,
        hostId: input.hostId,
      });
      if (!hostOk) {
        throw normalizeError(
          new Error(
            '모임은 생성됐으나 host 멤버십 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
          ),
        );
      }

      if (
        (input.dailyPages !== undefined && input.dailyPages !== null) ||
        (input.triggerPage !== undefined && input.triggerPage !== null)
      ) {
        await updateProgress(
          newClub.id,
          { dailyPages: input.dailyPages, triggerPage: input.triggerPage },
          { status: newClub.status },
        );
      }

      return newClub;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CLUBB_KEY_ROOT, 'host'] });
      qc.invalidateQueries({ queryKey: [...CLUBB_KEY_ROOT, 'detail'] });
    },
  });
}

/** useUpdateProgress 입력 */
export type UpdateProgressVariables = {
  clubId: string;
  dailyPages?: number | null;
  triggerPage?: number | null;
  status?: string;
};

/**
 * 모임 진도를 업데이트한다 (REQ-CLUBB-009).
 * 성공 후 detail 캐시를 invalidate 한다.
 */
export function useUpdateProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: UpdateProgressVariables) =>
      updateProgress(
        vars.clubId,
        { dailyPages: vars.dailyPages, triggerPage: vars.triggerPage },
        { status: vars.status },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [...CLUBB_KEY_ROOT, 'detail', vars.clubId],
      });
    },
  });
}

/**
 * 모임을 종료한다 (active → closed, REQ-CLUBB-014).
 * 성공 후 detail/host 캐시를 invalidate 한다.
 */
export function useCloseClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) => closeClub(clubId),
    onSuccess: (_data, clubId) => {
      qc.invalidateQueries({
        queryKey: [...CLUBB_KEY_ROOT, 'detail', clubId],
      });
      qc.invalidateQueries({ queryKey: [...CLUBB_KEY_ROOT, 'host'] });
    },
  });
}

/**
 * 종료된 모임을 재활성화한다 (closed → active, REQ-CLUBB-015).
 * 성공 후 detail/host 캐시를 invalidate 한다.
 */
export function useReactivateClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clubId: string) => reactivateClub(clubId),
    onSuccess: (_data, clubId) => {
      qc.invalidateQueries({
        queryKey: [...CLUBB_KEY_ROOT, 'detail', clubId],
      });
      qc.invalidateQueries({ queryKey: [...CLUBB_KEY_ROOT, 'host'] });
    },
  });
}

/**
 * 모임에서 자발적 탈퇴한다 (REQ-CLUBB-016).
 * 성공 후 host/detail/members 캐시를 invalidate 한다.
 */
export function useLeaveClub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaveClubInput) => leaveClub(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [...CLUBB_KEY_ROOT, 'detail', vars.clubId],
      });
      qc.invalidateQueries({
        queryKey: [...CLUBB_KEY_ROOT, 'members', vars.clubId],
      });
      qc.invalidateQueries({ queryKey: [...CLUBB_KEY_ROOT, 'host'] });
    },
  });
}

// 도메인 CreateClubInput 재export (호출부 호환)
export type { DomainCreateClubInput };
