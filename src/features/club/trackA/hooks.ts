/**
 * SPEC-CLUB-001 Track A React Query 훅 (T-009, M2 — UI 계층)
 *
 * 위임 1(데이터 계층)의 API 를 React Query 로 감싸 캐싱/분기/invalidation 을 담당한다.
 *
 * 계약:
 * - useActiveReaders: fetchActiveReaders + resolveClubIdsForUsers 조합 → ActiveReader[]
 *   queryKey=['club','readers',bookId], 빈 bookId 시 enabled:false
 * - useCreateJoinRequest: ActiveReader.club_id 로 분기
 *   · club_id !== null → createJoinRequest({clubId,...})
 *   · club_id === null → processJoinRequestViaEdgeFunction({targetUserId,bookId,...})
 *   성공 후 readers 캐시 invalidate (중복 요청 방지 상태 갱신)
 * - useRespondToJoinRequest: accepted/declined 전환. 성공 후 incoming 캐시 invalidate
 * - useConfirmMembership: confirmMembership 조회. queryKey=['club','membership',{clubId,userId}]
 *
 * @MX:SPEC SPEC-CLUB-001
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmMembership,
  createJoinRequest,
  respondToJoinRequest,
  type ConfirmMembershipInput,
  type CreateJoinRequestInput,
  type RespondToJoinRequestInput,
} from './joinRequestApi';
import {
  fetchActiveReaders,
  resolveClubIdsForUsers,
} from './readersApi';
import {
  processJoinRequestViaEdgeFunction,
  type ProcessJoinRequestInput,
} from './processJoinRequest';
import type { ActiveReader } from './types';

// @MX:NOTE: [AUTO] club 캐시 queryKey 접두부 — readers/incoming/membership 계열을 일괄 매칭용
const CLUB_KEY_ROOT = ['club'] as const;

/**
 * 특정 책의 공개 독자 목록을 조회한다.
 * fetchActiveReaders 결과에 resolveClubIdsForUsers 로 club_id 매핑을 얹어 ActiveReader[] 반환.
 * 빈 bookId 면 쿼리를 비활성화한다.
 *
 * @MX:ANCHOR: [AUTO] useActiveReaders — ReadersScreen(T-010) 의 단일 데이터 소스. club_id 분기 계약이 JoinRequestSheet(T-011) 에 전파된다.
 * @MX:REASON: ReadersScreen 이 이 훅의 반환 형태(ActiveReader.club_id nullable)에 의존하며, 분기 로직이 바뀌면 요청 전송 경로(create vs edge)가 잘못 라우팅된다.
 */
export function useActiveReaders(bookId: string) {
  return useQuery<ActiveReader[]>({
    queryKey: ['club', 'readers', bookId],
    enabled: bookId.length > 0,
    queryFn: async (): Promise<ActiveReader[]> => {
      const rows = await fetchActiveReaders(bookId);
      if (rows.length === 0) return [];
      // user_books_public.user_id 는 string | null(gen-types)이나 뷰 정책상 null 이 아님.
      // null 행은 방어적으로 제외하고 매핑한다.
      const userIds = rows
        .map((r) => r.user_id)
        .filter((id): id is string => id != null);
      const clubMap = await resolveClubIdsForUsers(userIds);
      return rows.map((r) => ({
        user_id: r.user_id ?? '',
        book_id: r.book_id ?? bookId,
        current_page: r.current_page,
        started_reading_at: r.started_reading_at,
        club_id: r.user_id ? (clubMap[r.user_id] ?? null) : null,
      }));
    },
  });
}

/** useCreateJoinRequest 입력 (club_id 분기용 discriminated union) */
export type CreateJoinRequestVariables =
  | ({ clubId: string } & Omit<CreateJoinRequestInput, 'clubId'>)
  | ({ targetUserId: string; bookId: string } & Omit<
      ProcessJoinRequestInput,
      'targetUserId' | 'bookId'
    >);

/**
 * 합류 요청을 생성한다. club_id 유무에 따라 경로가 분기된다.
 * - clubId 제공 → createJoinRequest (기존 그룹)
 * - targetUserId+bookId 제공 → Edge Function (lazy 그룹 생성)
 *
 * 성공 후 readers 캐시를 invalidate 하여 UI 가 최신 상태로 갱신되게 한다.
 */
export function useCreateJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: CreateJoinRequestVariables) => {
      if ('clubId' in vars) {
        return createJoinRequest({
          clubId: vars.clubId,
          requesterId: vars.requesterId,
          message: vars.message,
        });
      }
      return processJoinRequestViaEdgeFunction({
        targetUserId: vars.targetUserId,
        bookId: vars.bookId,
        requesterId: vars.requesterId,
        message: vars.message,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CLUB_KEY_ROOT, 'readers'] });
    },
  });
}

/** useRespondToJoinRequest 입력 */
export type RespondToJoinRequestVariables = RespondToJoinRequestInput;

/**
 * host 가 수신 요청을 승인/거절한다.
 * 성공 후 incoming(수신 요청) 캐시를 invalidate 한다.
 */
export function useRespondToJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: RespondToJoinRequestVariables) =>
      respondToJoinRequest(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...CLUB_KEY_ROOT, 'incoming'] });
    },
  });
}

/**
 * accepted 전환 후 트리거가 추가한 멤버십을 관측한다 (REQ-CLUBA-011).
 * 빈 clubId 면 비활성화. queryKey 는 clubId+userId 조합.
 */
export function useConfirmMembership(clubId: string, userId: string) {
  return useQuery({
    queryKey: ['club', 'membership', { clubId, userId }],
    enabled: clubId.length > 0 && userId.length > 0,
    queryFn: () =>
      confirmMembership({ clubId, userId } satisfies ConfirmMembershipInput),
  });
}
