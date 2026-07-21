/**
 * Edge Function 호출 래퍼 테스트 (REQ-API-004)
 *
 * 인수 시나리오 C5: invokeEdgeFunction 이 supabase.functions.invoke 에 위임하고,
 * 세션 JWT 가 자동 첨부되며, 에러가 기존 파이프라인(normalizeError)으로 정규화됨을 검증.
 */
import { invokeEdgeFunction } from '../edgeFunctions';
import { getSupabaseClient } from '../../supabase/client';
import { AppError } from '../../../errors';

// 클라이언트 모킹 — functions.invoke 를 jest.fn 으로 노출
jest.mock('../../supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('invokeEdgeFunction (REQ-API-004, 시나리오 C5)', () => {
  const invokeMock = jest.fn();
  const mockClient = { functions: { invoke: invokeMock } };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseClient as jest.Mock).mockReturnValue(mockClient);
  });

  it('성공 시 supabase.functions.invoke 에 name/body 를 전달하고 데이터를 반환한다', async () => {
    const expectedResult = { books: [{ title: '호모 데우스' }] };
    invokeMock.mockResolvedValue({ data: expectedResult, error: null });

    const result = await invokeEdgeFunction('kakao-book-search', {
      query: '호모 데우스',
    });

    expect(invokeMock).toHaveBeenCalledTimes(1);
    // C5: supabase.functions.invoke('kakao-book-search', { body: { query: '호모 데우스' } })
    expect(invokeMock).toHaveBeenCalledWith('kakao-book-search', {
      body: { query: '호모 데우스' },
    });
    expect(result).toEqual(expectedResult);
  });

  it('body 없이 호출할 수 있다', async () => {
    invokeMock.mockResolvedValue({ data: { ok: true }, error: null });

    const result = await invokeEdgeFunction('ping');

    expect(invokeMock).toHaveBeenCalledWith('ping', { body: undefined });
    expect(result).toEqual({ ok: true });
  });

  it('Supabase FunctionsError 를 AppError 로 정규화하여 throw 한다 (에러 정규화 경로)', async () => {
    const functionsError = {
      message: 'Function returned an error',
      code: '23505',
      details: 'duplicate key',
      hint: null,
    };
    invokeMock.mockResolvedValue({ data: null, error: functionsError });

    await expect(
      invokeEdgeFunction('process-join-request', { userId: 'u1' })
    ).rejects.toMatchObject({
      name: 'AppError',
      category: 'VALIDATION',
      originalError: functionsError,
    });
  });

  it('invoke 자체 throw 도 normalizeError 를 거쳐 AppError 로 변환된다', async () => {
    const networkError = new TypeError('Failed to fetch');
    invokeMock.mockRejectedValue(networkError);

    await expect(invokeEdgeFunction('send-notification')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });

  it('정규화된 에러는 AppError 인스턴스이다', async () => {
    invokeMock.mockRejectedValue(new Error('server boom'));

    try {
      await invokeEdgeFunction('generate-completion-report');
      fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});
