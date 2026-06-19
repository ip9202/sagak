/**
 * useClubFeed 훅 단위 테스트 (SPEC-FEED-001 T-A4)
 *
 * 검증 대상:
 * - F9: queryKey 가 ['feed','club',clubId] 이고 currentPage 를 포함하지 않는다
 * - enabled: clubId/bookId/userId 중 빈 값이 있으면 비활성화
 * - getNextPageParam: nextCursor 있으면 다음 pageParam, null 이면 undefined (끝)
 * - queryFn 이 fetchClubFeedPage 에 cursor 를 전달한다
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
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

jest.mock('../queries', () => ({
  __esModule: true,
  fetchClubFeedPage: jest.fn(),
}));

import { useClubFeed } from '../useClubFeed';
import { fetchClubFeedPage } from '../queries';
import type { FeedPageResult } from '../types';

const fetchMock = fetchClubFeedPage as jest.MockedFunction<typeof fetchClubFeedPage>;

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe('SPEC-FEED-001 T-A4: useClubFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queryFn 호출 — 첫 페이지 cursor=null 로 fetchClubFeedPage 호출', async () => {
    const empty: FeedPageResult = { items: [], nextCursor: null };
    fetchMock.mockResolvedValue(empty);

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clubId: 'c1',
        bookId: 'b1',
        currentPage: 50,
        userId: 'u1',
        cursor: null,
      }),
    );
  });

  it('F9: queryKey query hash 에 currentPage 가 포함되지 않는다', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // queryKey 검증 — currentPage 가 key 에 들어가면 캐시가 분리되어 F9 가 깨진다.
    const queryCacheKey = client.getQueryCache().getAll()[0].queryKey;
    expect(queryCacheKey).toEqual(['feed', 'club', 'c1']);
    // pageParams 는 첫 페이지에서 [null] 이어야 한다 (참조용)
    expect(result.current.data?.pageParams).toEqual([null]);
  });

  it('currentPage 변경해도 동일 queryKey (F9 재평가 전제)', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result, rerender } = renderHook(
      ({ cp }: { cp: number }) =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: cp,
          userId: 'u1',
        }),
      {
        wrapper: wrapper(client),
        initialProps: { cp: 50 },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstCallCount = fetchMock.mock.calls.length;

    rerender({ cp: 100 });

    // 동일 queryKey 이므로 재요청 발생하지 않아야 한다
    expect(fetchMock.mock.calls.length).toBe(firstCallCount);
  });

  it('enabled: clubId 빈 값 → 쿼리 비활성화 (fetch 미호출)', () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: '',
          bookId: 'b1',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enabled: bookId 빈 값 → 쿼리 비활성화', () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: '',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('enabled: userId 빈 값 → 쿼리 비활성화', () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: 50,
          userId: '',
        }),
      { wrapper: wrapper(client) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('getNextPageParam: nextCursor 있으면 hasNextPage=true', async () => {
    fetchMock.mockResolvedValue({
      items: [
        {
          id: 'r1',
          book_id: 'b1',
          user_id: 'u2',
          page_number: 1,
          content: 'c',
          visibility: 'club',
          club_id: 'c1',
          created_at: '2026-06-19T00:00:00Z',
          updated_at: null,
          users: null,
          sticker_reactions: [],
        },
      ],
      nextCursor: { createdAt: '2026-06-18T00:00:00Z', id: 'r1' },
    });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('getNextPageParam: nextCursor=null 이면 hasNextPage=false', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { result } = renderHook(
      () =>
        useClubFeed({
          clubId: 'c1',
          bookId: 'b1',
          currentPage: 50,
          userId: 'u1',
        }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });
});
