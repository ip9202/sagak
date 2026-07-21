/**
 * useClubFeedRealtime 훅 단위 테스트 (SPEC-FEED-001 T-C1)
 *
 * 검증 대상 (인수 시나리오):
 * - F12: emotion_records INSERT → queryClient.invalidateQueries(['feed','club',clubId])
 * - F14: sticker_reactions INSERT → 동일 queryKey invalidate
 * - F15: 피드에 없는 기록의 스티커 이벤트 → 매핑 실패 자연 무시 (전체 재조회 전략이므로 단순 invalidate, 에러 없음)
 * - F16: CHANNEL_ERROR → status='error', lastError 추적
 * - F17: error → SUBSCRIBED 재진입 시 catch-up invalidate 호출
 * - CLEANUP: 언마운트 시 channel.unsubscribe() + client.removeChannel(channel) 호출 (메모리 누수 방지)
 *
 * RLS (F13) 은 서버에서 시행되므로 클라이언트 단위 테스트 범위가 아니다.
 * 본 훅은 이벤트 핸들링만 검증하며, 비멤버 이벤트 미수신은 RLS 정책(REQ-DB-016) 에 의존한다.
 *
 * 전략 (SPEC plan.md §2.3 리스크1 — 전체 새로고침으로 단순화):
 * - sticker_reactions INSERT 도 동일 queryKey 만 invalidate.
 * - 매핑 실패(F15) 는 전체 재조회 후에도 해당 기록이 피드에 없으면 자연 무시된다.
 *
 * @jest-environment jsdom
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
// invalidateQueries 호출을 추적하기 위해 spy 를 건다.
let invalidateSpy: jest.SpyInstance;
// mock 접두어 필수 — jest.mock 팩토리는 out-of-scope 변수 참조 시 mock 접두어 변수만 허용한다.
let mockQueryClient: QueryClient;
jest.mock('../../../lib/query/queryClient', () => ({
  getQueryClient: () => mockQueryClient,
}));

// getSupabaseClient 가 chainable mock channel 을 반환하도록 한다.
// channel.on('postgres_changes', filter, cb) 는 cb 를 캡처하여 이벤트 발생 시 호출할 수 있게 한다.
type ChangeCallback = (payload: unknown) => void;
type SubscriptionCallback = (
  status: string,
  err: Error | null,
) => void;

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

import { useClubFeedRealtime } from '../useClubFeedRealtime';

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

  // .on('postgres_changes', filter, cb) 호출 시 cb 만 캡처 (체이닝 유지)
  capturedChannel.on.mockImplementation(
    (event: string, filter: unknown, cb: ChangeCallback) => {
      if (event === 'postgres_changes') {
        changeCallbacks.push({ filter, cb });
      }
      return capturedChannel;
    },
  );

  // .subscribe(cb) 호출 시 cb 를 보관하여 테스트에서 status 를 주입할 수 있게 한다.
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

describe('SPEC-FEED-001 T-C1: useClubFeedRealtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    setupQueryClient();
  });

  afterEach(() => {
    invalidateSpy.mockRestore();
  });

  it('마운트 시 채널을 생성하고 postgres_changes 리스너 2개(emotion/sticker)를 등록한다', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    expect(mockFakeClient.channel).toHaveBeenCalledWith('club-feed-c1');
    // emotion_records INSERT + sticker_reactions INSERT 두 리스너
    expect(capturedChannel.on).toHaveBeenCalledTimes(2);
    const filters = changeCallbacks.map((c) => c.filter);
    expect(filters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'emotion_records',
          filter: 'club_id=eq.c1',
        }),
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'sticker_reactions',
        }),
      ]),
    );
    expect(capturedChannel.subscribe).toHaveBeenCalledTimes(1);
  });

  it('F12: emotion_records INSERT 이벤트 수신 시 feed 쿼리를 invalidate 한다', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    // emotion 리스너 콜백 찾기
    const emotionCb = changeCallbacks.find(
      (c) =>
        (c.filter as { table: string }).table === 'emotion_records',
    )?.cb;
    expect(emotionCb).toBeDefined();

    // SUBSCRIBED 상태 먼저 주입 (정상 구독)
    expect(subscriptionCallbacks.length).toBe(1);
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);

    invalidateSpy.mockClear();
    emotionCb?.({ new: { id: 'r9', club_id: 'c1' } });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['feed', 'club', 'c1'],
    });
  });

  it('F14: sticker_reactions INSERT 이벤트 수신 시 동일 queryKey 를 invalidate 한다', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    const stickerCb = changeCallbacks.find(
      (c) =>
        (c.filter as { table: string }).table === 'sticker_reactions',
    )?.cb;
    expect(stickerCb).toBeDefined();

    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    invalidateSpy.mockClear();

    stickerCb?.({ new: { record_id: 'r1', sticker_type: 'comforted' } });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['feed', 'club', 'c1'],
    });
  });

  it('F15: 피드에 없는 기록의 스티커 이벤트도 단순 invalidate (매핑 실패 자연 무시 — 전체 재조회 전략)', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    const stickerCb = changeCallbacks.find(
      (c) =>
        (c.filter as { table: string }).table === 'sticker_reactions',
    )?.cb;

    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    invalidateSpy.mockClear();

    // record-30 은 피드에 없지만 훅은 매핑을 시도하지 않고 전체 invalidate 만 수행한다.
    expect(() =>
      stickerCb?.({ new: { record_id: 'record-30', sticker_type: 'empathy' } }),
    ).not.toThrow();
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('F16: CHANNEL_ERROR → status="error", lastError 추적', () => {
    const { result } = renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    // 초기 connecting
    expect(result.current.status).toBe('connecting');

    const err = new Error('socket closed');
    actSubscription(subscriptionCallbacks[0], 'CHANNEL_ERROR', err);

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('TIMED_OUT → status="error"', () => {
    const { result } = renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(subscriptionCallbacks[0], 'TIMED_OUT', new Error('timeout'));

    expect(result.current.status).toBe('error');
  });

  it('TIMED_OUT (err 없음) → fallback 메시지로 status="error"', () => {
    const { result } = renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(subscriptionCallbacks[0], 'TIMED_OUT', null);

    expect(result.current.status).toBe('error');
    expect(result.current.lastError).toBeTruthy();
  });

  it('SUBSCRIBED → status="connected"', () => {
    const { result } = renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);

    expect(result.current.status).toBe('connected');
    expect(result.current.lastError).toBeUndefined();
  });

  it('F17: error 후 SUBSCRIBED 재진입 시 catch-up invalidate 호출', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    // 1) 정상 구독
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);
    invalidateSpy.mockClear();

    // 2) 네트워크 단절
    actSubscription(subscriptionCallbacks[0], 'CHANNEL_ERROR', new Error('down'));

    // 3) 재연결 성공 → 누락 보완을 위해 전체 재조회
    actSubscription(subscriptionCallbacks[0], 'SUBSCRIBED', null);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['feed', 'club', 'c1'],
    });
  });

  it('CLEANUP: 언마운트 시 channel.unsubscribe() + client.removeChannel(channel) 호출', () => {
    const { unmount } = renderHook(
      () => useClubFeedRealtime({ clubId: 'c1', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    expect(capturedChannel.unsubscribe).not.toHaveBeenCalled();
    expect(mockFakeClient.removeChannel).not.toHaveBeenCalled();

    unmount();

    expect(capturedChannel.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockFakeClient.removeChannel).toHaveBeenCalledTimes(1);
    expect(mockFakeClient.removeChannel).toHaveBeenCalledWith(capturedChannel);
  });

  it('enabled=false (clubId/userId 빈 값) → 채널 생성하지 않음', () => {
    renderHook(
      () => useClubFeedRealtime({ clubId: '', userId: 'u1' }),
      { wrapper: wrapper(mockQueryClient) },
    );

    expect(mockFakeClient.channel).not.toHaveBeenCalled();
    expect(capturedChannel.subscribe).not.toHaveBeenCalled();
  });

  it('clubId 변경 시 기존 채널 정리 후 새 채널 생성', () => {
    const { rerender } = renderHook(
      ({ clubId }: { clubId: string }) =>
        useClubFeedRealtime({ clubId, userId: 'u1' }),
      {
        wrapper: wrapper(mockQueryClient),
        initialProps: { clubId: 'c1' },
      },
    );

    expect(mockFakeClient.channel).toHaveBeenCalledWith('club-feed-c1');

    rerender({ clubId: 'c2' });

    // 이전 채널 정리
    expect(capturedChannel.unsubscribe).toHaveBeenCalled();
    expect(mockFakeClient.removeChannel).toHaveBeenCalled();
    // 새 채널 생성
    expect(mockFakeClient.channel).toHaveBeenCalledWith('club-feed-c2');
  });
});

/** subscription 콜백을 React act() 로 감싸 동기 flush 한다.
 *  useClubFeedRealtime 의 setState 는 상태 갱신을 스케줄하므로,
 *  act() 없이는 renderHook 의 result.current 가 갱신되지 않는다. */
function actSubscription(
  cb: SubscriptionCallback,
  status: string,
  err: Error | null,
) {
  act(() => {
    cb(status, err);
  });
}
