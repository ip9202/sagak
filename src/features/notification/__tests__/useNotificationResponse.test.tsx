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

  it('W2: setNotificationHandler 가 모듈 로드 시(import) 1회 등록 — Fast Refresh 안전', async () => {
    // handler 는 이제 module scope 에서 import 시 1회 등록된다 (effect lifecycle 에서 분리).
    // resetModules 로 fresh registry 를 만들고 동일 registry 의 mock 을 require 해서 검증.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freshNotifications = require('expo-notifications') as typeof Notifications;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freshMockControl = require('./__mocks__/expo-notifications') as typeof MockControl;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../useNotificationResponse');

    expect(freshNotifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const handler = freshMockControl.getNotificationHandler() as {
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

  // --- malformed notification data 방어 가드 (evaluator S2 + branch coverage) ---

  it('content.data === undefined(페이로드 누락) 시 NOTIFICATION_CENTER_ROUTE 폴백', () => {
    renderHook(() => useNotificationResponse());

    // data 키 자체가 없는 알림 — guard 의 data ?? {} 분기
    MockControl.emitNotificationResponse({
      notification: {
        request: {
          content: {},
        },
      },
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/my/notifications');
  });

  it('content.data.type 이 문자열이 아닌(number 123) 경우 센터 폴백 (guard 가 non-string type 거부)', () => {
    renderHook(() => useNotificationResponse());

    MockControl.emitNotificationResponse({
      notification: {
        request: {
          // type 을 number 로 변조 — typeof data.type === 'string' 가드가 reject
          content: { data: { type: 123, ref_id: 'r1' } },
        },
      },
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/my/notifications');
  });

  it('content.data.ref_id === null(또는 누락) + 유효 type 시 routeForNotification(type, null) 경로로 라우팅', () => {
    renderHook(() => useNotificationResponse());

    // join_request_received + null refId → routeMapper 가 /host-requests (null-refId 폴백) 반환.
    // 본 테스트는 routeMapper 실제 동작(routeMapper.ts line 41-45)에 의존 — lesson #3: 실제 서명 검증.
    MockControl.emitNotificationResponse({
      notification: {
        request: {
          content: { data: { type: 'join_request_received', ref_id: null } },
        },
      },
    });

    // routeForNotification('join_request_received', null) === '/host-requests' (null-refId 폴백)
    expect(mockRouterReplace).toHaveBeenCalledWith('/host-requests');
  });

  it('유효 type 이지만 refId null 시 null 반환하는 type(reading_reminder)은 센터 폴백', () => {
    renderHook(() => useNotificationResponse());

    // reading_reminder + null refId → routeMapper 가 null 반환 → 센터 폴백.
    // routeForNotification('reading_reminder', null) === null (routeMapper.ts line 37-39)
    MockControl.emitNotificationResponse({
      notification: {
        request: {
          content: { data: { type: 'reading_reminder', ref_id: null } },
        },
      },
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/my/notifications');
  });
});
