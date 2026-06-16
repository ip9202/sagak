/**
 * useLibraryItem 훅 단위 테스트 (SPEC-LIBRARY-001 TASK-010)
 *
 * 단일 서재 항목 조회 훅 검증:
 * - getLibraryItem 호출 + bookId/userId 전달
 * - 서재 미등록(0행): data = null
 * - enabled 제어 (빈 userId/bookId)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
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
import { getLibraryItem } from '../libraryApi';

const getLibraryItemMock = getLibraryItem as jest.MockedFunction<typeof getLibraryItem>;

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

const sampleItem: LibraryItem = {
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

describe('SPEC-LIBRARY-001 TASK-010: useLibraryItem', () => {
  it('getLibraryItem 을 bookId/userId 로 호출한다', async () => {
    getLibraryItemMock.mockResolvedValue(sampleItem);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getLibraryItemMock).toHaveBeenCalledWith('b-1', 'u-1');
    expect(result.current.data?.id).toBe('ub-1');
  });

  it('서재 미등록(0행) 시 data 가 null 이다', async () => {
    getLibraryItemMock.mockResolvedValue(null);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useLibraryItem({ bookId: 'b-missing', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('빈 userId 시 호출하지 않는다 (enabled)', () => {
    const client = createTestQueryClient();
    renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: '' }),
      { wrapper: createWrapper(client) },
    );
    expect(getLibraryItemMock).not.toHaveBeenCalled();
  });

  it('빈 bookId 시 호출하지 않는다 (enabled)', () => {
    const client = createTestQueryClient();
    renderHook(
      () => useLibraryItem({ bookId: '', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );
    expect(getLibraryItemMock).not.toHaveBeenCalled();
  });

  it('에러 시 isError 가 true 다', async () => {
    const err = new Error('RLS denied');
    getLibraryItemMock.mockRejectedValue(err);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useLibraryItem({ bookId: 'b-1', userId: 'u-1' }),
      { wrapper: createWrapper(client) },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(err);
  });
});
