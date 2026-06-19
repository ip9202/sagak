/**
 * 모임 피드 Realtime 구독 훅 (SPEC-FEED-001 T-C1)
 *
 * Supabase Realtime postgres_changes 채널을 통해 emotion_records / sticker_reactions
 * INSERT 이벤트를 구독하고, 이벤트 수신 시 모임 피드 쿼리를 invalidate 한다.
 *
 * 전략 (SPEC plan.md §2.3 리스크1 — 전체 새로고침으로 단순화):
 * - 모든 INSERT 이벤트를 동일 queryKey ['feed','club',clubId] 로 invalidate.
 * - sticker_reactions 의 매핑 실패(F15) 는 전체 재조회 후 피드에 없으면 자연 무시된다.
 * - 클라이언트 멤버십 필터 금지 — 비멤버 이벤트 미수신은 RLS(REQ-DB-016) 에 의존 (F13).
 *
 * 정리 (acceptance §2 LSP gate):
 * - useEffect cleanup 이 channel.unsubscribe() 와 supabase.removeChannel(channel) 을 호출한다.
 *
 * @MX:SPEC SPEC-FEED-001
 */
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';
import { getQueryClient } from '../../lib/query/queryClient';

export interface UseClubFeedRealtimeArgs {
  /** clubs.id */
  clubId: string;
  /** auth.uid() — enabled 판정용 */
  userId: string;
  /** 구독 활성화 여부 (기본: clubId/userId 모두 비어있지 않으면 true) */
  enabled?: boolean;
}

export interface UseClubFeedRealtimeResult {
  /** Realtime 채널 상태 */
  status: 'connecting' | 'connected' | 'error';
  /** 최근 에러 메시지 (status='error' 인 경우) */
  lastError?: string;
}

/** feed 쿼리 캐시 키 (useClubFeed 와 동일 — F9: currentPage 미포함) */
const FEED_QUERY_KEY = (clubId: string): readonly unknown[] =>
  ['feed', 'club', clubId] as const;

/**
 * 모임 피드 Realtime 구독 훅.
 *
 * @returns status — connecting | connected | error
 */
// @MX:WARN: [AUTO] Realtime 채널 수명주기 — cleanup 이 unsubscribe + removeChannel 를 호출하지 않으면 메모리 누수/고스트 구독 발생
// @MX:REASON: useEffect cleanup 누락 시 채널이 해제되지 않아 컴포넌트 언마운트 후에도 웹소켓 연결과 콜백이 잔존한다 (acceptance §2 LSP gate).
export function useClubFeedRealtime(
  args: UseClubFeedRealtimeArgs,
): UseClubFeedRealtimeResult {
  const { clubId, userId } = args;
  const enabled =
    args.enabled ?? (clubId.length > 0 && userId.length > 0);

  const [status, setStatus] = useState<UseClubFeedRealtimeResult['status']>(
    'connecting',
  );
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const client = getSupabaseClient();
    const queryClient = getQueryClient();
    const channel = client.channel(`club-feed-${clubId}`);
    let wasError = false;

    // F12: emotion_records INSERT → 새 기록 실시간 반영 (전체 재조회)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'emotion_records',
        filter: `club_id=eq.${clubId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY(clubId) });
      },
    );

    // F14/F15: sticker_reactions INSERT → 집계 갱신. 매핑 실패는 전체 재조회로 자연 무시.
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sticker_reactions',
      },
      () => {
        queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY(clubId) });
      },
    );

    // F16/F17: 상태 매핑 + 재연결 시 catch-up invalidate
    channel.subscribe((subscribeStatus, err) => {
      if (subscribeStatus === 'SUBSCRIBED') {
        setStatus('connected');
        setLastError(undefined);
        // F17: 단절 후 재연결 시 누락 보완을 위해 전체 재조회
        if (wasError) {
          wasError = false;
          queryClient.invalidateQueries({
            queryKey: FEED_QUERY_KEY(clubId),
          });
        }
      } else if (
        subscribeStatus === 'CHANNEL_ERROR' ||
        subscribeStatus === 'TIMED_OUT'
      ) {
        wasError = true;
        setStatus('error');
        setLastError(
          err?.message ??
            (subscribeStatus === 'TIMED_OUT'
              ? 'Realtime 연결 시간 초과'
              : 'Realtime 연결 오류'),
        );
      }
    });

    return () => {
      // MANDATORY cleanup (acceptance §2 LSP gate) — 메모리 누수 방지
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [clubId, userId, enabled]);

  return { status, lastError };
}
