/**
 * useEmotionRecords 훅 단위 테스트 (SPEC-EMOTION-001 T-006)
 *
 * 검증 대상:
 * - useEmotionRecords: useQuery 로 listEmotionRecords 호출, queryKey 설계
 * - userId 빈 값 → 쿼리 비활성화
 * - useCreateEmotionRecord: mutation 성공 시 emotion 캐시 invalidate
 * - useUpdateEmotionRecord / useDeleteEmotionRecord: invalidate
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

jest.mock('../emotionApi', () => ({
  __esModule: true,
  listEmotionRecords: jest.fn(),
  createEmotionRecord: jest.fn(),
  updateEmotionRecord: jest.fn(),
  deleteEmotionRecord: jest.fn(),
}));

import {
  useEmotionRecords,
  useCreateEmotionRecord,
  useUpdateEmotionRecord,
  useDeleteEmotionRecord,
} from '../useEmotionRecords';
import {
  listEmotionRecords,
  createEmotionRecord,
  updateEmotionRecord,
  deleteEmotionRecord,
} from '../emotionApi';
import type { EmotionListResult } from '../types';

const listMock = listEmotionRecords as jest.MockedFunction<typeof listEmotionRecords>;
const createMock = createEmotionRecord as jest.MockedFunction<typeof createEmotionRecord>;
const updateMock = updateEmotionRecord as jest.MockedFunction<typeof updateEmotionRecord>;
const deleteMock = deleteEmotionRecord as jest.MockedFunction<typeof deleteEmotionRecord>;

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const emptyResult: EmotionListResult = { safe: [], spoiler: [] };

describe('SPEC-EMOTION-001 T-006: useEmotionRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMock.mockResolvedValue(emptyResult);
  });

  it('useEmotionRecords 가 listEmotionRecords 를 호출한다', async () => {
    listMock.mockResolvedValue(emptyResult);
    const client = createClient();

    const { result } = renderHook(
      () => useEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listMock).toHaveBeenCalledWith({
      bookId: 'b1', userId: 'u1', currentPage: 100, sort: undefined,
    });
  });

  it('userId 가 빈 문자열이면 쿼리를 비활성화한다', async () => {
    listMock.mockResolvedValue(emptyResult);
    const client = createClient();

    const { result } = renderHook(
      () => useEmotionRecords({ bookId: 'b1', userId: '', currentPage: 100 }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(listMock).not.toHaveBeenCalled();
  });

  it('sort 옵션을 queryFn 에 전달한다', async () => {
    listMock.mockResolvedValue(emptyResult);
    const client = createClient();

    renderHook(
      () => useEmotionRecords({
        bookId: 'b1', userId: 'u1', currentPage: 100, sort: 'page',
      }),
      { wrapper: wrapper(client) },
    );

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ sort: 'page' })),
    );
  });

  it('useCreateEmotionRecord 성공 시 emotion 캐시를 invalidate 한다', async () => {
    listMock.mockResolvedValue(emptyResult);
    createMock.mockResolvedValue({} as never);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    // 먼저 쿼리를 활성화
    renderHook(
      () => useEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 }),
      { wrapper: wrapper(client) },
    );

    const { result: mutate } = renderHook(
      () => useCreateEmotionRecord({ bookId: 'b1', userId: 'u1' }),
      { wrapper: wrapper(client) },
    );

    await actWait(() =>
      mutate.current.mutateAsync({
        pageNumber: 50, content: 'c', visibility: 'public', clubId: null,
      }),
    );

    expect(createMock).toHaveBeenCalled();
    // emotion 루트 키로 invalidate 호출되었는지 검증
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['emotion']),
      }),
    );
  });

  it('useDeleteEmotionRecord 성공 시 emotion 캐시를 invalidate 한다', async () => {
    listMock.mockResolvedValue(emptyResult);
    deleteMock.mockResolvedValue(undefined);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    renderHook(
      () => useEmotionRecords({ bookId: 'b1', userId: 'u1', currentPage: 100 }),
      { wrapper: wrapper(client) },
    );

    const { result: mutate } = renderHook(
      () => useDeleteEmotionRecord({ bookId: 'b1', userId: 'u1' }),
      { wrapper: wrapper(client) },
    );

    await actWait(() => mutate.current.mutateAsync('r1'));

    expect(deleteMock).toHaveBeenCalledWith('r1', 'u1');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('useUpdateEmotionRecord 는 updateEmotionRecord 를 호출한다', async () => {
    updateMock.mockResolvedValue(undefined);
    const client = createClient();

    const { result: mutate } = renderHook(
      () => useUpdateEmotionRecord({ bookId: 'b1', userId: 'u1' }),
      { wrapper: wrapper(client) },
    );

    await actWait(() =>
      mutate.current.mutateAsync({ id: 'r1', patch: { content: '수정' } }),
    );

    expect(updateMock).toHaveBeenCalledWith('r1', { content: '수정' }, 'u1');
  });
});

// helper: mutateAsync 를 await 하는 act 래퍼
async function actWait<T>(fn: () => Promise<T>): Promise<T> {
  let value: T;
  let error: unknown;
  // waitFor 내부에서 resolve 대기
  await waitFor(async () => {
    try {
      value = await fn();
    } catch (e) {
      error = e;
    }
  });
  if (error !== undefined) throw error;
  return value!;
}
