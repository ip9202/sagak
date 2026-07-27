/**
 * useLibraryItem 캐시 일관성 단위 테스트 (SPEC-LIBRARY-002 regression)
 *
 * 결함 재현: reading→shelved→reading 사이클 후 감정 기록 저장 시 current_page=0 리셋.
 * 근원 결함 1: useLibraryItem queryKey 가 libraryRootKey 접두사와 불일치하여
 *   mutateCachedItem(optimistic)과 invalidateLibrary 가 단일 항목 캐시를 누락.
 *
 * 본 슈트는 "단일 항목 캐시가 서재 뮤테이션의 optimistic/invalidate 대상에 포함된다" 는
 * 계약을 검증한다. queryKey 가 libraryRootKey 하위로 통일되어 있지 않으면 RED.
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LibraryItem } from '../types';

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
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

import { useLibraryItem } from '../useLibraryItem';
import { useUpdateProgress, useUpdateStatus } from '../useLibrary';
import {
  getLibraryItem,
  updateProgress,
  updateStatus,
} from '../libraryApi';

const getLibraryItemMock = getLibraryItem as jest.MockedFunction<typeof getLibraryItem>;
const updateProgressMock = updateProgress as jest.MockedFunction<typeof updateProgress>;
const updateStatusMock = updateStatus as jest.MockedFunction<typeof updateStatus>;

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
});

describe('SPEC-LIBRARY-002 regression: useLibraryItem 캐시 일관성', () => {
  it('useUpdateProgress optimistic 시 단일 항목 캐시(current_page)도 즉시 갱신한다', async () => {
    // 결함 시나리오: DB 진도 50 인 상태에서 120 으로 optimistic 갱신 시
    // 목록 캐시뿐 아니라 단일 항목 캐시(useLibraryItem) 도 즉시 120 이 되어야 한다.
    // queryKey 접두사 불일치 시 mutateCachedItem 이 단일 항목 캐시를 누락 → RED.
    getLibraryItemMock.mockResolvedValue({ ...baseItem, current_page: 50 });
    const client = createTestQueryClient();

    const { result: itemResult } = renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(itemResult.current.isSuccess).toBe(true));
    expect(itemResult.current.data?.current_page).toBe(50);

    // mutation 을 gate 하여 optimistic 창(API 미해결)을 유지
    let resolveMutation!: () => void;
    updateProgressMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );

    const { result: progressResult } = renderHook(
      () => useUpdateProgress({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    act(() => {
      progressResult.current.mutate({
        id: 'ub-1',
        currentPage: 120,
        totalPages: 400,
      });
    });

    // optimistic 단계: API 미해결 상태에서 단일 항목 캐시가 120 이어야 함
    await waitFor(() => {
      expect(itemResult.current.data?.current_page).toBe(120);
    });
    expect(progressResult.current.isPending).toBe(true);

    act(() => resolveMutation());
    await waitFor(() => expect(progressResult.current.isSuccess).toBe(true));
  });

  it('useUpdateStatus optimistic 시 단일 항목 캐시(status)도 즉시 갱신한다', async () => {
    // 결함 시나리오: reading→shelved 전환 시 단일 항목 캐시의 status 도 즉시 전환.
    // reading→shelved→reading 사이클에서 단일 항목 캐시가 stale 이면
    // 감정 화면 currentPage 전달 오류의 근원이 된다.
    getLibraryItemMock.mockResolvedValue({ ...baseItem, status: 'reading' });
    const client = createTestQueryClient();

    const { result: itemResult } = renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(itemResult.current.isSuccess).toBe(true));
    expect(itemResult.current.data?.status).toBe('reading');

    let resolveMutation!: () => void;
    updateStatusMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveMutation = resolve;
        }),
    );

    const { result: statusResult } = renderHook(
      () => useUpdateStatus({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    act(() => {
      statusResult.current.mutate({ id: 'ub-1', status: 'shelved' });
    });

    await waitFor(() => {
      expect(itemResult.current.data?.status).toBe('shelved');
    });
    expect(statusResult.current.isPending).toBe(true);

    act(() => resolveMutation());
    await waitFor(() => expect(statusResult.current.isSuccess).toBe(true));
  });

  it('useUpdateProgress onError 시 단일 항목 캐시도 이전 값으로 롤백한다', async () => {
    // rollback 계약: 단일 항목 캐시도 스냅샷 복원 대상에 포함되어야 한다.
    getLibraryItemMock.mockResolvedValue({ ...baseItem, current_page: 50 });
    const client = createTestQueryClient();

    const { result: itemResult } = renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(itemResult.current.isSuccess).toBe(true));

    updateProgressMock.mockRejectedValue(new Error('network down'));
    const { result: progressResult } = renderHook(
      () => useUpdateProgress({ userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await act(async () => {
      progressResult.current.mutate({
        id: 'ub-1',
        currentPage: 200,
        totalPages: 400,
      });
      await waitFor(() => expect(progressResult.current.isError).toBe(true));
    });

    // rollback: 단일 항목 캐시도 원래 50 으로 복원되어야 함
    expect(itemResult.current.data?.current_page).toBe(50);
  });
});
