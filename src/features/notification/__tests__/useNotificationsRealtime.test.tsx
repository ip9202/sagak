/**
 * useNotificationsRealtime 훅 단위 테스트 (SPEC-NOTIF-002 REQ-NOTIF2-001)
 *
 * 검증 대상 (인수 시나리오):
 * - N2-1: notifications INSERT(user_id 일치) → queryClient.invalidateQueries([NOTIFICATION_QUERY_PREFIX])
 * - N2-3: 언마운트 시 channel.unsubscribe() + client.removeChannel(channel) 호출 (cleanup 누수 방지)
 * - N2-4: userId 비활성(빈 값) → 채널 생성하지 않음 (비활성 시 구독 부재)
 *
 * RLS(N2-2) 는 서버에서 시행되므로 클라이언트 단위 테스트 범위가 아니다 (acceptance §3.2 통합).
 * 본 훅은 이벤트 핸들링만 검증하며, 타인 알림 미수신은 RLS 정책(notifications_select_own, REQ-DB-021)에 의존한다.
 *
 * 정준 패턴 준용: useClubFeedRealtime.test.tsx 와 동일한 모킹 채널 구조.
 *
 * @jest-environment jsdom
 * @MX:SPEC SPEC-NOTIF-002
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// getQueryClient 싱글턴이 매 테스트마다 fresh 한 QueryClient 를 반환하도록 덮어쓴다.
let invalidateSpy: jest.SpyInstance;
let mockQueryClient: QueryClient;
jest.mock('../../../lib/query/queryClient', () => ({
  getQueryClient: () => mockQueryClient,
}));

// getSupabaseClient 가 chainable mock channel 을 반환하도록 한다.
type ChangeCallback = (payload: unknown) => void;
type SubscriptionCallback = (status: string, err: Error | null) => void;

interface CapturedChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
}
interface FakeClient {
  channel: jest.Mock;
  removeChannel: jest.Mock;
}

let capturedChannel: CapturedChannel;
let changeCallbacks: { filter: unknown; cb: ChangeCallback }[];
let subscriptionCallbacks: SubscriptionCallback[];
let mockFakeClient: FakeClient;

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: () => mockFakeClient,
}));

import { useNotificationsRealtime } from '../useNotificationsRealtime';
import { NOTIFICATION_QUERY_PREFIX } from '../useNotifications';

function createCapturedChannel(): CapturedChannel {
  return {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
}

function createFakeClient(channel: CapturedChannel): FakeClient {
  return {
    channel: jest.fn().mockReturnValue(channel),
    removeChannel: jest.fn(),
  };
}

function setupMocks() {
  capturedChannel = createCapturedChannel();
  changeCallbacks = [];
  subscriptionCallbacks = [];
  capturedChannel.on.mockImplementation(
    (event: string, filter: unknown, cb: ChangeCallback) => {
      if (event === 'postgres_changes') {
        changeCallbacks.push({ filter, cb });
      }
      return capturedChannel;
    },
  );
  capturedChannel.subscribe.mockImplementation((cb: SubscriptionCallback) => {
    subscriptionCallbacks.push(cb);
    return capturedChannel;
  });
  mockFakeClient = createFakeClient(capturedChannel);
}

function setupQueryClient() {
  mockQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  invalidateSpy = jest.spyOn(mockQueryClient, 'invalidateQueries');
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

function actSubscription(
  cb: SubscriptionCallback,
  status: string,
  err: Error | null,
) {
  act(() => {
    cb(status, err);
  });
}

describe('SPEC-NOTIF-002 REQ-NOTIF2-001: useNotificationsRealtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    setupQueryClient();
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
  });

  it('마운트 시 사용자별 채널 생성 + notifications INSERT 리스너 1개 등록 (N2-1 setup)', () => {
    renderHook(() => useNotificationsRealtime({ userId: 'u1' }), {
      wrapper: wrapper(mockQueryClient),
    });

    expect(mockFakeClient.channel).toHaveBeenCalledWith(
      'notifications-realtime-u1',
    );
    expect(capturedChannel.on).toHaveBeenCalledTimes(1);
    expect(changeCallbacks[0].filter).toEqual(
      expect.objectContaining({
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.u1',
      }),
    );
    expect(capturedChannel.subscribe).toHaveBeenCalledTimes(1);
  });

  it('N2-1: notifications INSERT 이벤트 수신 시 알림 도메인 쿼리 prefix 로 invalidate', () => {
    renderHook(() => useNotificationsRealtime({ userId: 'u1' }), {
      wrapper: wrapper(mockQueryClient),
    });

    const insertCb = changeCallbacks[0].cb;
    expect(insertCb).toBeDefined();
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    invalidateSpy.mockClear();

    insertCb?.({ new: { id: 'n-new', user_id: 'u1', type: 'reading_reminder' } });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [NOTIFICATION_QUERY_PREFIX],
    });
  });

  it('N2-3: 언마운트 시 channel.unsubscribe() + client.removeChannel(channel) 호출 (cleanup)', () => {
    const { unmount } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    expect(capturedChannel.unsubscribe).not.toHaveBeenCalled();
    expect(mockFakeClient.removeChannel).not.toHaveBeenCalled();

    unmount();

    expect(capturedChannel.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockFakeClient.removeChannel).toHaveBeenCalledTimes(1);
    expect(mockFakeClient.removeChannel).toHaveBeenCalledWith(capturedChannel);
  });

  it('N2-4: userId 빈 값(enabled=false) → 채널 생성/구독하지 않음 (비활성 시 구독 부재)', () => {
    renderHook(() => useNotificationsRealtime({ userId: '' }), {
      wrapper: wrapper(mockQueryClient),
    });

    expect(mockFakeClient.channel).not.toHaveBeenCalled();
    expect(capturedChannel.subscribe).not.toHaveBeenCalled();
  });

  it('SUBSCRIBED → status="connected"', () => {
    const { result } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    expect(result.current.status).toBe('connecting');
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    expect(result.current.status).toBe('connected');
    expect(result.current.lastError).toBeUndefined();
  });

  it('CHANNEL_ERROR → status="error", lastError 추적', () => {
    const { result } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(
      subscriptionCallbacks[0],
      'CHANNEL_ERROR',
      new Error('socket closed'),
    );

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('CHANNEL_ERROR(err 없음) → fallback 메시지로 status="error"', () => {
    const { result } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    // err?.message ?? fallback 분기 — err null 일 때 fallback 메시지 사용
    actSubscription(subscriptionCallbacks[0], 'CHANNEL_ERROR', null);

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('TIMED_OUT → status="error", lastError 추적', () => {
    const { result } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(
      subscriptionCallbacks[0],
      'TIMED_OUT',
      new Error('timeout'),
    );

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('TIMED_OUT(err 없음) → 시간 초과 fallback 메시지로 status="error"', () => {
    const { result } = renderHook(
      () => useNotificationsRealtime({ userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(subscriptionCallbacks[0], 'TIMED_OUT', null);

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('단절 후 재연결(SUBSCRIBED 재진입) 시 누락 보완 catch-up invalidate 호출', () => {
    renderHook(() => useNotificationsRealtime({ userId: 'u1' }), {
      wrapper: wrapper(mockQueryClient),
    });

    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    invalidateSpy.mockClear();
    actSubscription(
      subscriptionCallbacks[0],
      'CHANNEL_ERROR',
      new Error('down'),
    );
    invalidateSpy.mockClear();
    // 재연결 → 누락 보완 invalidate
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [NOTIFICATION_QUERY_PREFIX],
    });
  });

  it('userId 변경 시 기존 채널 정리 후 새 채널 생성', () => {
    const { rerender } = renderHook(
      ({ userId }: { userId: string }) => useNotificationsRealtime({ userId }),
      {
        wrapper: wrapper(mockQueryClient),
        initialProps: { userId: 'u1' },
      },
    );

    expect(mockFakeClient.channel).toHaveBeenCalledWith(
      'notifications-realtime-u1',
    );

    rerender({ userId: 'u2' });

    expect(capturedChannel.unsubscribe).toHaveBeenCalled();
    expect(mockFakeClient.removeChannel).toHaveBeenCalled();
    expect(mockFakeClient.channel).toHaveBeenCalledWith(
      'notifications-realtime-u2',
    );
  });
});
