/**
 * 알림 센터 Realtime 구독 훅 (SPEC-NOTIF-002 REQ-NOTIF2-001)
 *
 * Supabase Realtime postgres_changes 채널을 통해 notifications INSERT 이벤트를 구독하고,
 * 이벤트 수신 시 알림 도메인 쿼리(목록/읽지 않은 카운트)를 invalidate 한다.
 *
 * 정준 패턴 준용 (SPEC-NOTIF-002 plan.md §A.4 / spec.md §A.3):
 * - src/features/feed/useClubFeedRealtime.ts 의 channel.on(...) → subscribe(statusCb) +
 *   cleanup(unsubscribe + removeChannel) 구조를 notifications 테이블에 그대로 적용한다.
 *
 * 전략:
 * - INSERT 이벤트를 [NOTIFICATION_QUERY_PREFIX] 로 invalidate 한다 (invalidate ONLY — setQueryData 금지, AP-2).
 *   동일 prefix 는 목록(NOTIFICATIONS_KEY) + 읽지 않은 카운트(UNREAD_COUNT_KEY) 모두를 무효화한다.
 * - client-side filter user_id=eq.${userId} 로 불필요 이벤트를 줄인다.
 * - 타인 알림 미수신은 RLS(notifications_select_own, REQ-DB-021)가 브로드캐스트 단계에서 게이트한다 (N2-2).
 *   (supabase/migrations/20260722000001_enable_realtime_notifications.sql 이 publication 구성 +
 *    기존 notifications_select_own RLS 정책이 broadcast 를 게이트한다.)
 *
 * 정리 (acceptance §2 LSP gate, N2-3):
 * - useEffect cleanup 이 channel.unsubscribe() 와 supabase.removeChannel(channel) 을 호출한다.
 *
 * @MX:SPEC SPEC-NOTIF-002
 */
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';
import { getQueryClient } from '../../lib/query/queryClient';
import { NOTIFICATION_QUERY_PREFIX } from './useNotifications';

export interface UseNotificationsRealtimeArgs {
  /** auth.uid() — 구독 대상 사용자 + enabled 판정용 */
  userId: string;
  /** 구독 활성화 여부 (기본: userId 가 비어있지 않으면 true) */
  enabled?: boolean;
}

export interface UseNotificationsRealtimeResult {
  /** Realtime 채널 상태 */
  status: 'connecting' | 'connected' | 'error';
  /** 최근 에러 메시지 (status='error' 인 경우) */
  lastError?: string;
}

/**
 * 알림 센터 Realtime 구독 훅.
 * 알림 센터 화면 진입 시 호출하여 새 알림 INSERT 를 즉시 캐시에 반영한다.
 *
 * @returns status — connecting | connected | error
 */
// @MX:WARN: [AUTO] Realtime 채널 수명주기 — cleanup 이 unsubscribe + removeChannel 를 호출하지 않으면 메모리 누수/고스트 구독 발생
// @MX:REASON: useEffect cleanup 누락 시 채널이 해제되지 않아 화면 이탈 후에도 웹소켓 연결과 콜백이 잔존한다 (N2-3, acceptance §2 LSP gate).
export function useNotificationsRealtime(
  args: UseNotificationsRealtimeArgs,
): UseNotificationsRealtimeResult {
  const { userId } = args;
  const enabled = args.enabled ?? userId.length > 0;

  const [status, setStatus] = useState<
    UseNotificationsRealtimeResult['status']
  >('connecting');
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const client = getSupabaseClient();
    const queryClient = getQueryClient();
    const channel = client.channel(`notifications-realtime-${userId}`);
    let wasError = false;

    // N2-1: notifications INSERT → 알림 목록/카운트 재조회 (전체 invalidate)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        queryClient.invalidateQueries({
          queryKey: [NOTIFICATION_QUERY_PREFIX],
        });
      },
    );

    // 상태 매핑 + 재연결 시 catch-up invalidate
    channel.subscribe((subscribeStatus, err) => {
      if (subscribeStatus === 'SUBSCRIBED') {
        setStatus('connected');
        setLastError(undefined);
        // 단절 후 재연결 시 누락 보완을 위해 전체 재조회
        if (wasError) {
          wasError = false;
          queryClient.invalidateQueries({
            queryKey: [NOTIFICATION_QUERY_PREFIX],
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
              ? '알림 실시간 연결 시간 초과'
              : '알림 실시간 연결 오류'),
        );
      }
    });

    return () => {
      // MANDATORY cleanup (N2-3, acceptance §2 LSP gate) — 메모리 누수 / 고스트 구독 방지
      channel.unsubscribe();
      client.removeChannel(channel);
    };
  }, [userId, enabled]);

  return { status, lastError };
}
