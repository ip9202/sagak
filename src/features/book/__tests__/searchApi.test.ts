/**
 * searchBooks 단위 테스트 (REQ-BOOK-001, REQ-BOOK-005, 시나리오 S5/S21)
 *
 * 빈/공백 쿼리 차단(REQ-BOOK-005) 및 invokeEdgeFunction 위임을 검증.
 */
import { searchBooks } from '../searchApi';
import { invokeEdgeFunction } from '../../../lib/api/edgeFunctions';
import { AppError } from '../../../errors';

jest.mock('../../../lib/api/edgeFunctions', () => ({
  invokeEdgeFunction: jest.fn(),
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

describe('searchBooks (REQ-BOOK-001/005, 시나리오 S5/S21)', () => {
  const mockedInvoke = invokeEdgeFunction as jest.MockedFunction<
    typeof invokeEdgeFunction
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('빈 쿼리를 차단하고 AppError 를 throw 한다 (REQ-BOOK-005, 시나리오 S5)', async () => {
    await expect(searchBooks('', 'title')).rejects.toMatchObject({
      name: 'AppError',
      category: 'VALIDATION',
    });
    // Edge Function 이 호출되지 않아야 한다
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it('공백만 있는 쿼리를 차단한다 (REQ-BOOK-005)', async () => {
    await expect(searchBooks('   ', 'title')).rejects.toMatchObject({
      category: 'VALIDATION',
    });
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it('유효한 쿼리 시 invokeEdgeFunction 을 호출한다 (REQ-BOOK-001)', async () => {
    const mockResults = [
      {
        title: '호모 데우스',
        authors: ['유발 하라리'],
        publisher: '김영사',
        published_at: '2017-01-20',
        cover_url: 'https://example.com/cover.jpg',
        isbn: '9791186565873',
        kakao_id: null,
        total_pages: null,
      },
    ];
    mockedInvoke.mockResolvedValue({ data: mockResults } as never);

    const result = await searchBooks('호모 데우스', 'title');

    // @MX:NOTE: [AUTO] 응답 계약: { data: SearchResult[] } — Edge Function 반환 형태
    expect(mockedInvoke).toHaveBeenCalledWith('kakao-book-search', {
      query: '호모 데우스',
      target: 'title',
    });
    expect(result).toEqual(mockResults);
  });

  it('target=isbn 도 전달된다', async () => {
    mockedInvoke.mockResolvedValue({ data: [] } as never);

    await searchBooks('9791186565873', 'isbn');

    expect(mockedInvoke).toHaveBeenCalledWith('kakao-book-search', {
      query: '9791186565873',
      target: 'isbn',
    });
  });

  it('Edge Function 에러 시 AppError 로 전파된다 (REQ-BOOK-004)', async () => {
    const appErr = new AppError('boom', 'KAKAO_API_ERROR', 401);
    appErr.category = 'SERVER';
    mockedInvoke.mockRejectedValue(appErr);

    await expect(searchBooks('x', 'title')).rejects.toBe(appErr);
  });

  it('빈 결과 시 빈 배열을 반환한다 (REQ-BOOK-016, 시나리오 S21)', async () => {
    mockedInvoke.mockResolvedValue({ data: [] } as never);

    const result = await searchBooks('9999999999999', 'isbn');

    expect(result).toEqual([]);
  });
});
