/**
 * completionDiaryListApi 단위 테스트 (SPEC-COMPLETION-002, REQ-COMP2-002)
 *
 * 검증 대상 (시나리오 2, 3, 18):
 * - PostgREST 조인 select 문자열 (user_books + books + completion_reports)
 * - status='completed' 필터, completed_at DESC 정렬
 * - report_data 파싱: totalRecords, recentHighlight(highlights[0].content)
 * - 리포트 없는 completed 항목 → totalRecords=0, recentHighlight=null (LEFT JOIN)
 * - report_data 스키마 불일치 → totalRecords=0, recentHighlight=null (lenient, 리스트는 break 안 함)
 * - book null → title='(제목 없음)', coverUrl=null
 * - RLS: user_id 를 쿼리에 전송하지 않는다
 * - 빈 응답 → []
 */
import { fetchCompletionDiaryList } from '../completionDiaryListApi';
import { getSupabaseClient } from '../../../../lib/supabase/client';

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

const VALID_REPORT = {
  emotion_curve: [{ page_number: 42, emotion_count: 3 }],
  highlights: [
    { page_number: 42, content: '마음이 찡해졌다' },
    { page_number: 118, content: '두 번째' },
  ],
  total_records: 12,
};

describe('SPEC-COMPLETION-002: completionDiaryListApi.fetchCompletionDiaryList', () => {
  const selectMock = jest.fn();
  const eqMock = jest.fn();
  const orderMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // 체이닝: from().select(...) -> eq(...) -> order(...)
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ order: orderMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('select 문자열이 books + completion_reports 조인을 포함한다', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });
    await fetchCompletionDiaryList();
    expect(selectMock).toHaveBeenCalledTimes(1);
    const selectArg = selectMock.mock.calls[0][0] as string;
    // books 조인 (FK embedded)
    expect(selectArg).toContain('books(id,title,author,cover_url)');
    // completion_reports 조인 (FK embedded, report_data 만 선택)
    expect(selectArg).toContain('completion_reports(report_data)');
    // user_books 본문 컬럼
    expect(selectArg).toContain('id');
    expect(selectArg).toContain('book_id');
    expect(selectArg).toContain('completed_at');
  });

  it('status=eq.completed 필터와 completed_at DESC 정렬을 적용한다', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });
    await fetchCompletionDiaryList();
    expect(eqMock).toHaveBeenCalledWith('status', 'completed');
    expect(orderMock).toHaveBeenCalledWith('completed_at', { ascending: false });
  });

  it('시나리오 2: 유효 report_data 에서 totalRecords 와 recentHighlight 를 파싱한다', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-1',
          book_id: 'b-1',
          completed_at: '2026-06-20T00:00:00Z',
          books: { id: 'b-1', title: '책 A', author: '저자', cover_url: 'https://x/a.png' },
          completion_reports: { report_data: VALID_REPORT },
        },
      ],
      error: null,
    });

    const result = await fetchCompletionDiaryList();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userBookId: 'ub-1',
      bookId: 'b-1',
      title: '책 A',
      author: '저자',
      coverUrl: 'https://x/a.png',
      completedAt: '2026-06-20T00:00:00Z',
      totalRecords: 12,
      recentHighlight: '마음이 찡해졌다',
    });
  });

  it('시나리오 18: completion_reports 행이 없으면 totalRecords=0, recentHighlight=null', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-2',
          book_id: 'b-2',
          completed_at: '2026-06-01T00:00:00Z',
          books: { id: 'b-2', title: '책 B', author: null, cover_url: null },
          completion_reports: null,
        },
      ],
      error: null,
    });

    const result = await fetchCompletionDiaryList();
    expect(result[0].totalRecords).toBe(0);
    expect(result[0].recentHighlight).toBeNull();
    // 항목이 누락되지 않음 (LEFT JOIN 동작)
    expect(result).toHaveLength(1);
  });

  it('completion_reports 가 null 이어도 totalRecords=0 폴백', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-3',
          book_id: 'b-3',
          completed_at: null,
          books: { id: 'b-3', title: '책 C', author: 'C', cover_url: null },
          completion_reports: null,
        },
      ],
      error: null,
    });
    const result = await fetchCompletionDiaryList();
    expect(result[0].totalRecords).toBe(0);
    expect(result[0].recentHighlight).toBeNull();
    expect(result[0].completedAt).toBeNull();
  });

  it('report_data 스키마 불일치 시 lenient 폴백 (totalRecords=0, recentHighlight=null), throw 안 함', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-4',
          book_id: 'b-4',
          completed_at: '2026-05-01T00:00:00Z',
          books: { id: 'b-4', title: '책 D', author: 'D', cover_url: null },
          completion_reports: { report_data: { broken: true } },
        },
      ],
      error: null,
    });
    // 리스트는 한 행의 bad report 로 전체가 break 되지 않는다 (lenient).
    const result = await fetchCompletionDiaryList();
    expect(result).toHaveLength(1);
    expect(result[0].totalRecords).toBe(0);
    expect(result[0].recentHighlight).toBeNull();
  });

  it('highlights 가 빈 배열이면 recentHighlight=null', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-5',
          book_id: 'b-5',
          completed_at: '2026-04-01T00:00:00Z',
          books: { id: 'b-5', title: '책 E', author: null, cover_url: null },
          completion_reports: {
            report_data: {
              emotion_curve: [],
              highlights: [],
              total_records: 0,
            },
          },
        },
      ],
      error: null,
    });
    const result = await fetchCompletionDiaryList();
    expect(result[0].recentHighlight).toBeNull();
    expect(result[0].totalRecords).toBe(0);
  });

  it('book 이 null 이면 title="(제목 없음)", coverUrl=null', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-6',
          book_id: 'b-6',
          completed_at: '2026-03-01T00:00:00Z',
          books: null,
          completion_reports: { report_data: VALID_REPORT },
        },
      ],
      error: null,
    });
    const result = await fetchCompletionDiaryList();
    expect(result[0].title).toBe('(제목 없음)');
    expect(result[0].author).toBeNull();
    expect(result[0].coverUrl).toBeNull();
    expect(result[0].bookId).toBe('b-6');
  });

  it('RLS: user_id 를 쿼리 조건으로 전송하지 않는다 (auth.uid() 자동 필터)', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });
    await fetchCompletionDiaryList();
    const allEqArgs = eqMock.mock.calls.map((c) => c[0]);
    expect(allEqArgs).not.toContain('user_id');
  });

  it('빈 응답(data=[]) → 빈 배열 반환', async () => {
    orderMock.mockResolvedValue({ data: [], error: null });
    const result = await fetchCompletionDiaryList();
    expect(result).toEqual([]);
  });

  it('data=null → 빈 배열 반환', async () => {
    orderMock.mockResolvedValue({ data: null, error: null });
    const result = await fetchCompletionDiaryList();
    expect(result).toEqual([]);
  });

  it('쿼리 에러 시 throw (정규화)', async () => {
    orderMock.mockResolvedValue({ data: null, error: new Error('network failed') });
    await expect(fetchCompletionDiaryList()).rejects.toThrow();
  });

  it('여러 항목이 completed_at DESC 순으로 반환된다 (DB 정렬 결과 그대로)', async () => {
    orderMock.mockResolvedValue({
      data: [
        {
          id: 'ub-a',
          book_id: 'b-a',
          completed_at: '2026-06-20T00:00:00Z',
          books: { id: 'b-a', title: 'A', author: null, cover_url: null },
          completion_reports: null,
        },
        {
          id: 'ub-b',
          book_id: 'b-b',
          completed_at: '2026-05-20T00:00:00Z',
          books: { id: 'b-b', title: 'B', author: null, cover_url: null },
          completion_reports: null,
        },
      ],
      error: null,
    });
    const result = await fetchCompletionDiaryList();
    expect(result).toHaveLength(2);
    expect(result[0].userBookId).toBe('ub-a');
    expect(result[1].userBookId).toBe('ub-b');
  });
});
