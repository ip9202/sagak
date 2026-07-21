/**
 * SPEC-CLUB-002 M1: clubApi 단위 테스트
 *
 * 검증 대상 (acceptance S1~S12):
 * - createClub: clubs INSERT (type='group' 강제, host_id 주입, name 매핑)
 *   - REQ-CLUBB-002: type='group' 강제 (instant 입력 거부)
 *   - REQ-CLUBB-003: 0명 출발 허용 (max_members 미전달 또는 0 허용)
 *   - REQ-CLUBB-005: .select().single() 반환
 *   - RLS/네트워크 에러 정규화
 * - verifyHostMembership: club_members 재조회로 트리거 동작 관측 (REQ-CLUBB-007)
 * - getClubDetail: clubs 단일 행 조회 (REQ-CLUBB-017)
 */
import {
  createClub,
  verifyHostMembership,
  getClubDetail,
} from '../clubApi';
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

describe('SPEC-CLUB-002 M1 REQ-CLUBB-001~005: createClub', () => {
  let fromMock: jest.Mock;
  let insertMock: jest.Mock;
  let selectMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    insertMock = jest.fn();
    selectMock = jest.fn();
    fromMock = jest.fn().mockReturnValue({ insert: insertMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  it('clubs 에 (book_id, host_id, name, type=group) 을 INSERT 한다 (REQ-CLUBB-001, S1)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'c1',
            book_id: 'b1',
            host_id: 'u1',
            name: '함께 읽기',
            type: 'group',
            status: 'active',
            description: null,
            max_members: null,
            created_at: '2026-06-19T00:00:00Z',
          },
          error: null,
        }),
      }),
    });

    const result = await createClub({
      bookId: 'b1',
      hostId: 'u1',
      name: '함께 읽기',
    });

    // type='group' 이 INSERT 본문에 강제 포함되어야 함 (REQ-CLUBB-002)
    expect(insertMock).toHaveBeenCalledWith({
      book_id: 'b1',
      host_id: 'u1',
      name: '함께 읽기',
      type: 'group',
    });
    expect(result.id).toBe('c1');
    expect(result.type).toBe('group');
    expect(result.status).toBe('active');
  });

  it('description, max_members 를 선택적으로 포함한다 (REQ-CLUBB-004, S5)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'c2', type: 'group', status: 'active' },
          error: null,
        }),
      }),
    });

    await createClub({
      bookId: 'b1',
      hostId: 'u1',
      name: '모임',
      description: '설명',
      maxMembers: 10,
    });

    expect(insertMock).toHaveBeenCalledWith({
      book_id: 'b1',
      host_id: 'u1',
      name: '모임',
      type: 'group',
      description: '설명',
      max_members: 10,
    });
  });

  it('0명 출발을 허용한다 (max_members 미전달 시에도 성공, REQ-CLUBB-003, S4)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'c3', type: 'group', status: 'active', max_members: null },
          error: null,
        }),
      }),
    });

    const result = await createClub({
      bookId: 'b1',
      hostId: 'u1',
      name: '0명 출발',
    });

    // max_members 가 payload 에 포함되지 않아야 함 (게이트 아님)
    expect(insertMock).toHaveBeenCalledWith({
      book_id: 'b1',
      host_id: 'u1',
      name: '0명 출발',
      type: 'group',
    });
    expect(result.status).toBe('active');
  });

  it('INSERT 에러 시 normalizeError 로 AppError throw (RLS 거부)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
      }),
    });

    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
  });

  it('쿼리 throw(네트워크) 시 normalizeError 를 거쳐 NETWORK 분류', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    });

    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'NETWORK' });
  });
});

describe('SPEC-CLUB-002 M1 REQ-CLUBB-003: createClub max_members 입력 검증 (W3)', () => {
  let fromMock: jest.Mock;
  let insertMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    insertMock = jest.fn();
    fromMock = jest.fn().mockReturnValue({ insert: insertMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  it('음수 maxMembers 시 VALIDATION 에러 throw, INSERT 미호출', async () => {
    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임', maxMembers: -1 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('0 maxMembers 시 VALIDATION 에러 throw (0명 출발은 미전달로 달성)', async () => {
    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임', maxMembers: 0 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('비정수 maxMembers 시 VALIDATION 에러 throw', async () => {
    await expect(
      createClub({
        bookId: 'b1',
        hostId: 'u1',
        name: '모임',
        maxMembers: 3.5 as unknown as number,
      }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('양수 정수 maxMembers 는 허용된다 (>= 1)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'c2', type: 'group', status: 'active' },
          error: null,
        }),
      }),
    });

    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임', maxMembers: 10 }),
    ).resolves.toBeDefined();
    expect(insertMock).toHaveBeenCalledWith({
      book_id: 'b1',
      host_id: 'u1',
      name: '모임',
      type: 'group',
      max_members: 10,
    });
  });

  it('1 maxMembers 도 허용된다 (최소 상한)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'c2', type: 'group', status: 'active' },
          error: null,
        }),
      }),
    });

    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임', maxMembers: 1 }),
    ).resolves.toBeDefined();
  });

  it('maxMembers=null 은 허용된다 (NULL 명시 초기화)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'c2', type: 'group', status: 'active' },
          error: null,
        }),
      }),
    });

    await expect(
      createClub({ bookId: 'b1', hostId: 'u1', name: '모임', maxMembers: null }),
    ).resolves.toBeDefined();
  });
});

describe('SPEC-CLUB-002 M1 REQ-CLUBB-007: verifyHostMembership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('club_members 에 host 행이 존재하면 true 반환 (트리거 정상 동작, S10)', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: { club_id: 'c1', user_id: 'u1', role: 'host' },
      error: null,
    });
    const eq3 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await verifyHostMembership({ clubId: 'c1', hostId: 'u1' });

    expect(fromMock2).toHaveBeenCalledWith('club_members');
    expect(eq1).toHaveBeenCalledWith('club_id', 'c1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'u1');
    expect(eq3).toHaveBeenCalledWith('role', 'host');
    expect(result).toBe(true);
  });

  it('host 행이 없으면 false 반환 (트리거 실패 감지, S11)', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eq3 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await verifyHostMembership({ clubId: 'c1', hostId: 'u1' });
    expect(result).toBe(false);
  });

  it('조회 에러 시 AppError throw', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const eq3 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq2 = jest.fn().mockReturnValue({ eq: eq3 });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(
      verifyHostMembership({ clubId: 'c1', hostId: 'u1' }),
    ).rejects.toMatchObject({ name: 'AppError' });
  });
});

describe('SPEC-CLUB-002 M3 REQ-CLUBB-017: getClubDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clubs 단일 행을 조회한다 (모든 authenticated 조회 허용, S22)', async () => {
    const singleMock = jest.fn().mockResolvedValue({
      data: {
        id: 'c1',
        book_id: 'b1',
        host_id: 'u1',
        name: '모임',
        type: 'group',
        status: 'active',
      },
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ single: singleMock });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await getClubDetail('c1');

    expect(fromMock2).toHaveBeenCalledWith('clubs');
    expect(eqMock).toHaveBeenCalledWith('id', 'c1');
    expect(result?.id).toBe('c1');
  });

  it('조회 에러 시 AppError throw', async () => {
    const singleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    const eqMock = jest.fn().mockReturnValue({ single: singleMock });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(getClubDetail('c1')).rejects.toMatchObject({
      name: 'AppError',
    });
  });
});
