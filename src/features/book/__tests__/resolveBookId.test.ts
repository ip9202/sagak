/**
 * resolveBookId 단위 테스트
 * SPEC-LIBRARY-001 — TASK-002 (ISBN → UUID 매핑, blocker B 핵심)
 *
 * 검증 대상:
 * - ISBN 으로 books.select('id').eq('isbn').maybeSingle() 호출 후 UUID 반환
 * - 0행(미등록 ISBN) 시 NOT_FOUND AppError throw
 * - RLS 거부(42501) 시 RLS_DENIED 분류
 * - 네트워크 throw 도 normalizeError 로 정규화
 */
import { resolveBookId } from '../resolveBookId';
import { getSupabaseClient } from '../../../lib/supabase/client';

jest.mock('../../../lib/supabase/client', () => ({
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

describe('SPEC-LIBRARY-001 TASK-002: resolveBookId (ISBN→UUID 매핑)', () => {
  const maybeSingleMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('ISBN 으로 books.id 조회(maybeSingle) 후 UUID 를 반환한다', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'uuid-abc-123' },
      error: null,
    });

    const id = await resolveBookId('9791186565873');

    // select('id') 호출 — 전체 행이 아닌 id 컬럼만 요청
    expect(selectMock).toHaveBeenCalledWith('id');
    expect(eqMock).toHaveBeenCalledWith('isbn', '9791186565873');
    expect(maybeSingleMock).toHaveBeenCalled();
    expect(id).toBe('uuid-abc-123');
  });

  it('미등록 ISBN(data=null, error=null) 시 NOT_FOUND AppError 를 throw 한다', async () => {
    // maybeSingle 은 0행일 때 { data: null, error: null } 반환 (single 과 다름)
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(resolveBookId('9791199999999')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NOT_FOUND',
    });
  });

  it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(resolveBookId('9791186565873')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('네트워크 예외 throw 도 normalizeError 로 정규화된다', async () => {
    const networkError = new TypeError('Failed to fetch');
    maybeSingleMock.mockRejectedValue(networkError);

    await expect(resolveBookId('9791186565873')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});
