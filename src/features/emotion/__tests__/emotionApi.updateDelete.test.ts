/**
 * emotionApi.update / delete 단위 테스트 (SPEC-EMOTION-001 T-004)
 *
 * 검증 대상 (시나리오 1.8, 1.9, 1.10, 1.11, 1.12, 4.5, 4.6):
 * - update 본인 성공 (content/visibility/clubId 만 patch)
 * - update 시 page_number/user_id/book_id 는 patch 에서 제외 (시나리오 1.10)
 * - update 타인 → RLS 거부 → RLS_DENIED
 * - update visibility=public 전환 시 club_id=null (시나리오 4.6)
 * - update visibility=club 전환 시 club_id 설정 (시나리오 4.5)
 * - delete 본인 성공
 * - delete 타인 → RLS_DENIED
 */
import { updateEmotionRecord, deleteEmotionRecord } from '../emotionApi';
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

describe('SPEC-EMOTION-001 T-004: emotionApi.update / delete', () => {
  describe('updateEmotionRecord', () => {
    const updateMock = jest.fn();
    const firstEq = jest.fn();
    const secondEq = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      secondEq.mockResolvedValue({ data: [], error: null });
      firstEq.mockReturnValue({ eq: secondEq });
      updateMock.mockReturnValue({ eq: firstEq });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ update: updateMock }),
      });
    });

    it('시나리오 1.8: 본인 기록 content 만 patch 한다', async () => {
      await updateEmotionRecord('r1', {
        content: '수정된 내용',
      }, 'u1');

      expect(updateMock).toHaveBeenCalledWith({ content: '수정된 내용' });
      expect(firstEq).toHaveBeenCalledWith('id', 'r1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('시나리오 1.10: patch 는 page_number/user_id/book_id 를 포함하지 않는다', async () => {
      await updateEmotionRecord('r1', { content: 'x' }, 'u1');

      const payload = updateMock.mock.calls[0][0];
      expect(payload).not.toHaveProperty('page_number');
      expect(payload).not.toHaveProperty('user_id');
      expect(payload).not.toHaveProperty('book_id');
    });

    it('시나리오 4.5: visibility=club 전환 시 club_id 를 설정한다', async () => {
      await updateEmotionRecord('r1', {
        visibility: 'club', clubId: 'C1',
      }, 'u1');

      expect(updateMock).toHaveBeenCalledWith({
        visibility: 'club', club_id: 'C1',
      });
    });

    it('시나리오 4.6: visibility=public 전환 시 club_id 를 null 로 설정한다', async () => {
      await updateEmotionRecord('r1', {
        visibility: 'public', clubId: null,
      }, 'u1');

      expect(updateMock).toHaveBeenCalledWith({
        visibility: 'public', club_id: null,
      });
    });

    it('시나리오 1.9: 타인 기록 update 시 RLS 거부 → RLS_DENIED', async () => {
      secondEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(
        updateEmotionRecord('r-other', { content: 'x' }, 'u1'),
      ).rejects.toMatchObject({ category: 'RLS_DENIED' });
    });
  });

  describe('deleteEmotionRecord', () => {
    const deleteMock = jest.fn();
    const firstEq = jest.fn();
    const secondEq = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      secondEq.mockResolvedValue({ data: null, error: null });
      firstEq.mockReturnValue({ eq: secondEq });
      deleteMock.mockReturnValue({ eq: firstEq });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ delete: deleteMock }),
      });
    });

    it('시나리오 1.11: 본인 기록 delete — id + user_id 복합 조건', async () => {
      await deleteEmotionRecord('r1', 'u1');

      expect(firstEq).toHaveBeenCalledWith('id', 'r1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('시나리오 1.12: 타인 기록 delete 시 RLS 거부 → RLS_DENIED', async () => {
      secondEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(deleteEmotionRecord('r-other', 'u1')).rejects.toMatchObject({
        category: 'RLS_DENIED',
      });
    });
  });
});
