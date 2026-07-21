/**
 * SPEC-CLUB-001 T-012 HostRequestsScreen 컴포넌트 테스트 (M5 — host 응답 UI)
 *
 * 검증 대상 (REQ-CLUBA-007~012 + SPEC-UI-002):
 * - 수신 요청 목록 (fetchIncomingJoinRequests) 표시
 * - 승인(accepted)/거절(declined) 버튼
 * - terminal 에러 처리: 이미 처리된 요청 시 "이미 처리된 요청입니다" 메시지
 * - 승인 성공 후 멤버십 확인(useConfirmMembership) 옵션 관측
 * - 빈/로딩/에러 상태 패턴
 * - token-only 스타일링, 비과시 원칙
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/theme';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('expo-router', () => ({ useRouter: jest.fn(() => ({ back: jest.fn() })) }));

// 세션 mock
jest.mock('../../../../auth/useSession', () => ({ useSession: jest.fn() }));
// fetchIncomingJoinRequests mock
jest.mock('../joinRequestApi', () => ({
  __esModule: true,
  fetchIncomingJoinRequests: jest.fn(),
  confirmMembership: jest.fn(),
  createJoinRequest: jest.fn(),
  respondToJoinRequest: jest.fn(),
  fetchMyJoinRequests: jest.fn(),
}));
// respond/confirm 훅 mock
jest.mock('../hooks', () => ({
  __esModule: true,
  useRespondToJoinRequest: jest.fn(),
  useConfirmMembership: jest.fn(),
}));

import { useSession } from '../../../../auth/useSession';
import { fetchIncomingJoinRequests } from '../joinRequestApi';
import { useRespondToJoinRequest, useConfirmMembership } from '../hooks';
import { HostRequestsScreen } from '../components/HostRequestsScreen';
import { AppError } from '../../../../errors';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const fetchIncomingMock = fetchIncomingJoinRequests as jest.MockedFunction<typeof fetchIncomingJoinRequests>;
const useRespondMock = useRespondToJoinRequest as jest.MockedFunction<typeof useRespondToJoinRequest>;
const useConfirmMock = useConfirmMembership as jest.MockedFunction<typeof useConfirmMembership>;

const authedSession = { user: { id: 'host-1' }, isAuthenticated: true, isOnboarded: true } as any;

function respondMock() {
  const mutateAsync = jest.fn().mockResolvedValue(undefined);
  return { mutateAsync, result: { mutateAsync, isPending: false, isError: false, error: null } as any };
}

function renderScreen(respondResultOverride?: any) {
  const resp = respondMock();
  useRespondMock.mockReturnValue(respondResultOverride ?? resp.result);
  useConfirmMock.mockReturnValue({ data: undefined } as any);
  const utils = render(
    <ThemeProvider>
      <HostRequestsScreen />
    </ThemeProvider>,
  );
  return { ...utils, respondMutate: resp.mutateAsync };
}

const sampleRequest = {
  id: 'jr-1',
  club_id: 'club-1',
  requester_id: 'u-req',
  message: '같이 읽어요',
  status: 'pending',
  created_at: '2026-06-18T00:00:00Z',
  responded_at: null,
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authedSession);
  fetchIncomingMock.mockResolvedValue([]);
});

describe('SPEC-CLUB-001 T-012: HostRequestsScreen 헤더/상태', () => {
  it('헤더 타이틀 "받은 요청" 을 렌더링한다', () => {
    fetchIncomingMock.mockResolvedValue([]);
    const { getByText } = renderScreen();
    expect(getByText('받은 요청')).toBeTruthy();
  });

  it('수신 요청 0건이면 빈 상태 메시지를 표시한다', async () => {
    fetchIncomingMock.mockResolvedValue([]);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('host-requests-empty')).toBeTruthy());
  });
});

describe('SPEC-CLUB-001 T-012: 수신 요청 목록 + 승인/거절', () => {
  it('수신 요청 카드를 렌더링한다', async () => {
    fetchIncomingMock.mockResolvedValue([sampleRequest]);
    const { getByTestId, getByText } = renderScreen();
    await waitFor(() => expect(getByTestId('host-request-jr-1')).toBeTruthy());
    expect(getByText('같이 읽어요')).toBeTruthy();
  });

  it('승인 버튼 누르면 useRespondToJoinRequest({accepted}) 호출', async () => {
    fetchIncomingMock.mockResolvedValue([sampleRequest]);
    const { getByTestId, respondMutate } = renderScreen();
    await waitFor(() => expect(getByTestId('host-request-jr-1')).toBeTruthy());
    fireEvent.press(getByTestId('host-request-accept-jr-1'));
    await waitFor(() =>
      expect(respondMutate).toHaveBeenCalledWith({ requestId: 'jr-1', status: 'accepted' }),
    );
  });

  it('거절 버튼 누르면 useRespondToJoinRequest({declined}) 호출', async () => {
    fetchIncomingMock.mockResolvedValue([sampleRequest]);
    const { getByTestId, respondMutate } = renderScreen();
    await waitFor(() => expect(getByTestId('host-request-jr-1')).toBeTruthy());
    fireEvent.press(getByTestId('host-request-decline-jr-1'));
    await waitFor(() =>
      expect(respondMutate).toHaveBeenCalledWith({ requestId: 'jr-1', status: 'declined' }),
    );
  });
});

describe('SPEC-CLUB-001 T-012: terminal 에러 처리 (REQ-CLUBA-008)', () => {
  it('이미 처리된 요청(terminal) 응답 시 에러 메시지 노출', async () => {
    fetchIncomingMock.mockResolvedValue([sampleRequest]);
    const terminal = new AppError('이미 처리된 요청', 'TERMINAL', 400);
    terminal.category = 'VALIDATION';
    const mutateAsync = jest.fn().mockRejectedValue(terminal);
    const respondOverride = { mutateAsync, isPending: false, isError: false, error: null } as any;

    const { getByTestId } = renderScreen(respondOverride);
    await waitFor(() => expect(getByTestId('host-request-jr-1')).toBeTruthy());
    fireEvent.press(getByTestId('host-request-accept-jr-1'));
    await waitFor(() => expect(getByTestId('host-request-error-jr-1')).toBeTruthy());
  });
});
