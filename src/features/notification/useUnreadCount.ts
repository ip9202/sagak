/**
 * 읽지 않은 알림 카운트 React Query 훅 (SPEC-NOTIF-001 REQ-NOTIF-006)
 *
 * 배지/헤더 아이콘에 사용. 읽음 처리 후 invalidate 되어 갱신된다.
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useQuery } from '@tanstack/react-query';
import { getUnreadCount } from './queries';
import { NOTIFICATION_QUERY_PREFIX } from './useNotifications';

export const UNREAD_COUNT_KEY = [
  NOTIFICATION_QUERY_PREFIX,
  'unread',
] as const;

export function useUnreadCount(): ReturnType<typeof useQuery<number, Error>> {
  return useQuery<number, Error>({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: getUnreadCount,
  });
}
