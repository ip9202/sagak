/**
 * SPEC-CLUB-002 M3: memberApi 단위 테스트
 *
 * 검증 대상 (acceptance S17~S23):
 * - getClubMembers: club_members SELECT (REQ-CLUBB-013)
 * - closeClub / reactivateClub: clubs status UPDATE (REQ-CLUBB-014/015)
 * - leaveClub: club_members DELETE 본인 멤버십 (REQ-CLUBB-016)
 *   - RLS DELETE(auth.uid() = user_id)에 의해 본인만 삭제
 */
import {
  getClubMembers,
  closeClub,
  reactivateClub,
  leaveClub,
} from '../memberApi';
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
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('SPEC-CLUB-002 M3 REQ-CLUBB-013: getClubMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('club_id 로 모임 멤버 목록을 조회한다 (S17)', async () => {
    const eqMock = jest.fn().mockResolvedValue({
      data: [
        { id: 'm1', club_id: 'c1', user_id: 'u1', role: 'host' },
        { id: 'm2', club_id: 'c1', user_id: 'u2', role: 'member' },
      ],
      error: null,
    });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    const result = await getClubMembers('c1');

    expect(fromMock).toHaveBeenCalledWith('club_members');
    expect(eqMock).toHaveBeenCalledWith('club_id', 'c1');
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('host');
    expect(result[1].role).toBe('member');
  });

  it('조회 에러 시 AppError throw (RLS 거부)', async () => {
    const eqMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(getClubMembers('c1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('빈 결과 시 빈 배열 반환', async () => {
    const eqMock = jest.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ select: selectMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    const result = await getClubMembers('c1');
    expect(result).toEqual([]);
  });
});

describe('SPEC-CLUB-002 M3 REQ-CLUBB-014: closeClub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clubs status 를 closed 로 UPDATE 한다 (S18)', async () => {
    const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await closeClub('c1');

    expect(updateMock).toHaveBeenCalledWith({ status: 'closed' });
    expect(eqMock).toHaveBeenCalledWith('id', 'c1');
  });

  it('RLS 거부(비host) 시 RLS_DENIED 분류 (S23)', async () => {
    const eqMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(closeClub('c1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('쿼리 throw 시 normalizeError', async () => {
    const eqMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(closeClub('c1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});

describe('SPEC-CLUB-002 M3 REQ-CLUBB-015: reactivateClub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clubs status 를 active 로 UPDATE 한다 (closed -> active, S19)', async () => {
    const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await reactivateClub('c1');

    expect(updateMock).toHaveBeenCalledWith({ status: 'active' });
    expect(eqMock).toHaveBeenCalledWith('id', 'c1');
  });

  it('RLS 거부(비host) 시 RLS_DENIED 분류', async () => {
    const eqMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(reactivateClub('c1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });
});

describe('SPEC-CLUB-002 M3 REQ-CLUBB-016: leaveClub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('club_members 에서 본인 멤버십을 DELETE 한다 (S20)', async () => {
    const eq2 = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const deleteMock = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock = jest.fn().mockReturnValue({ delete: deleteMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await leaveClub({ clubId: 'c1', userId: 'u1' });

    expect(fromMock).toHaveBeenCalledWith('club_members');
    expect(eq1).toHaveBeenCalledWith('club_id', 'c1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('RLS 거부(타인 멤버십 삭제 시도) 시 RLS_DENIED 분류', async () => {
    const eq2 = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const deleteMock = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock = jest.fn().mockReturnValue({ delete: deleteMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      leaveClub({ clubId: 'c1', userId: 'u1' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
  });

  it('쿼리 throw 시 normalizeError', async () => {
    const eq2 = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const deleteMock = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock = jest.fn().mockReturnValue({ delete: deleteMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      leaveClub({ clubId: 'c1', userId: 'u1' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'NETWORK' });
  });
});
