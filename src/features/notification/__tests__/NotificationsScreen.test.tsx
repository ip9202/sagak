/**
 * SPEC-NOTIF-001: 알림 센터 화면 단위 테스트 (REQ-NOTIF-005~009)
 *
 * acceptance 시나리오 검증:
 * - N9/N11: 목록 렌더링 + 읽지 않은 알림 시각 구분
 * - N14/N17: 개별/일괄 읽음 처리 호출
 * - N19/N22: 항목 탭 → 읽음 + type별 라우팅 / 폴백
 *
 * queries 모듈과 expo-router 를 mock 하여 순수 UI 동작을 검증한다.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// queries 모듈 mock (Supabase 호출 대신 제어 가능한 데이터 반환)
jest.mock('../queries', () => ({
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

// @MX:NOTE: [AUTO] SPEC-NOTIF-001 Optional: barrel 이 registerToken(registerForPush/usePushTokenRegistration)
//   을 추가하면서 supabase/client → storageAdapter → AsyncStorage 네이티브 의존성이 평가된다.
//   본 화면 테스트는 UI 동작만 검증하므로 스토리지 어댑터/secure-store 를 no-op 로 mock.
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  },
}));

// expo-router router mock
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

import { NotificationsScreen } from '../components/NotificationsScreen';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../queries';
import { router } from 'expo-router';
import type { NotificationRow } from '../types';

const mockedGetNotifications = getNotifications as jest.Mock;
const mockedGetUnreadCount = getUnreadCount as jest.Mock;
const mockedMarkNotificationRead = markNotificationRead as jest.Mock;
const mockedMarkAllNotificationsRead = markAllNotificationsRead as jest.Mock;
const routerPush = router.push as jest.Mock;

function makeNotification(
  overrides: Partial<NotificationRow> = {},
): NotificationRow {
  return {
    id: 'n-1',
    user_id: 'u-1',
    type: 'reading_reminder',
    title: '제목',
    body: '본문',
    ref_id: null,
    is_read: false,
    data: null,
    created_at: '2026-06-20T10:00:00Z',
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetNotifications.mockResolvedValue([]);
  mockedGetUnreadCount.mockResolvedValue(0);
  mockedMarkNotificationRead.mockResolvedValue(undefined);
  mockedMarkAllNotificationsRead.mockResolvedValue(undefined);
});

describe('SPEC-NOTIF-001 NotificationsScreen', () => {
  it('빈 상태 — 새 알림 없음 (N9)', async () => {
    mockedGetNotifications.mockResolvedValue([]);
    const { findByTestId } = renderWithClient(<NotificationsScreen />);
    expect(await findByTestId('notifications-empty')).toBeTruthy();
  });

  it('목록 렌더링 + 읽지 않은 알림 dot 표시 (N9/N11)', async () => {
    mockedGetNotifications.mockResolvedValue([
      makeNotification({ id: 'n-1', is_read: false }),
      makeNotification({ id: 'n-2', is_read: true, title: '읽음' }),
    ]);
    mockedGetUnreadCount.mockResolvedValue(1);
    const { findByTestId, queryByTestId } = renderWithClient(
      <NotificationsScreen />,
    );
    expect(await findByTestId('notification-item-n-1')).toBeTruthy();
    expect(await findByTestId('notification-unread-dot-n-1')).toBeTruthy();
    // 읽은 알림은 dot 없음
    expect(queryByTestId('notification-unread-dot-n-2')).toBeNull();
  });

  it('미읽음 > 0 일 때 모두 읽음 버튼 노출 + 탭 시 일괄 처리 (N17)', async () => {
    mockedGetNotifications.mockResolvedValue([
      makeNotification({ id: 'n-1', is_read: false }),
    ]);
    mockedGetUnreadCount.mockResolvedValue(1);
    const { findByTestId } = renderWithClient(<NotificationsScreen />);
    const btn = await findByTestId('notifications-mark-all');
    fireEvent.press(btn);
    await waitFor(() => {
      expect(mockedMarkAllNotificationsRead).toHaveBeenCalledTimes(1);
    });
  });

  it('미읽음 0 이면 모두 읽음 버튼 미노출', async () => {
    mockedGetNotifications.mockResolvedValue([]);
    mockedGetUnreadCount.mockResolvedValue(0);
    const { findByTestId, queryByTestId } = renderWithClient(
      <NotificationsScreen />,
    );
    await findByTestId('notifications-empty');
    expect(queryByTestId('notifications-mark-all')).toBeNull();
  });

  it('항목 탭 → 읽음 처리 + type별 라우팅 (N14/N19)', async () => {
    mockedGetNotifications.mockResolvedValue([
      makeNotification({
        id: 'n-1',
        type: 'reading_reminder',
        ref_id: '11111111-1111-1111-1111-111111111111',
        is_read: false,
      }),
    ]);
    mockedGetUnreadCount.mockResolvedValue(1);
    const { findByTestId } = renderWithClient(<NotificationsScreen />);
    const item = await findByTestId('notification-item-n-1');
    fireEvent.press(item);
    await waitFor(() => {
      expect(mockedMarkNotificationRead).toHaveBeenCalledWith('n-1');
      expect(routerPush).toHaveBeenCalledWith('/library');
    });
  });

  it('이미 읽은 항목 탭 → markNotificationRead 미호출 (멱등, N15)', async () => {
    mockedGetNotifications.mockResolvedValue([
      makeNotification({ id: 'n-1', is_read: true, type: 'completion' }),
    ]);
    mockedGetUnreadCount.mockResolvedValue(0);
    const { findByTestId } = renderWithClient(<NotificationsScreen />);
    const item = await findByTestId('notification-item-n-1');
    fireEvent.press(item);
    await waitFor(() => {
      expect(mockedMarkNotificationRead).not.toHaveBeenCalled();
    });
    // completion 은 미구현 폴백 → router.push 호출 없음
    expect(routerPush).not.toHaveBeenCalled();
  });
});
