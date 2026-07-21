/**
 * SPEC-CLUB-002 M4 ClubDetailScreen 컴포넌트 테스트 (모임 상세/관리)
 *
 * 검증 대상 (SPEC-UI-002 FROZEN):
 * - 헤더 타이틀 "모임" (fontSize 22/weight 700)
 * - 모임 정보(이름/설명/상태) 표시
 * - host 진도 동기화 UI (host 만, closed 아닐 때)
 * - host: close/reactivate 버튼 / 멤버: leave 버튼
 * - 빈/로딩/에러 상태
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../theme/theme';

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
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
}));

jest.mock('../../hooks', () => ({
  __esModule: true,
  useClubDetail: jest.fn(),
  useClubMembers: jest.fn(),
  useUpdateProgress: jest.fn(),
  useCloseClub: jest.fn(),
  useReactivateClub: jest.fn(),
  useLeaveClub: jest.fn(),
}));

import {
  useClubDetail,
  useClubMembers,
  useUpdateProgress,
  useCloseClub,
  useReactivateClub,
  useLeaveClub,
} from '../../hooks';
import { ClubDetailScreen } from '../ClubDetailScreen';

const detailMock = useClubDetail as jest.MockedFunction<typeof useClubDetail>;
const membersMock = useClubMembers as jest.MockedFunction<
  typeof useClubMembers
>;
const updateProgressMock = useUpdateProgress as jest.MockedFunction<
  typeof useUpdateProgress
>;
const closeMock = useCloseClub as jest.MockedFunction<typeof useCloseClub>;
const reactivateMock = useReactivateClub as jest.MockedFunction<
  typeof useReactivateClub
>;
const leaveMock = useLeaveClub as jest.MockedFunction<typeof useLeaveClub>;

function defaultMutations() {
  return {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as any;
}

function renderScreen(clubId = 'c1', userId = 'u-host') {
  return render(
    <ThemeProvider>
      <ClubDetailScreen clubId={clubId} userId={userId} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  detailMock.mockReturnValue({
    data: {
      id: 'c1',
      name: '함께 읽는 모임',
      description: '소개',
      status: 'active',
      daily_pages: 20,
      trigger_page: null,
      host_id: 'u-host',
    },
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  membersMock.mockReturnValue({
    data: [
      {
        id: 'm1',
        club_id: 'c1',
        user_id: 'u-host',
        role: 'host',
        joined_at: '2024-01-01',
      },
    ],
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  updateProgressMock.mockReturnValue(defaultMutations());
  closeMock.mockReturnValue(defaultMutations());
  reactivateMock.mockReturnValue(defaultMutations());
  leaveMock.mockReturnValue(defaultMutations());
});

describe('SPEC-CLUB-002 ClubDetailScreen 헤더/정보', () => {
  it('헤더 타이틀 "모임" 렌더링', () => {
    const { getByText } = renderScreen();
    expect(getByText('모임')).toBeTruthy();
  });

  it('모임 정보(이름/설명/상태) 표시', () => {
    const { getByText } = renderScreen();
    expect(getByText('함께 읽는 모임')).toBeTruthy();
    expect(getByText('소개')).toBeTruthy();
    expect(getByText('진행 중')).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubDetailScreen host 진도 동기화', () => {
  it('host 면 진도 저장 UI 노출', () => {
    const { getByTestId } = renderScreen('c1', 'u-host');
    expect(getByTestId('club-detail-save-progress')).toBeTruthy();
  });

  it('host 가 진도 저장 누르면 updateProgress.mutate 호출', () => {
    const mutate = jest.fn();
    updateProgressMock.mockReturnValue({ ...defaultMutations(), mutate });
    const { getByTestId, getByDisplayValue } = renderScreen('c1', 'u-host');
    // 초기값 daily_pages=20
    expect(getByDisplayValue('20')).toBeTruthy();
    fireEvent.changeText(getByTestId('club-detail-daily-pages'), '30');
    fireEvent.press(getByTestId('club-detail-save-progress'));
    expect(mutate).toHaveBeenCalled();
    expect(mutate.mock.calls[0][0].dailyPages).toBe(30);
  });

  it('멤버(host 아님)는 진도 UI 미노출', () => {
    const { queryByTestId } = renderScreen('c1', 'u-member');
    expect(queryByTestId('club-detail-save-progress')).toBeNull();
  });
});

describe('SPEC-CLUB-002 ClubDetailScreen 상태 전환 액션', () => {
  it('host(active) 면 종료 버튼 노출', () => {
    const { getByTestId } = renderScreen('c1', 'u-host');
    expect(getByTestId('club-detail-close')).toBeTruthy();
  });

  it('host(close) 면 재활성화 버튼 노출', () => {
    detailMock.mockReturnValue({
      data: {
        id: 'c1',
        name: '모임',
        status: 'closed',
        daily_pages: null,
        trigger_page: null,
        host_id: 'u-host',
      },
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId } = renderScreen('c1', 'u-host');
    expect(getByTestId('club-detail-reactivate')).toBeTruthy();
  });

  it('멤버는 나가기 버튼 노출', () => {
    const { getByTestId } = renderScreen('c1', 'u-member');
    expect(getByTestId('club-detail-leave')).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubDetailScreen 상태 패턴', () => {
  it('로딩 중 ActivityIndicator', () => {
    detailMock.mockReturnValue({ isLoading: true } as any);
    const { getByTestId } = renderScreen();
    expect(getByTestId('club-detail-loading')).toBeTruthy();
  });

  it('에러 시 에러 메시지', () => {
    detailMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: '조회 실패', category: 'NETWORK' },
    } as any);
    const { getByTestId } = renderScreen();
    expect(getByTestId('club-detail-error')).toBeTruthy();
  });
});
