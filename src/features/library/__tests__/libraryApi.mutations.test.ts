/**
 * libraryApi mutations 단위 테스트 (updateProgress/updateStatus/updateVisibility)
 * SPEC-LIBRARY-001 — TASK-005
 *
 * 검증 대상:
 * - updateProgress: current_page 만 UPDATE (last_progress_at 미포함 — DB 트리거 관리)
 * - updateStatus: status UPDATE
 * - updateVisibility: is_public UPDATE
 * - validatePage 통과 후에만 updateProgress 가 실행된다 (통합)
 */
import { updateProgress, updateStatus, updateVisibility } from '../libraryApi';
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

describe('SPEC-LIBRARY-001 TASK-005: libraryApi mutations', () => {
  describe('updateProgress', () => {
    const updateMock = jest.fn();
    const eqMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      // eqMock 체인: eq().eq() → thenable 최종 결과. mockReturnValueOnce 로 첫 eq 호출은 { eq: eqMock } 반환, 두 번째 호출은 Promise resolve.
      updateMock.mockReturnValue({ eq: eqMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ update: updateMock }),
      });
    });

    it('current_page 만 UPDATE 한다 — payload 에 last_progress_at 미포함 (AC-TRIG-001)', async () => {
      eqMock.mockReturnValueOnce({ eq: eqMock }); // 첫 번째 eq('id', ...) → { eq }
      eqMock.mockResolvedValueOnce({ data: null, error: null }); // 두 번째 eq('user_id', ...) → resolved

      await updateProgress({ id: 'ub-1', userId: 'u-1', currentPage: 120 });

      expect(updateMock).toHaveBeenCalledWith({ current_page: 120 });
      expect(eqMock).toHaveBeenNthCalledWith(1, 'id', 'ub-1');
      expect(eqMock).toHaveBeenNthCalledWith(2, 'user_id', 'u-1');
    });

    it('음수 currentPage 는 VALIDATION 에러로 사전 차단된다 (DB 호출 없음)', async () => {
      await expect(
        updateProgress({ id: 'ub-1', userId: 'u-1', currentPage: -5 }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
      eqMock.mockReturnValueOnce({ eq: eqMock });
      eqMock.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(
        updateProgress({ id: 'ub-1', userId: 'u-1', currentPage: 50 }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
    });
  });

  describe('updateStatus', () => {
    const updateMock = jest.fn();
    const eqMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      updateMock.mockReturnValue({ eq: eqMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ update: updateMock }),
      });
    });

    it('status 만 UPDATE 한다', async () => {
      eqMock.mockReturnValueOnce({ eq: eqMock });
      eqMock.mockResolvedValueOnce({ data: null, error: null });

      await updateStatus({ id: 'ub-1', userId: 'u-1', status: 'completed' });

      expect(updateMock).toHaveBeenCalledWith({ status: 'completed' });
      expect(eqMock).toHaveBeenNthCalledWith(1, 'id', 'ub-1');
      expect(eqMock).toHaveBeenNthCalledWith(2, 'user_id', 'u-1');
    });

    it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
      eqMock.mockReturnValueOnce({ eq: eqMock });
      eqMock.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(
        updateStatus({ id: 'ub-1', userId: 'u-1', status: 'reading' }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
    });
  });

  describe('updateVisibility', () => {
    const updateMock = jest.fn();
    const eqMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      updateMock.mockReturnValue({ eq: eqMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ update: updateMock }),
      });
    });

    it('is_public 만 UPDATE 한다', async () => {
      eqMock.mockReturnValueOnce({ eq: eqMock });
      eqMock.mockResolvedValueOnce({ data: null, error: null });

      await updateVisibility({ id: 'ub-1', userId: 'u-1', isPublic: true });

      expect(updateMock).toHaveBeenCalledWith({ is_public: true });
      expect(eqMock).toHaveBeenNthCalledWith(1, 'id', 'ub-1');
      expect(eqMock).toHaveBeenNthCalledWith(2, 'user_id', 'u-1');
    });
  });
});
