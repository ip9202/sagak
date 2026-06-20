/**
 * 알림 센터 도메인 공개 API (SPEC-NOTIF-001)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
export type { NotificationType, NotificationRow } from './types';

export {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './queries';

export {
  routeForNotification,
  NOTIFICATION_CENTER_ROUTE,
} from './routeMapper';

export {
  useNotifications,
  NOTIFICATIONS_KEY,
  NOTIFICATION_QUERY_PREFIX,
} from './useNotifications';
export { useUnreadCount, UNREAD_COUNT_KEY } from './useUnreadCount';
export { useMarkAsRead } from './useMarkAsRead';
export { useMarkAllAsRead } from './useMarkAllAsRead';
