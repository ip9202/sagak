/**
 * useCompletionDiaryList 훅 테스트 (SPEC-COMPLETION-002, REQ-COMP2-002/007/014/015)
 *
 * 검증 대상:
 * - 로딩 상태 (isLoading=true)
 * - 성공 상태 (data, isSuccess)
 * - 빈 상태 (data.length === 0 플래그)
 * - 에러 상태 (isError)
 * - refetch 가 queryFn 을 재호출한다 (당겨서 새로고침, REQ-COMP2-007)
 * - queryKey: ['completion','diary-list']
 * - enabled: userId 가 비어 있으면 비활성화
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCompletionDiaryList } from '../useCompletionDiaryList';
import { fetchCompletionDiaryList } from '../completionDiaryListApi';
import type { CompletionDiaryListItem } from '../types';

jest.mock('../completionDiaryListApi', () => ({
  fetchCompletionDiaryList: jest.fn(),
}));
jest.mock('../../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

const mockedFetch = fetchCompletionDiaryList as jest.MockedFunction<
  typeof fetchCompletionDiaryList
>;

const SAMPLE: CompletionDiaryListItem[] = [
  {
    userBookId: 'ub-1',
    bookId: 'b-1',
    title: '책 A',
    author: '저자',
    coverUrl: null,
    completedAt: '2026-06-20T00:00:00Z',
    totalRecords: 5,
    recentHighlight: '하이라이트',
  },
];

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function renderHook(userId: string) {
  const client = createClient();
  const result: { current: ReturnType<typeof useCompletionDiaryList> | null } = { current: null };
  function Capture() {
    const q = useCompletionDiaryList(userId);
    result.current = q;
    return null;
  }
  const utils = render(
    <QueryClientProvider client={client}>
      <Capture />
    </QueryClientProvider>,
  );
  return { result, client, utils };
}

describe('SPEC-COMPLETION-002: useCompletionDiaryList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 상태 → 성공 상태로 전환되며 data 에 항목이 있다', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);
    const { result } = renderHook('user-1');

    // 로딩 초기
    expect(result.current?.isLoading).toBe(true);
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(result.current?.data).toEqual(SAMPLE);
    expect(result.current?.data?.length).toBe(1);
  });

  it('빈 배열이면 isEmpty=true', async () => {
    mockedFetch.mockResolvedValue([]);
    const { result } = renderHook('user-1');
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(result.current?.isEmpty).toBe(true);
    expect(result.current?.data).toEqual([]);
  });

  it('항목이 있으면 isEmpty=false', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);
    const { result } = renderHook('user-1');
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(result.current?.isEmpty).toBe(false);
  });

  it('에러 상태 (isError=true)', async () => {
    mockedFetch.mockRejectedValue(new Error('network failed'));
    const { result } = renderHook('user-1');
    await waitFor(() => expect(result.current?.isError).toBe(true));
    expect(result.current?.error).toBeTruthy();
  });

  it('userId 가 빈 문자열이면 쿼리가 비활성화된다 (fetch 호출 안 됨)', async () => {
    mockedFetch.mockResolvedValue([]);
    const { result } = renderHook('');
    // 비활성화된 쿼리는 fetch 하지 않음
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(result.current?.isLoading).toBe(false);
  });

  it('refetch 가 queryFn 을 재호출한다 (REQ-COMP2-007 당겨서 새로고침)', async () => {
    mockedFetch.mockResolvedValue(SAMPLE);
    const { result } = renderHook('user-1');
    await waitFor(() => expect(result.current?.isSuccess).toBe(true));
    expect(mockedFetch).toHaveBeenCalledTimes(1);

    await result.current?.refetch();
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('queryKey 루트가 completion 이다', async () => {
    mockedFetch.mockResolvedValue([]);
    const { client } = renderHook('user-1');
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled());
    const cache = client.getQueryCache().getAll();
    const hasCompletionKey = cache.some((q) => {
      const key = q.queryKey as unknown[];
      return Array.isArray(key) && key[0] === 'completion';
    });
    expect(hasCompletionKey).toBe(true);
  });
});
