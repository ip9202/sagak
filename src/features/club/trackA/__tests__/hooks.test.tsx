/**
 * SPEC-CLUB-001 T-009 React Query 훅 단위 테스트 (M2 — UI 계층)
 *
 * 검증 대상:
 * - useActiveReaders: fetchActiveReaders + resolveClubIdsForUsers 조합 → ActiveReader[]
 *   queryKey=['club','readers',bookId], 빈 bookId 시 비활성화
 * - useCreateJoinRequest: club_id 분기 (createJoinRequest vs processJoinRequestViaEdgeFunction),
 *   성공 시 readers 캐시 invalidate
 * - useRespondToJoinRequest: accepted/declined 전환, 성공 시 incoming 캐시 invalidate
 * - useConfirmMembership: confirmMembership 조회, queryKey=['club','membership',clubId]
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ActiveReader } from '../types';

// 네이티브 모듈 mock
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

// 데이터 계층(위임 1) 전체 mock
jest.mock('../readersApi', () => ({
  __esModule: true,
  fetchActiveReaders: jest.fn(),
  resolveClubIdsForUsers: jest.fn(),
}));
jest.mock('../joinRequestApi', () => ({
  __esModule: true,
  createJoinRequest: jest.fn(),
  fetchIncomingJoinRequests: jest.fn(),
  respondToJoinRequest: jest.fn(),
  confirmMembership: jest.fn(),
  fetchMyJoinRequests: jest.fn(),
}));
jest.mock('../processJoinRequest', () => ({
  __esModule: true,
  processJoinRequestViaEdgeFunction: jest.fn(),
}));

import { useActiveReaders, useCreateJoinRequest, useRespondToJoinRequest, useConfirmMembership } from '../hooks';
import { fetchActiveReaders, resolveClubIdsForUsers } from '../readersApi';
import { createJoinRequest, respondToJoinRequest, confirmMembership } from '../joinRequestApi';
import { processJoinRequestViaEdgeFunction } from '../processJoinRequest';

const fetchReadersMock = fetchActiveReaders as jest.MockedFunction<typeof fetchActiveReaders>;
const resolveClubsMock = resolveClubIdsForUsers as jest.MockedFunction<typeof resolveClubIdsForUsers>;
const createReqMock = createJoinRequest as jest.MockedFunction<typeof createJoinRequest>;
const processEdgeMock = processJoinRequestViaEdgeFunction as jest.MockedFunction<typeof processJoinRequestViaEdgeFunction>;
const respondMock = respondToJoinRequest as jest.MockedFunction<typeof respondToJoinRequest>;
const confirmMock = confirmMembership as jest.MockedFunction<typeof confirmMembership>;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-CLUB-001 T-009: useActiveReaders', () => {
  it('빈 bookId 면 쿼리를 비활성화한다 (fetch 미호출)', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useActiveReaders(''), {
      wrapper: createWrapper(client),
    });
    expect(result.current.isLoading).toBe(false);
    expect(fetchReadersMock).not.toHaveBeenCalled();
  });

  it('fetchActiveReaders + resolveClubIdsForUsers 를 조합해 ActiveReader[] 를 반환한다', async () => {
    fetchReadersMock.mockResolvedValue([
      { user_id: 'u-1', book_id: 'b-1', current_page: 30, started_reading_at: '2026-06-01T00:00:00Z' },
      { user_id: 'u-2', book_id: 'b-1', current_page: null, started_reading_at: null },
    ]);
    resolveClubsMock.mockResolvedValue({ 'u-1': 'club-1' }); // u-2 는 그룹 없음 → null

    const client = createTestQueryClient();
    const { result } = renderHook(() => useActiveReaders('b-1'), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    const readers = result.current.data as ActiveReader[];
    expect(readers).toHaveLength(2);
    expect(readers[0]).toMatchObject({ user_id: 'u-1', club_id: 'club-1' });
    expect(readers[1]).toMatchObject({ user_id: 'u-2', club_id: null });
    expect(resolveClubsMock).toHaveBeenCalledWith(['u-1', 'u-2']);
  });

  it('독자가 0명이면 resolveClubIdsForUsers 를 호출하지 않는다', async () => {
    fetchReadersMock.mockResolvedValue([]);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useActiveReaders('b-1'), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(resolveClubsMock).not.toHaveBeenCalled();
  });

  it('queryKey 는 ["club","readers",bookId] 를 사용한다', async () => {
    fetchReadersMock.mockResolvedValue([]);
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'getQueryData');
    renderHook(() => useActiveReaders('b-9'), { wrapper: createWrapper(client) });
    await waitFor(() => expect(fetchReadersMock).toHaveBeenCalled());
    // 캐시에 적재되었는지 확인
    expect(client.getQueryData(['club', 'readers', 'b-9'])).toEqual([]);
    spy.mockRestore();
  });

  // @MX:NOTE: [AUTO] 본인(현재 로그인 사용자)은 독자 목록에서 제외되어야 한다. 자기 자신에게 합류 요청을 보낼 수 없기 때문.
  it('currentUserId 를 전달하면 fetchActiveReaders(bookId, currentUserId) 로 전파한다', async () => {
    fetchReadersMock.mockResolvedValue([]);
    const client = createTestQueryClient();
    renderHook(() => useActiveReaders('b-1', 'u-me'), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(fetchReadersMock).toHaveBeenCalledWith('b-1', 'u-me'));
  });

  it('currentUserId 미제공 시 fetchActiveReaders(bookId, undefined) 로 호출한다 (하위 호환)', async () => {
    fetchReadersMock.mockResolvedValue([]);
    const client = createTestQueryClient();
    renderHook(() => useActiveReaders('b-1'), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(fetchReadersMock).toHaveBeenCalled());
    expect(fetchReadersMock).toHaveBeenCalledWith('b-1', undefined);
  });
});

describe('SPEC-CLUB-001 T-009: useCreateJoinRequest', () => {
  it('club_id 가 있으면 createJoinRequest 를 호출한다', async () => {
    createReqMock.mockResolvedValue({ id: 'jr-1' } as any);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCreateJoinRequest(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        clubId: 'club-1',
        requesterId: 'u-me',
        message: '같이 읽어요',
      });
    });

    expect(createReqMock).toHaveBeenCalledWith({
      clubId: 'club-1',
      requesterId: 'u-me',
      message: '같이 읽어요',
    });
    expect(processEdgeMock).not.toHaveBeenCalled();
  });

  it('club_id 가 null 이면 processJoinRequestViaEdgeFunction 을 호출한다 (lazy 그룹 생성)', async () => {
    processEdgeMock.mockResolvedValue({ ok: true, club_id: 'club-new', request_id: 'jr-2' });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useCreateJoinRequest(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        targetUserId: 'u-target',
        bookId: 'b-1',
        requesterId: 'u-me',
        message: null,
      });
    });

    expect(processEdgeMock).toHaveBeenCalledWith({
      targetUserId: 'u-target',
      bookId: 'b-1',
      requesterId: 'u-me',
      message: null,
    });
    expect(createReqMock).not.toHaveBeenCalled();
  });

  it('성공 후 readers 캐시를 invalidate 한다', async () => {
    createReqMock.mockResolvedValue({ id: 'jr-1' } as any);
    const client = createTestQueryClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateJoinRequest(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        clubId: 'club-1',
        requesterId: 'u-me',
        message: null,
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['club', 'readers'] }),
    );
    invalidateSpy.mockRestore();
  });
});

describe('SPEC-CLUB-001 T-009: useRespondToJoinRequest', () => {
  it('accepted 전환 시 respondToJoinRequest 호출 후 incoming 캐시 invalidate', async () => {
    respondMock.mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRespondToJoinRequest(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ requestId: 'jr-1', status: 'accepted' });
    });

    expect(respondMock).toHaveBeenCalledWith({ requestId: 'jr-1', status: 'accepted' });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['club', 'incoming'] }),
    );
    invalidateSpy.mockRestore();
  });

  it('declined 전환도 동일 경로로 처리한다', async () => {
    respondMock.mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRespondToJoinRequest(), {
      wrapper: createWrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync({ requestId: 'jr-2', status: 'declined' });
    });
    expect(respondMock).toHaveBeenCalledWith({ requestId: 'jr-2', status: 'declined' });
  });
});

describe('SPEC-CLUB-001 T-009: useConfirmMembership', () => {
  it('빈 clubId 면 쿼리를 비활성화한다', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useConfirmMembership('', 'u-1'), {
      wrapper: createWrapper(client),
    });
    expect(result.current.isLoading).toBe(false);
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('confirmMembership 으로 멤버십 행을 반환한다', async () => {
    confirmMock.mockResolvedValue({ id: 'cm-1', club_id: 'c-1', user_id: 'u-1', role: 'member', joined_at: '2026-06-19T00:00:00Z' });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useConfirmMembership('c-1', 'u-1'), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(confirmMock).toHaveBeenCalledWith({ clubId: 'c-1', userId: 'u-1' });
    expect(result.current.data?.role).toBe('member');
  });
});
