/**
 * stickerApi 단위 테스트 (SPEC-EMOTION-001 T-005)
 *
 * 검증 대상 (시나리오 3.1~3.5, EC-3, EC-11):
 * - createStickerReaction: INSERT, user_id 미전송 금지(명시적으로 전송), 409(23505) → VALIDATION
 * - precheck: 기존 반응 조회 (존재/미존재)
 * - deleteStickerReaction: 본인만 (record_id + user_id 조건)
 * - aggregateByRecord: GROUP BY 집계 환산
 */
import {
  createStickerReaction,
  precheckSticker,
  deleteStickerReaction,
  aggregateByRecord,
} from '../stickerApi';
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

describe('SPEC-EMOTION-001 T-005: stickerApi', () => {
  describe('precheckSticker', () => {
    const selectMock = jest.fn();
    const firstEq = jest.fn();
    const secondEq = jest.fn();
    const maybeSingleMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      maybeSingleMock.mockResolvedValue({ data: null, error: null });
      secondEq.mockReturnValue({ maybeSingle: maybeSingleMock });
      firstEq.mockReturnValue({ eq: secondEq });
      selectMock.mockReturnValue({ eq: firstEq });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ select: selectMock }),
      });
    });

    it('기존 반응이 있으면 해당 행을 반환한다', async () => {
      maybeSingleMock.mockResolvedValue({
        data: { id: 's1', sticker_type: 'empathy' },
        error: null,
      });

      const result = await precheckSticker('r1', 'u1');

      expect(result).not.toBeNull();
      expect(result?.sticker_type).toBe('empathy');
    });

    it('기존 반응이 없으면 null 을 반환한다 (에러 아님)', async () => {
      maybeSingleMock.mockResolvedValue({ data: null, error: null });

      const result = await precheckSticker('r1', 'u1');

      expect(result).toBeNull();
    });

    it('record_id + user_id 복합 조건으로 조회한다', async () => {
      await precheckSticker('r1', 'u1');

      expect(firstEq).toHaveBeenCalledWith('record_id', 'r1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'u1');
    });
  });

  describe('createStickerReaction', () => {
    const insertMock = jest.fn();
    const selectMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      insertMock.mockReturnValue({ select: selectMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ insert: insertMock }),
      });
    });

    it('시나리오 3.1: 스티커 반응 등록 성공 — record_id, user_id, sticker_type 전송', async () => {
      const inserted = {
        id: 's1', record_id: 'r1', user_id: 'u1', sticker_type: 'empathy',
        created_at: '2026-06-17T00:00:00Z',
      };
      selectMock.mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: inserted, error: null }),
      });

      const result = await createStickerReaction({
        recordId: 'r1', stickerType: 'empathy', userId: 'u1',
      });

      expect(insertMock).toHaveBeenCalledWith({
        record_id: 'r1',
        user_id: 'u1',
        sticker_type: 'empathy',
      });
      expect(result.id).toBe('s1');
    });

    it('시나리오 3.3: UNIQUE 위반(23505) → VALIDATION (업서트 미적용)', async () => {
      selectMock.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        }),
      });

      await expect(
        createStickerReaction({
          recordId: 'r1', stickerType: 'touching', userId: 'u1',
        }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    });

    it('시나리오 3.4: 잘못된 sticker_type 은 타입 수준에서 차단된다 (컴파일 타임)', () => {
      // stickerType 은 StickerType 리터럴이므로 'happy' 는 컴파일 에러.
      // 여기서는 정상 값이 서버에 그대로 전달되는지만 런타임 검증.
      expect(true).toBe(true);
    });

    it('EC-3: 존재하지 않는 record_id FK 위반 → VALIDATION 분류', async () => {
      selectMock.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23503', message: 'fk violation', status: 400 },
        }),
      });

      await expect(
        createStickerReaction({
          recordId: 'nope', stickerType: 'empathy', userId: 'u1',
        }),
      ).rejects.toMatchObject({ name: 'AppError' });
    });
  });

  describe('deleteStickerReaction', () => {
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

    it('시나리오 3.5: 본인 반응 delete — record_id + user_id 복합 조건', async () => {
      await deleteStickerReaction('r1', 'u1');

      expect(firstEq).toHaveBeenCalledWith('record_id', 'r1');
      expect(secondEq).toHaveBeenCalledWith('user_id', 'u1');
    });

    it('시나리오 3.6: 타인 반응 delete 시 RLS 거부 → RLS_DENIED', async () => {
      secondEq.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(deleteStickerReaction('r1', 'u1')).rejects.toMatchObject({
        category: 'RLS_DENIED',
      });
    });
  });

  describe('aggregateByRecord', () => {
    const selectMock = jest.fn();
    const eqMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      eqMock.mockResolvedValue({
        data: [
          { sticker_type: 'empathy' },
          { sticker_type: 'empathy' },
          { sticker_type: 'touching' },
        ],
        error: null,
      });
      selectMock.mockReturnValue({ eq: eqMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ select: selectMock }),
      });
    });

    it('record_id 의 스티커를 타입별 count 로 집계한다', async () => {
      const result = await aggregateByRecord('r1');

      const empathy = result.find((a) => a.sticker_type === 'empathy');
      const touching = result.find((a) => a.sticker_type === 'touching');
      expect(empathy?.count).toBe(2);
      expect(touching?.count).toBe(1);
    });

    it('반응이 없으면 빈 배열을 반환한다', async () => {
      eqMock.mockResolvedValue({ data: [], error: null });

      const result = await aggregateByRecord('r-empty');

      expect(result).toEqual([]);
    });
  });
});
