/**
 * useLibrary mutation 훅 단위 테스트 (SPEC-LIBRARY-001 TASK-008)
 *
 * 검증 대상 (REQ-LIB-013):
 * - useUpdateProgress: onMutate optimistic update (캐시 즉시 갱신)
 * - useUpdateProgress: onError rollback (이전 캐시로 복원)
 * - useUpdateProgress: onSuccess invalidateQueries
 * - useUpdateStatus / useUpdateVisibility / useDeleteBook 동일 패턴
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LibraryItem } from '../types';

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

jest.mock('../libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

import {
  useLibrary,
  useUpdateProgress,
  useUpdateStatus,
  useUpdateVisibility,
  useDeleteBook,
} from '../useLibrary';
import {
  getLibrary,
  updateProgress,
  updateStatus,
  updateVisibility,
  deleteBook,
} from '../libraryApi';

const getLibraryMock = getLibrary as jest.MockedFunction<typeof getLibrary>;
const updateProgressMock = updateProgress as jest.MockedFunction<typeof updateProgress>;
const updateStatusMock = updateStatus as jest.MockedFunction<typeof updateStatus>;
const updateVisibilityMock = updateVisibility as jest.MockedFunction<typeof updateVisibility>;
const deleteBookMock = deleteBook as jest.MockedFunction<typeof deleteBook>;

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
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const baseItem: LibraryItem = {
  id: 'ub-1',
  book_id: 'b-1',
  user_id: 'u-1',
  status: 'reading',
  current_page: 50,
  is_public: true,
  last_progress_at: '2026-06-15T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  books: {
    id: 'b-1',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    cover_url: null,
    total_pages: 400,
  },
} as LibraryItem;

beforeEach(() => {
  jest.clearAllMocks();
  // 동적 응답: 현재 베이스 항목의 복사본을 반환 (optimistic/invalidate refetch 일관성)
  getLibraryMock.mockImplementation(async () => [
    { ...baseItem },
  ]);
});

describe('SPEC-LIBRARY-001 TASK-008: useUpdateProgress optimistic update', () => {
  it('onMutate: 진행률 변경 시 캐시를 즉시 갱신한다', async () => {
    const client = createTestQueryClient();
    const { result: libResult } = renderHook(
      () => useLibrary({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(libResult.current.isSuccess).toBe(true));

    updateProgressMock.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useUpdateProgress({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    // optimistic 단계 검증: onMutate 직후, mutation settle 전 캐시 값.
    // updateProgressMock 이 resolve 되기 전에 캐시가 120 이 되어야 한다.
    let optimisticResolve: () => void;
    const optimisticGate = new Promise<void>((resolve) => {
      optimisticResolve = resolve;
    });
    updateProgressMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          optimisticResolve = resolve;
          // gate 풀릴 때까지 대기
          optimisticGate.then(() => resolve());
        }),
    );

    act(() => {
      result.current.mutate({
        id: 'ub-1',
        currentPage: 120,
        totalPages: 400,
      });
    });

    // onMutate 가 캐시를 optimistic 갱신했는지 확인 (API 미해결 상태)
    await waitFor(() => {
      expect(libResult.current.data?.[0].current_page).toBe(120);
    });
    expect(result.current.isPending).toBe(true);

    // 게이트 풀어 mutation 완료
    act(() => optimisticResolve!());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('onError: 실패 시 이전 캐시로 롤백한다', async () => {
    const client = createTestQueryClient();
    const { result: libResult } = renderHook(
      () => useLibrary({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(libResult.current.isSuccess).toBe(true));

    updateProgressMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(
      () => useUpdateProgress({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({
        id: 'ub-1',
        currentPage: 200,
        totalPages: 400,
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    // rollback: 원래 50 으로 복원
    expect(libResult.current.data?.[0].current_page).toBe(50);
  });

  it('totalPages 없이 호출 시 ceiling 검증 없이 API 로 전달한다', async () => {
    const client = createTestQueryClient();
    renderHook(() => useLibrary({ userId: 'u-1' }), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(getLibraryMock).toHaveBeenCalled());

    updateProgressMock.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useUpdateProgress({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({ id: 'ub-1', currentPage: 30 });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    expect(updateProgressMock).toHaveBeenCalledWith({
      id: 'ub-1',
      userId: 'u-1',
      currentPage: 30,
      totalPages: null,
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-008: useUpdateStatus', () => {
  it('status 변경 시 optimistic update 후 invalidate 한다', async () => {
    const client = createTestQueryClient();
    const { result: libResult } = renderHook(
      () => useLibrary({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(libResult.current.isSuccess).toBe(true));

    updateStatusMock.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useUpdateStatus({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({ id: 'ub-1', status: 'completed' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    expect(updateStatusMock).toHaveBeenCalledWith({
      id: 'ub-1',
      userId: 'u-1',
      status: 'completed',
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-008: useUpdateVisibility', () => {
  it('is_public 변경 시 API 로 전달한다', async () => {
    const client = createTestQueryClient();
    renderHook(() => useLibrary({ userId: 'u-1' }), {
      wrapper: createWrapper(client),
    });
    await waitFor(() => expect(getLibraryMock).toHaveBeenCalled());

    updateVisibilityMock.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useUpdateVisibility({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({ id: 'ub-1', isPublic: false });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    expect(updateVisibilityMock).toHaveBeenCalledWith({
      id: 'ub-1',
      userId: 'u-1',
      isPublic: false,
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-008: useDeleteBook', () => {
  it('삭제 시 optimistic 으로 항목을 제거한다', async () => {
    const client = createTestQueryClient();
    const { result: libResult } = renderHook(
      () => useLibrary({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(libResult.current.isSuccess).toBe(true));
    expect(libResult.current.data).toHaveLength(1);

    deleteBookMock.mockResolvedValue(undefined);
    const { result } = renderHook(
      () => useDeleteBook({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({ id: 'ub-1' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    expect(deleteBookMock).toHaveBeenCalledWith({
      id: 'ub-1',
      userId: 'u-1',
    });
  });

  it('삭제 실패 시 롤백으로 항목이 복원된다', async () => {
    const client = createTestQueryClient();
    const { result: libResult } = renderHook(
      () => useLibrary({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(libResult.current.isSuccess).toBe(true));

    deleteBookMock.mockRejectedValue(new Error('FK restrict'));
    const { result } = renderHook(
      () => useDeleteBook({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      result.current.mutate({ id: 'ub-1' });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    expect(libResult.current.data).toHaveLength(1);
  });
});
