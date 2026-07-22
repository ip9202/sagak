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
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
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

// SPEC-NOTIF-002: 알림 센터가 useSession(userId) + useNotificationsRealtime 를 마운트한다.
// Realtime 동작은 별도 테스트(useNotificationsRealtime.test.tsx)에서 검증하므로
// 화면 테스트에서는 두 훅을 no-op 로 mock 하여 UI 동작에 집중한다.
jest.mock('../../../auth/useSession', () => ({
  useSession: () => ({ user: { id: 'u-1' } }),
}));
jest.mock('../useNotificationsRealtime', () => ({
  useNotificationsRealtime: () => ({ status: 'connected', lastError: undefined }),
}));

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

  // --- SPEC-NOTIF-002 REQ-NOTIF2-003: pull-to-refresh (RefreshControl) ---

  it('N2-8: RefreshControl 부착 + pull-to-refresh 시 useNotifications refetch 호출 + 스피너 표시/해제', async () => {
    mockedGetNotifications.mockResolvedValue([makeNotification({ id: 'n-1' })]);
    mockedGetUnreadCount.mockResolvedValue(1);
    const result = renderWithClient(<NotificationsScreen />);
    await result.findByTestId('notification-item-n-1'); // 초기 로드 대기

    const refreshControlProps = () =>
      result.getByTestId('notifications-scroll').props.refreshControl.props;

    // RefreshControl 부착 확인 + 초기 refreshing=false
    expect(refreshControlProps().refreshing).toBe(false);
    expect(typeof refreshControlProps().onRefresh).toBe('function');

    // refetch 가 갱신 중에 머물도록 deferred promise 사용
    let resolveRefetch!: (v: NotificationRow[]) => void;
    const refetchBefore = mockedGetNotifications.mock.calls.length;
    mockedGetNotifications.mockImplementationOnce(
      () =>
        new Promise<NotificationRow[]>((resolve) => {
          resolveRefetch = resolve;
        }),
    );

    // pull-to-refresh → onRefresh
    act(() => {
      refreshControlProps().onRefresh();
    });

    // 갱신 중 → 스피너 표시 (refreshing=true) + refetch(getNotifications) 재호출
    expect(refreshControlProps().refreshing).toBe(true);
    await waitFor(() => {
      expect(mockedGetNotifications.mock.calls.length).toBeGreaterThan(
        refetchBefore,
      );
    });

    // 재조회 완료 → 스피너 해제 (refreshing=false)
    resolveRefetch([makeNotification({ id: 'n-1' })]);
    await waitFor(() => {
      expect(refreshControlProps().refreshing).toBe(false);
    });
  });

  it('N2-9: 갱신 중 refetch 에러 시 throw/크래시 없이 이전 목록 상태 유지', async () => {
    mockedGetNotifications.mockResolvedValue([makeNotification({ id: 'n-1' })]);
    mockedGetUnreadCount.mockResolvedValue(1);
    const result = renderWithClient(<NotificationsScreen />);
    await result.findByTestId('notification-item-n-1'); // 이전 상태(데이터) 로드

    const refreshControlProps = () =>
      result.getByTestId('notifications-scroll').props.refreshControl.props;

    // refetch 가 reject 되도록 설정
    mockedGetNotifications.mockImplementationOnce(async () => {
      throw new Error('network');
    });

    // 에러가 사용자에게 throw 되지 않고 조용히 처리되어야 한다 (N2-9).
    await act(async () => {
      refreshControlProps().onRefresh();
    });

    // 이전 데이터 유지 (항목 렌더링, 에러 뷰로 전환되지 않음) + 스피너 해제
    await waitFor(() => {
      expect(result.queryByTestId('notification-item-n-1')).toBeTruthy();
      expect(result.queryByTestId('notifications-error')).toBeNull();
      expect(refreshControlProps().refreshing).toBe(false);
    });
  });
});
