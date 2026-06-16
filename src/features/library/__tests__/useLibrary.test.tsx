/**
 * useLibrary 훅 단위 테스트 (SPEC-LIBRARY-001 TASK-007)
 *
 * 검증 대상:
 * - useLibrary: useQuery 로 getLibrary 호출, status 필터 전달
 * - queryKey 설계: ['library', { status, sortBy }]
 * - 기본 정렬: last_progress_at DESC (정책 5.2 — getLibrary 가 DB order 담당)
 * - loading / empty / error 상태 노출
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LibraryItem } from '../types';

// 네이티브 모듈 mock (libraryApi → supabase client → storageAdapter 경유 로드)
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

// libraryApi 전체 mock — getLibrary 만 제어
jest.mock('../libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

import { useLibrary } from '../useLibrary';
import { getLibrary } from '../libraryApi';

const getLibraryMock = getLibrary as jest.MockedFunction<typeof getLibrary>;

// 테스트 전용 QueryClient (retry: 0)
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

const sampleItems: LibraryItem[] = [
  {
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
      cover_url: 'https://example.com/c1.jpg',
      total_pages: 400,
    },
  } as LibraryItem,
  {
    id: 'ub-2',
    book_id: 'b-2',
    user_id: 'u-1',
    status: 'completed',
    current_page: 300,
    is_public: false,
    last_progress_at: '2026-06-10T00:00:00Z',
    created_at: '2026-06-02T00:00:00Z',
    books: {
      id: 'b-2',
      title: '데미안',
      author: '헤르만 헤세',
      cover_url: null,
      total_pages: 300,
    },
  } as LibraryItem,
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-LIBRARY-001 TASK-007: useLibrary (조회)', () => {
  describe('useQuery 연동', () => {
    it('getLibrary 를 호출한다', async () => {
      getLibraryMock.mockResolvedValue(sampleItems);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getLibraryMock).toHaveBeenCalledTimes(1);
    });

    it('status 필터를 getLibrary 에 전달한다', async () => {
      getLibraryMock.mockResolvedValue([sampleItems[0]]);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1', status: 'reading' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getLibraryMock).toHaveBeenCalledWith({
        userId: 'u-1',
        status: 'reading',
      });
    });

    it('status 를 생략하면 전체(미필터) 조회를 요청한다', async () => {
      getLibraryMock.mockResolvedValue(sampleItems);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getLibraryMock).toHaveBeenCalledWith({ userId: 'u-1' });
    });

    it('userId 없이는 호출하지 않는다 (enabled 제어)', async () => {
      const client = createTestQueryClient();
      renderHook(() => useLibrary({ userId: '' }), {
        wrapper: createWrapper(client),
      });
      // enabled: false 이므로 getLibrary 가 호출되지 않는다
      expect(getLibraryMock).not.toHaveBeenCalled();
    });
  });

  describe('queryKey 설계', () => {
    it('status 별로 queryKey 를 구분한다', async () => {
      getLibraryMock.mockResolvedValue(sampleItems);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1', status: 'reading' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // status 가 reading 인 키가 캐시에 존재해야 한다
      const cache = client.getQueryCache();
      const keys = cache.getAll().map((q) => q.queryKey);
      const hasReadingKey = keys.some(
        (k) =>
          Array.isArray(k) &&
          k[0] === 'library' &&
          (k[1] as { status?: string })?.status === 'reading',
      );
      expect(hasReadingKey).toBe(true);
    });
  });

  describe('상태 노출', () => {
    it('로딩 중 isLoading 이 true 다', () => {
      getLibraryMock.mockReturnValue(new Promise(() => {}));
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );
      expect(result.current.isLoading).toBe(true);
    });

    it('빈 결과일 때 빈 배열을 반환한다', async () => {
      getLibraryMock.mockResolvedValue([]);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });

    it('에러 시 isError 가 true 다', async () => {
      const err = new Error('RLS denied');
      getLibraryMock.mockRejectedValue(err);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBe(err);
    });

    it('조회 성공 시 data 에 LibraryItem[] 를 담는다', async () => {
      getLibraryMock.mockResolvedValue(sampleItems);
      const client = createTestQueryClient();
      const { result } = renderHook(
        () => useLibrary({ userId: 'u-1' }),
        { wrapper: createWrapper(client) },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].books?.title).toBe('미드나잇 라이브러리');
    });
  });
});
