/**
 * @jest-environment jsdom
 *
 * SPEC-NOTIF-001 REQ-NOTIF-004: useNotificationResponse (foreground handler + tap routing) 테스트
 *
 * acceptance N7/N8 검증:
 * - N7: setNotificationHandler foreground 등록, shouldShowAlert: true
 * - N8: 알림 탭 시 routeForNotification(type, ref_id) 경로로 router.replace.
 *        매핑 불가 type → NOTIFICATION_CENTER_ROUTE 폴백.
 * - unmount 시 listener 제거 (remove 호출)
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import { renderHook } from '@testing-library/react';

// expo-router useRouter mock — router.replace 호출을 추적
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockRouterReplace }),
}));

// routeMapper 실제 구현 사용 (단일 진실) — 본 훅은 이를 소비만 한다
import * as Notifications from 'expo-notifications';
import * as MockControl from './__mocks__/expo-notifications';
import { useNotificationResponse } from '../useNotificationResponse';

describe('SPEC-NOTIF-001 REQ-NOTIF-004: useNotificationResponse', () => {
  beforeEach(() => {
    MockControl.__reset();
    mockRouterReplace.mockClear();
  });

  it('setNotificationHandler 가 handleNotification → shouldShowAlert:true 로 1회 등록', async () => {
    renderHook(() => useNotificationResponse());

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = MockControl.getNotificationHandler() as {
      handleNotification: () => Promise<{ shouldShowAlert: boolean }>;
    };
    expect(handler).not.toBeNull();
    const behavior = await handler.handleNotification();
    expect(behavior.shouldShowAlert).toBe(true);
  });

  it('reading_reminder 탭 시 routeForNotification(reading_reminder, r1) 경로로 replace', () => {
    renderHook(() => useNotificationResponse());

    MockControl.emitNotificationResponse({
      notification: {
        request: {
          content: { data: { type: 'reading_reminder', ref_id: 'r1' } },
        },
      },
    });

    // routeForNotification('reading_reminder', 'r1') === '/library'
    expect(mockRouterReplace).toHaveBeenCalledWith('/library');
  });

  it('매핑 불가 type(sticker_received) 시 NOTIFICATION_CENTER_ROUTE 로 폴백', () => {
    renderHook(() => useNotificationResponse());

    MockControl.emitNotificationResponse({
      notification: {
        request: {
          content: { data: { type: 'sticker_received', ref_id: 'r1' } },
        },
      },
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/my/notifications');
  });

  it('unmount 시 등록된 listener 제거 (subscription.remove 호출)', () => {
    const { unmount } = renderHook(() => useNotificationResponse());

    expect(MockControl.getResponseListeners()).toHaveLength(1);
    unmount();

    expect(MockControl.getResponseListeners()).toHaveLength(0);
  });
});
