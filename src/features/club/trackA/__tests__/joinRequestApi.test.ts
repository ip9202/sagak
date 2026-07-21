/**
 * SPEC-CLUB-001 T-004/T-006/T-007: joinRequestApi 단위 테스트
 *
 * 검증 대상:
 * - createJoinRequest: join_requests INSERT (status=pending DB 기본값)
 *   - UNIQUE 23505 → VALIDATION (이미 요청 보냄)
 *   - E4 message 길이 500자 초과 선검증 (이중 방어)
 * - fetchMyJoinRequests: requester_id 본인 요청 조회
 * - fetchIncomingJoinRequests: host 수신 요청 조회
 * - respondToJoinRequest: status UPDATE (accepted/declined)
 *   - terminal 트리거 예외 → VALIDATION (이미 처리된 요청) → getUserFriendlyMessage 매핑
 * - confirmMembership: club_members 재조회로 트리거 동작 관측
 */
import {
  createJoinRequest,
  fetchMyJoinRequests,
  fetchIncomingJoinRequests,
  respondToJoinRequest,
  confirmMembership,
} from '../joinRequestApi';
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

describe('SPEC-CLUB-001 T-004: createJoinRequest', () => {
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

  it('join_requests 에 (club_id, requester_id, message, status=pending) 을 INSERT 한다 (REQ-CLUBA-004)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'jr-1',
            club_id: 'c1',
            requester_id: 'u1',
            message: '같이 읽어요',
            status: 'pending',
          },
          error: null,
        }),
      }),
    });

    const result = await createJoinRequest({
      clubId: 'c1',
      requesterId: 'u1',
      message: '같이 읽어요',
    });

    expect(insertMock).toHaveBeenCalledWith({
      club_id: 'c1',
      requester_id: 'u1',
      message: '같이 읽어요',
      // status 는 DB 기본값(pending)이므로 payload 에 미포함
    });
    expect(result.status).toBe('pending');
  });

  it('message 가 null 이면 payload 에 null 로 전달한다 (선택 필드)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 'jr-2', status: 'pending', message: null },
          error: null,
        }),
      }),
    });

    await createJoinRequest({ clubId: 'c1', requesterId: 'u1', message: null });

    expect(insertMock).toHaveBeenCalledWith({
      club_id: 'c1',
      requester_id: 'u1',
      message: null,
    });
  });

  it('UNIQUE 위반(23505) 시 VALIDATION AppError 를 throw 한다 (REQ-CLUBA-005)', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value' },
        }),
      }),
    });

    await expect(
      createJoinRequest({ clubId: 'c1', requesterId: 'u1', message: null }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
  });

  it('E4 message 500자 초과 시 INSERT 전 VALIDATION 에러 throw (이중 방어)', async () => {
    await expect(
      createJoinRequest({
        clubId: 'c1',
        requesterId: 'u1',
        message: 'x'.repeat(501),
      }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });

    // INSERT 가 호출되지 않아야 함 (선검증)
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
      }),
    });

    await expect(
      createJoinRequest({ clubId: 'c1', requesterId: 'u1', message: null }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
  });

  it('쿼리 throw(네트워크) 시 normalizeError 를 거쳐 AppError throw', async () => {
    insertMock.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    });

    await expect(
      createJoinRequest({ clubId: 'c1', requesterId: 'u1', message: null }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'NETWORK' });
  });
});

describe('SPEC-CLUB-001: fetchMyJoinRequests', () => {
  it('requester_id 로 본인이 보낸 요청을 조회한다', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: [{ id: 'jr-1', club_id: 'c1', status: 'pending' }],
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await fetchMyJoinRequests('u1');

    expect(fromMock2).toHaveBeenCalledWith('join_requests');
    expect(eqMock).toHaveBeenCalledWith('requester_id', 'u1');
    expect(result).toHaveLength(1);
  });
});

