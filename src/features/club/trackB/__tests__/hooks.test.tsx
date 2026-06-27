/**
 * SPEC-CLUB-002 Track B React Query 훅 단위 테스트 (M4 — UI 계층)
 *
 * 검증 대상:
 * - useHostClubs: clubs SELECT host_id 필터, 빈 userId 시 비활성화
 * - useCreateClub: createClub → verifyHostMembership → updateProgress 2단계 시퀀스,
 *   진도 계획 미전달 시 updateProgress 생략, 성공 시 host/detail invalidate
 * - useUpdateProgress / useCloseClub / useReactivateClub / useLeaveClub: invalidate 대상
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 네이티브 모듈 mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// supabase client mock (useHostClubs 내부 쿼리용)
jest.mock('../../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

// 데이터 계층 전체 mock
jest.mock('../clubApi', () => ({
  __esModule: true,
  createClub: jest.fn(),
  verifyHostMembership: jest.fn(),
  getClubDetail: jest.fn(),
}));
jest.mock('../memberApi', () => ({
  __esModule: true,
  getClubMembers: jest.fn(),
  closeClub: jest.fn(),
  reactivateClub: jest.fn(),
  leaveClub: jest.fn(),
}));
jest.mock('../progressApi', () => ({
  __esModule: true,
  updateProgress: jest.fn(),
}));

import {
  useCreateClub,
  useHostClubs,
  useClubDetail,
  useClubMembers,
  useUpdateProgress,
  useCloseClub,
  useReactivateClub,
  useLeaveClub,
} from '../hooks';
import { getSupabaseClient } from '../../../../lib/supabase/client';
import {
  createClub,
  verifyHostMembership,
  getClubDetail,
} from '../clubApi';
import {
  getClubMembers,
  closeClub,
  reactivateClub,
  leaveClub,
} from '../memberApi';
import { updateProgress } from '../progressApi';

const supabaseMock = {
  from: jest.fn(),
  rpc: jest.fn(),
};
(getSupabaseClient as jest.Mock).mockReturnValue(supabaseMock);

const createClubMock = createClub as jest.MockedFunction<typeof createClub>;
const verifyMock = verifyHostMembership as jest.MockedFunction<
  typeof verifyHostMembership
>;
const getDetailMock = getClubDetail as jest.MockedFunction<
  typeof getClubDetail
>;
const getMembersMock = getClubMembers as jest.MockedFunction<
  typeof getClubMembers
>;
const updateProgressMock = updateProgress as jest.MockedFunction<
  typeof updateProgress
>;
const closeMock = closeClub as jest.MockedFunction<typeof closeClub>;
const reactivateMock = reactivateClub as jest.MockedFunction<
  typeof reactivateClub
>;
const leaveMock = leaveClub as jest.MockedFunction<typeof leaveClub>;

function buildChain(rows: unknown[], error: unknown = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: rows, error }),
  };
  return chain;
}

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { Wrapper, qc };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-CLUB-002 useHostClubs', () => {
  it('host_id 필터로 clubs 목록 + 멤버 수 집계를 단일 라운드트립으로 조회한다', async () => {
    // SPEC-UI-002 PR-3: PostgREST embedded aggregate club_members(count) 결과를
    // member_count 로 평탄화한다. select 문자열에 count 집계 포함.
    const chain = buildChain([
      { id: 'c1', club_members: [{ count: 3 }] },
      { id: 'c2', club_members: [{ count: 0 }] },
    ]);
    supabaseMock.from.mockReturnValue(chain);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), { wrapper: Wrapper });

    await waitFor(() =>
      expect(result.current.data).toEqual([
        { id: 'c1', member_count: 3 },
        { id: 'c2', member_count: 0 },
      ]),
    );
    expect(supabaseMock.from).toHaveBeenCalledWith('clubs');
    expect(chain.select).toHaveBeenCalledWith('*, club_members(count)');
    expect(chain.eq).toHaveBeenCalledWith('host_id', 'u1');
  });

  it('club_members 집계 누락 시 member_count 는 0 으로 폴백한다', async () => {
    const chain = buildChain([{ id: 'c1', club_members: null }]);
    supabaseMock.from.mockReturnValue(chain);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), { wrapper: Wrapper });

    await waitFor(() =>
      expect(result.current.data).toEqual([{ id: 'c1', member_count: 0 }]),
    );
  });

  it('빈 userId 면 비활성화된다', () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs(''), { wrapper: Wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('SPEC-CLUB-002 useClubDetail / useClubMembers', () => {
  it('getClubDetail 을 호출한다', async () => {
    getDetailMock.mockResolvedValue({ id: 'c1' } as any);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useClubDetail('c1'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.id).toBe('c1'));
  });

  it('getClubMembers 를 호출한다', async () => {
    getMembersMock.mockResolvedValue([{ id: 'm1' } as any]);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useClubMembers('c1'), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.data?.length).toBe(1));
  });
});

describe('SPEC-CLUB-002 useCreateClub (2단계 시퀀스)', () => {
  it('createClub → verifyHostMembership(true) → updateProgress 생략(진도 미전달)', async () => {
    createClubMock.mockResolvedValue({ id: 'c1', status: 'active' } as any);
    verifyMock.mockResolvedValue(true);

    const { Wrapper, qc } = makeWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateClub(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        bookId: 'b1',
        hostId: 'u1',
        name: '모임',
      });
    });

    expect(createClubMock).toHaveBeenCalled();
    expect(verifyMock).toHaveBeenCalledWith({ clubId: 'c1', hostId: 'u1' });
    expect(updateProgressMock).not.toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('진도 계획 전달 시 updateProgress 를 호출한다', async () => {
    createClubMock.mockResolvedValue({ id: 'c2', status: 'active' } as any);
    verifyMock.mockResolvedValue(true);
    updateProgressMock.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateClub(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        bookId: 'b1',
        hostId: 'u1',
        name: '모임',
        dailyPages: 20,
        triggerPage: 100,
      });
    });

    expect(updateProgressMock).toHaveBeenCalledWith(
      'c2',
      { dailyPages: 20, triggerPage: 100 },
      { status: 'active' },
    );
  });

  it('host 멤버십 확인 실패 시 에러를 throw 한다', async () => {
    createClubMock.mockResolvedValue({ id: 'c3', status: 'active' } as any);
    verifyMock.mockResolvedValue(false);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateClub(), { wrapper: Wrapper });

    await act(async () => {
      result.current.mutate({
        bookId: 'b1',
        hostId: 'u1',
        name: '모임',
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(updateProgressMock).not.toHaveBeenCalled();
  });
});

describe('SPEC-CLUB-002 상태 전환 / 탈퇴 훅', () => {
  it('useUpdateProgress 가 updateProgress 를 호출한다', async () => {
    updateProgressMock.mockResolvedValue(undefined);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateProgress(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        clubId: 'c1',
        dailyPages: 30,
        status: 'active',
      });
    });
    expect(updateProgressMock).toHaveBeenCalled();
  });

  it('useCloseClub / useReactivateClub / useLeaveClub 이 각 API 호출', async () => {
    closeMock.mockResolvedValue(undefined);
    reactivateMock.mockResolvedValue(undefined);
    leaveMock.mockResolvedValue(undefined);

    const { Wrapper } = makeWrapper();
    const closeR = renderHook(() => useCloseClub(), { wrapper: Wrapper });
    await act(async () => {
      await closeR.result.current.mutateAsync('c1');
    });
    expect(closeMock).toHaveBeenCalledWith('c1');

    const reactR = renderHook(() => useReactivateClub(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await reactR.result.current.mutateAsync('c1');
    });
    expect(reactivateMock).toHaveBeenCalledWith('c1');

    const leaveR = renderHook(() => useLeaveClub(), { wrapper: Wrapper });
    await act(async () => {
      await leaveR.result.current.mutateAsync({ clubId: 'c1', userId: 'u1' });
    });
    expect(leaveMock).toHaveBeenCalledWith({ clubId: 'c1', userId: 'u1' });
  });
});

// ============================================================================
// SPEC-CLUB-003 useHostClubs 진도 병합 (REQ-CLUBC-007/008)
// ============================================================================
// get_host_clubs_progress RPC 결과를 clubs SELECT 와 Promise.all 로 병렬 실행 후
// club_id 기준으로 클라이언트 병합. RPC 실패 시 degradation (진도 필드 0/0/null).
describe('SPEC-CLUB-003 useHostClubs 진도 병합', () => {
  it('RPC 성공 시 median_page/member_count_with_progress/progress_total_pages 를 club_id 기준으로 병합한다', async () => {
    // clubs SELECT: c1, c2
    const chain = buildChain([
      { id: 'c1', club_members: [{ count: 4 }] },
      { id: 'c2', club_members: [{ count: 2 }] },
    ]);
    supabaseMock.from.mockReturnValue(chain);
    // RPC: c1 진도만 존재
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          club_id: 'c1',
          median_page: 100,
          member_count_with_progress: 3,
          total_pages: 300,
        },
      ],
      error: null,
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.data).toEqual([
        {
          id: 'c1',
          member_count: 4,
          median_page: 100,
          member_count_with_progress: 3,
          progress_total_pages: 300,
        },
        {
          id: 'c2',
          member_count: 2,
          median_page: 0,
          member_count_with_progress: 0,
          progress_total_pages: null,
        },
      ]),
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'get_host_clubs_progress',
      { p_host_id: 'u1' },
    );
  });

  it('RPC 에러 시 전체 쿼리를 실패시키지 않고 진도 필드를 0/0/null 로 degradation 한다 (REQ-CLUBC-008)', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const chain = buildChain([{ id: 'c1', club_members: [{ count: 5 }] }]);
    supabaseMock.from.mockReturnValue(chain);
    supabaseMock.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC 500', code: 'PGRST' },
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.data).toEqual([
        {
          id: 'c1',
          member_count: 5,
          median_page: 0,
          member_count_with_progress: 0,
          progress_total_pages: null,
        },
      ]),
    );
    expect(result.current.isLoading).toBe(false);
    // 콘솔 경고 로깅 확인 (REQ-CLUBC-008)
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('RPC 빈 결과 시 진도 필드 0/0/null (진도 입력 멤버 없음)', async () => {
    const chain = buildChain([{ id: 'c1', club_members: [{ count: 3 }] }]);
    supabaseMock.from.mockReturnValue(chain);
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), {
      wrapper: Wrapper,
    });

    await waitFor(() =>
      expect(result.current.data).toEqual([
        {
          id: 'c1',
          member_count: 3,
          median_page: 0,
          member_count_with_progress: 0,
          progress_total_pages: null,
        },
      ]),
    );
  });

  it('clubs SELECT 에러 시 여전히 쿼리를 실패시킨다 (진도 병합이 기본 동작을 변경하지 않음)', async () => {
    const chain = buildChain([], { message: 'clubs select failed' });
    supabaseMock.from.mockReturnValue(chain);
    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useHostClubs('u1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
