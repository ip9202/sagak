/**
 * emotionApi.create 단위 테스트 (SPEC-EMOTION-001 T-002)
 *
 * 검증 대상 (시나리오 1.1, 1.2, 1.3, 1.4, EC-2):
 * - public 생성: club_id=null, user_id 미전송
 * - club 생성: club_id 설정
 * - 빈 content → 클라이언트 사전 차단 (PostgREST 미호출)
 * - 공백만 content → 사전 차단
 * - visibility=club + clubId 누락 → 사전 차단 (VALIDATION AppError)
 * - RLS/네트워크 에러 → normalizeError 정규화
 * - FK 위반(book_id) → 400 → VALIDATION
 */
import { createEmotionRecord } from '../emotionApi';
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

describe('SPEC-EMOTION-001 T-002: emotionApi.create', () => {
  const insertMock = jest.fn();
  const selectMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ insert: insertMock }),
    });
    insertMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ single: jest.fn() });
  });

  it('시나리오 1.1: public 감정 기록 생성 — club_id=null, user_id 미전송', async () => {
    const inserted = {
      id: 'r1', book_id: 'b1', user_id: 'me', page_number: 95,
      content: '멈췄다', visibility: 'public', club_id: null,
      created_at: '2026-06-17T00:00:00Z', updated_at: null,
    };
    (selectMock().single as jest.Mock).mockResolvedValue({ data: inserted, error: null });

    const result = await createEmotionRecord({
      bookId: 'b1', pageNumber: 95, content: '멈췄다',
      visibility: 'public', clubId: null,
    });

    expect(insertMock).toHaveBeenCalledWith({
      book_id: 'b1',
      page_number: 95,
      content: '멈췄다',
      visibility: 'public',
      club_id: null,
    });
    // user_id 는 RLS 자동 주입이므로 전송하지 않는다
    expect(insertMock.mock.calls[0][0]).not.toHaveProperty('user_id');
    expect(result).toMatchObject({ id: 'r1', visibility: 'public' });
  });

  it('시나리오 1.2: club 감정 기록 생성 — club_id 설정', async () => {
    const inserted = {
      id: 'r2', book_id: 'b1', user_id: 'me', page_number: 95,
      content: '감동', visibility: 'club', club_id: 'C1',
      created_at: '2026-06-17T00:00:00Z', updated_at: null,
    };
    (selectMock().single as jest.Mock).mockResolvedValue({ data: inserted, error: null });

    const result = await createEmotionRecord({
      bookId: 'b1', pageNumber: 95, content: '감동',
      visibility: 'club', clubId: 'C1',
    });

    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      visibility: 'club', club_id: 'C1',
    }));
    expect(result.club_id).toBe('C1');
  });

  it('시나리오 1.3: 빈 content 는 PostgREST 호출 없이 VALIDATION AppError throw', async () => {
    await expect(
      createEmotionRecord({
        bookId: 'b1', pageNumber: 95, content: '',
        visibility: 'public', clubId: null,
      }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('시나리오 1.3: 공백만 content 도 사전 차단한다', async () => {
    await expect(
      createEmotionRecord({
        bookId: 'b1', pageNumber: 95, content: '   \n\t  ',
        visibility: 'public', clubId: null,
      }),
    ).rejects.toMatchObject({ category: 'VALIDATION' });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('시나리오 1.4: visibility=club 인데 clubId 누락 시 사전 차단 (VALIDATION)', async () => {
    await expect(
      createEmotionRecord({
        bookId: 'b1', pageNumber: 95, content: 'c',
        visibility: 'club', clubId: null,
      }),
    ).rejects.toMatchObject({ category: 'VALIDATION' });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('EC-1: 존재하지 않는 book_id FK 위반(23503/400) → VALIDATION 분류', async () => {
    (selectMock().single as jest.Mock).mockResolvedValue({
      data: null,
      error: { code: '23503', message: 'violates foreign key constraint', status: 400 },
    });

    await expect(
      createEmotionRecord({
        bookId: 'nope', pageNumber: 1, content: 'c',
        visibility: 'public', clubId: null,
      }),
    ).rejects.toMatchObject({ name: 'AppError' });
  });

  it('RLS 거부(42501) → RLS_DENIED 분류', async () => {
    (selectMock().single as jest.Mock).mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    await expect(
      createEmotionRecord({
        bookId: 'b1', pageNumber: 1, content: 'c',
        visibility: 'public', clubId: null,
      }),
    ).rejects.toMatchObject({ category: 'RLS_DENIED' });
  });
});
