/**
 * useStickerReaction 훅 단위 테스트 (SPEC-EMOTION-001 T-007)
 *
 * 검증 대상 (시나리오 3.7, EC-11):
 * - useCreateSticker: precheck → create 흐름
 * - useCreateSticker: 409 수신 시 에러 전파 (UI 에서 getUserFriendlyMessage 로 안내)
 * - useDeleteSticker: 성공 시 invalidate
 * - useReplaceSticker: DELETE → POST 순차, 중간 실패 시 에러 전파
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

jest.mock('../stickerApi', () => ({
  __esModule: true,
  precheckSticker: jest.fn(),
  createStickerReaction: jest.fn(),
  deleteStickerReaction: jest.fn(),
  aggregateByRecord: jest.fn(),
}));

import {
  useCreateSticker,
  useDeleteSticker,
  useReplaceSticker,
} from '../useStickerReaction';
import {
  precheckSticker,
  createStickerReaction,
  deleteStickerReaction,
} from '../stickerApi';
import { AppError } from '../../../errors';

const precheckMock = precheckSticker as jest.MockedFunction<typeof precheckSticker>;
const createMock = createStickerReaction as jest.MockedFunction<typeof createStickerReaction>;
const deleteMock = deleteStickerReaction as jest.MockedFunction<typeof deleteStickerReaction>;

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

describe('SPEC-EMOTION-001 T-007: useStickerReaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    precheckMock.mockResolvedValue(null);
    createMock.mockResolvedValue({} as never);
    deleteMock.mockResolvedValue(undefined);
  });

  it('useCreateSticker: precheck 후 기존 반응 없으면 create 를 호출한다', async () => {
    precheckMock.mockResolvedValue(null);
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await result.current.mutateAsync('empathy');

    expect(precheckMock).toHaveBeenCalledWith('r1', 'u1');
    expect(createMock).toHaveBeenCalledWith({
      recordId: 'r1', stickerType: 'empathy', userId: 'u1',
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('useCreateSticker: precheck 에 기존 반응이 있으면 create 를 호출하지 않는다 (409 사전 방지)', async () => {
    precheckMock.mockResolvedValue({ id: 's1', sticker_type: 'empathy' });
    const client = createClient();

    const { result } = renderHook(
      () => useCreateSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await expect(result.current.mutateAsync('touching')).rejects.toBeDefined();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('useCreateSticker: 서버 409(23505 VALIDATION) 수신 시 AppError 를 전파한다 (EC-11)', async () => {
    precheckMock.mockResolvedValue(null);
    const conflict = new AppError('duplicate', '23505', 409);
    conflict.category = 'VALIDATION';
    createMock.mockRejectedValue(conflict);
    const client = createClient();

    const { result } = renderHook(
      () => useCreateSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await expect(result.current.mutateAsync('empathy')).rejects.toMatchObject({
      category: 'VALIDATION',
    });
  });

  it('useDeleteSticker: 성공 시 emotion 캐시를 invalidate 한다', async () => {
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () => useDeleteSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await result.current.mutateAsync();

    expect(deleteMock).toHaveBeenCalledWith('r1', 'u1');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('useReplaceSticker: DELETE → POST 순차 실행 (시나리오 3.7)', async () => {
    const client = createClient();

    const { result } = renderHook(
      () => useReplaceSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await result.current.mutateAsync('touching');

    expect(deleteMock).toHaveBeenCalledWith('r1', 'u1');
    expect(createMock).toHaveBeenCalledWith({
      recordId: 'r1', stickerType: 'touching', userId: 'u1',
    });
  });

  it('useReplaceSticker: POST 단계 실패 시 에러를 전파한다 (중간 실패)', async () => {
    const conflict = new AppError('dup', '23505', 409);
    conflict.category = 'VALIDATION';
    createMock.mockRejectedValue(conflict);
    const client = createClient();

    const { result } = renderHook(
      () => useReplaceSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await expect(result.current.mutateAsync('touching')).rejects.toMatchObject({
      category: 'VALIDATION',
    });
    // DELETE 는 호출되었지만 최종적으로 실패
    expect(deleteMock).toHaveBeenCalled();
  });

  it('useCreateSticker: 성공 후 emotion list 키를 invalidate 한다 (sticker 집계는 list 에 포함)', async () => {
    const client = createClient();
    const invalidateSpy = jest.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateSticker({ recordId: 'r1', userId: 'u1', bookId: 'b1' }),
      { wrapper: wrapper(client) },
    );

    await result.current.mutateAsync('empathy');

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.arrayContaining(['emotion']),
      }),
    );
  });
});
