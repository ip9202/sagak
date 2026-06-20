/**
 * useNotificationResponse: foreground 표시 + 알림 탭 라우팅 (SPEC-NOTIF-001 REQ-NOTIF-004)
 *
 * - N7: setNotificationHandler 로 foreground 알림 표시(shouldShowAlert: true) 등록.
 *   manager-quality W2: handler 등록은 module scope(import 시 1회)에서 수행 —
 *   Fast Refresh 가 module state 를 reset 하면서 component 가 persist 되는 경우
 *   effect 기반 등록이 누락/중복될 수 있어, import 시 1회 실행으로 회피한다.
 * - N8: 알림 탭(addNotificationResponseReceivedListener) 시 routeForNotification(type, ref_id)
 *        경로로 router.replace. 매핑 불가 시 NOTIFICATION_CENTER_ROUTE 폴백.
 *
 * @MX:NOTE: [AUTO] setNotificationHandler 는 모듈 로드(import) 시 1회만 등록 —
 *   Fast Refresh/effect lifecycle 분리로 module state reset 시에도 안전.
 * @MX:SPEC SPEC-NOTIF-001
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { routeForNotification, NOTIFICATION_CENTER_ROUTE } from './routeMapper';
import type { NotificationType } from './types';

// module scope — 등록은 import 시 1회. Fast Refresh 안전 (effect lifecycle 과 분리).
// N7: foreground 알림 수신 시 alert/sound/badge 표시 (NotificationBehavior 전체 필수).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 알림 탭 라우팅을 설정한다. foreground handler 등록은 import 시 이미 완료된다.
 * RootLayout 내부(AuthProvider 안)에서 1회 호출.
 */
export function useNotificationResponse(): void {
  const router = useRouter();

  useEffect(() => {
    // N8: 알림 탭 시 routeForNotification 경로로 이동. 매핑 불가 시 센터 폴백.
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data ?? {};
        const type = typeof data.type === 'string' ? (data.type as NotificationType) : null;
        const refId =
          typeof data.ref_id === 'string' || data.ref_id === null
            ? (data.ref_id as string | null)
            : null;
        const route = type ? routeForNotification(type, refId) : null;
        router.replace(route ?? NOTIFICATION_CENTER_ROUTE);
      },
    );

    return () => {
      subscription.remove();
    };
  }, [router]);
}