describe('SPEC-CLUB-001: fetchIncomingJoinRequests', () => {
  it('host_id 로 수신 요청을 조회한다 (pending 조인)', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: [{ id: 'jr-1', club_id: 'c1', status: 'pending' }],
      error: null,
    });
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await fetchIncomingJoinRequests('host-1');

    expect(fromMock2).toHaveBeenCalledWith('join_requests');
    expect(eqMock).toHaveBeenCalledWith('club_id.host_id', 'host-1');
    expect(result).toHaveLength(1);
  });
});

describe('SPEC-CLUB-001 T-006: respondToJoinRequest', () => {
  it('host 가 status 를 accepted 로 전환한다 (REQ-CLUBA-009)', async () => {
    const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await respondToJoinRequest({ requestId: 'jr-1', status: 'accepted' });

    // status + responded_at(now) 만 UPDATE — DB 트리거가 club_members INSERT 수행
    expect(updateMock).toHaveBeenCalledWith({
      status: 'accepted',
      responded_at: expect.any(String),
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'jr-1');
  });

  it('declined 전환 시에도 responded_at 갱신 (멤버십 미추가는 트리거 조건)', async () => {
    const eqMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await respondToJoinRequest({ requestId: 'jr-1', status: 'declined' });

    expect(updateMock).toHaveBeenCalledWith({
      status: 'declined',
      responded_at: expect.any(String),
    });
  });

  it('terminal 트리거 예외(400 + message) 시 VALIDATION 으로 분류한다 (REQ-CLUBA-008)', async () => {
    // guard_join_request_status_trigger 의 RAISE EXCEPTION 은 PostgREST 를 통해
    // HTTP 400 으로 전달된다 (classifyError: status 400 → VALIDATION).
    const eqMock = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '21000',
        message: 'new row for join_requests violates check constraint',
        status: 400,
      },
    });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(
      respondToJoinRequest({ requestId: 'jr-1', status: 'accepted' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
  });

  it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다 (REQ-CLUBA-007)', async () => {
    const eqMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(
      respondToJoinRequest({ requestId: 'jr-1', status: 'accepted' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
  });

  it('쿼리 throw(네트워크) 시 normalizeError 를 거쳐 AppError throw', async () => {
    const eqMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(
      respondToJoinRequest({ requestId: 'jr-1', status: 'accepted' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'NETWORK' });
  });

  it('fetchMyJoinRequests 쿼리 throw 시 NETWORK 분류', async () => {
    const orderMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const eqMock = jest.fn().mockReturnValue({ order: orderMock });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eqMock });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(fetchMyJoinRequests('u1')).rejects.toMatchObject({
      name: 'AppError',
      category: 'NETWORK',
    });
  });
});

describe('SPEC-CLUB-001 T-007: confirmMembership', () => {
  it('club_id 로 자신의 멤버십 행을 재조회한다 (REQ-CLUBA-011)', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: { club_id: 'c1', user_id: 'u1', role: 'member' },
      error: null,
    });
    const eq2 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await confirmMembership({ clubId: 'c1', userId: 'u1' });

    expect(fromMock2).toHaveBeenCalledWith('club_members');
    expect(eq1).toHaveBeenCalledWith('club_id', 'c1');
    expect(eq2).toHaveBeenCalledWith('user_id', 'u1');
    expect(result?.role).toBe('member');
  });

  it('멤버가 아니면 null 반환 (에러 아님)', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    const result = await confirmMembership({ clubId: 'c1', userId: 'u1' });
    expect(result).toBeNull();
  });

  it('조회 에러 시 AppError throw', async () => {
    const maybeSingleMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'denied' },
    });
    const eq2 = jest.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
    const selectMock2 = jest.fn().mockReturnValue({ eq: eq1 });
    const fromMock2 = jest.fn().mockReturnValue({ select: selectMock2 });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock2 });

    await expect(
      confirmMembership({ clubId: 'c1', userId: 'u1' }),
    ).rejects.toMatchObject({ name: 'AppError' });
  });
});
