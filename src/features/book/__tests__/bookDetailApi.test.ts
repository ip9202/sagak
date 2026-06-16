/**
 * getBookDetail 단위 테스트 (REQ-BOOK-013, REQ-BOOK-015, 시나리오 S16/S19/S20)
 *
 * PostgREST SELECT(.eq('id').single()) 호출 및 PGRST116 → NOT_FOUND 분류를 검증.
 */
import { getBookDetail } from '../bookDetailApi';
import { getSupabaseClient } from '../../../lib/supabase/client';
import type { BookRow } from '../../../types/book';

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

describe('getBookDetail (REQ-BOOK-013/015, 시나리오 S16/S19/S20)', () => {
  const singleMock = jest.fn();
  const eqMock = jest.fn();
  const selectMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ single: singleMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('bookId 로 books SELECT(.eq(id).single()) 를 실행한다 (REQ-BOOK-015, 시나리오 S19)', async () => {
    const bookRow: BookRow = {
      id: 'uuid-1',
      isbn: '9791186565873',
      title: '호모 데우스',
      author: '유발 하라리',
      publisher: '김영사',
      published_at: '2017-01-20',
      cover_url: 'https://example.com/cover.jpg',
      total_pages: 480,
      kakao_id: null,
      created_at: '2024-06-14T00:00:00Z',
    };
    singleMock.mockResolvedValue({ data: bookRow, error: null });

    const result = await getBookDetail('uuid-1');

    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('id', 'uuid-1');
    expect(singleMock).toHaveBeenCalled();
    expect(result).toEqual(bookRow);
    expect(result.author).toBe('유발 하라리');
  });

  it('존재하지 않는 bookId(PGRST116) 시 NOT_FOUND AppError 를 throw 한다 (시나리오 S20)', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    });

    await expect(getBookDetail('nonexistent-uuid')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NOT_FOUND',
    });
  });

  it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다 (시나리오 S22)', async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(getBookDetail('uuid-1')).rejects.toMatchObject({
      category: 'RLS_DENIED',
    });
  });

  it('네트워크 에러 시 NETWORK 로 분류한다', async () => {
    singleMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(getBookDetail('uuid-1')).rejects.toMatchObject({
      category: 'NETWORK',
    });
  });
});
