/**
 * "모두 읽음" 일괄 읽음 처리 React Query 뮤테이션 (SPEC-NOTIF-001 REQ-NOTIF-008)
 *
 * 성공 시 알림 도메인 쿼리(목록/카운트)를 invalidate 한다.
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { markAllNotificationsRead } from './queries';
import { NOTIFICATION_QUERY_PREFIX } from './useNotifications';

export function useMarkAllAsRead(): ReturnType<
  typeof useMutation<void, Error, void, unknown>
> {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: [NOTIFICATION_QUERY_PREFIX],
      });
    },
  });
}
