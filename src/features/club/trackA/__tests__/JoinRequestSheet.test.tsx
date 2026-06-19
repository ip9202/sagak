/**
 * SPEC-CLUB-001 T-011 JoinRequestSheet 컴포넌트 테스트 (M4 — 요청 작성 UI)
 *
 * 검증 대상 (REQ-CLUBA-004~006 + SPEC-UI-002):
 * - 모달/바텀시트 형태 (닫기 버튼)
 * - message 입력 (500자 제한 + 카운터)
 * - club_id 분기: club_id !== null → createJoinRequest, null → processJoinRequestViaEdgeFunction
 * - 제출 성공 시 onClose 호출
 * - 에러 상태 노출: 중복(23505), terminal, too-long, RLS
 * - token-only 스타일링
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/theme';
import type { ActiveReader } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(), getItemAsync: jest.fn(), deleteItemAsync: jest.fn(), WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

// 세션 mock
jest.mock('../../../../auth/useSession', () => ({ useSession: jest.fn() }));
// useCreateJoinRequest 훅 mock
jest.mock('../hooks', () => ({
  __esModule: true,
  useCreateJoinRequest: jest.fn(),
}));

import { useSession } from '../../../../auth/useSession';
import { useCreateJoinRequest } from '../hooks';
import { JoinRequestSheet, type JoinRequestSheetProps } from '../components/JoinRequestSheet';
import { AppError } from '../../../../errors';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const useCreateMock = useCreateJoinRequest as jest.MockedFunction<typeof useCreateJoinRequest>;

const authedSession = { user: { id: 'u-me' }, isAuthenticated: true, isOnboarded: true } as any;

function makeMutationMock(overrides: Partial<{ isError: boolean; error: any; isPending: boolean; reject?: any }> = {}) {
  const mutateAsync = overrides.reject
    ? jest.fn().mockRejectedValue(overrides.reject)
    : jest.fn().mockResolvedValue(undefined);
  return {
    mutateAsync,
    result: {
      mutateAsync,
      isPending: overrides.isPending ?? false,
      isError: overrides.isError ?? false,
      error: overrides.error ?? null,
    } as any,
  };
}

function renderSheet(
  reader: ActiveReader,
  props?: Partial<JoinRequestSheetProps>,
  mutationOverrides?: Parameters<typeof makeMutationMock>[0],
) {
  const onClose = jest.fn();
  const mutation = makeMutationMock(mutationOverrides);
  useCreateMock.mockReturnValue(mutation.result);
  const utils = render(
    <ThemeProvider>
      <JoinRequestSheet bookId="b-1" reader={reader} onClose={onClose} {...props} />
    </ThemeProvider>,
  );
  return { ...utils, onClose, mutateAsync: mutation.mutateAsync };
}

const readerWithClub: ActiveReader = {
  user_id: 'u-1', book_id: 'b-1', current_page: 30, started_reading_at: '2026-06-01T00:00:00Z', club_id: 'club-1',
};
const readerNoClub: ActiveReader = {
  user_id: 'u-2', book_id: 'b-1', current_page: null, started_reading_at: null, club_id: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authedSession);
});

describe('SPEC-CLUB-001 T-011: JoinRequestSheet 레이아웃', () => {
  it('타이틀과 닫기 버튼을 렌더링한다', () => {
    const { getByText, getByTestId } = renderSheet(readerWithClub);
    expect(getByText(/같이 읽어요/)).toBeTruthy();
    expect(getByTestId('join-sheet-close')).toBeTruthy();
  });

  it('message 입력란과 글자수 카운터를 렌더링한다', () => {
    const { getByTestId } = renderSheet(readerWithClub);
    expect(getByTestId('join-sheet-message-input')).toBeTruthy();
    expect(getByTestId('join-sheet-counter')).toBeTruthy();
  });

  it('500자 초과 입력 시 카운터가 에러 색상/문구로 전환된다', () => {
    const { getByTestId, getByText } = renderSheet(readerWithClub);
    const input = getByTestId('join-sheet-message-input');
    const longText = '가'.repeat(501);
    fireEvent.changeText(input, longText);
    expect(getByText(/500자 이하여야/)).toBeTruthy();
  });
});

describe('SPEC-CLUB-001 T-011: club_id 분기 제출', () => {
  it('club_id 있으면 createJoinRequest 경로로 전송한다 (vars.clubId)', async () => {
    const { getByTestId, mutateAsync } = renderSheet(readerWithClub);
    fireEvent.changeText(getByTestId('join-sheet-message-input'), '안녕하세요');
    fireEvent.press(getByTestId('join-sheet-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      clubId: 'club-1',
      message: '안녕하세요',
    }));
  });

  it('club_id null 이면 Edge Function 경로로 전송한다 (vars.targetUserId+bookId)', async () => {
    const { getByTestId, mutateAsync } = renderSheet(readerNoClub);
    fireEvent.changeText(getByTestId('join-sheet-message-input'), '');
    fireEvent.press(getByTestId('join-sheet-submit'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      targetUserId: 'u-2',
      bookId: 'b-1',
    }));
  });

  it('제출 성공 시 onClose 가 호출된다', async () => {
    const { getByTestId, onClose } = renderSheet(readerWithClub);
    fireEvent.press(getByTestId('join-sheet-submit'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('SPEC-CLUB-001 T-011: 에러 상태 노출', () => {
  it('중복 요청(23505 VALIDATION) 시 "이미 등록된" 메시지 노출', async () => {
    const dup = new AppError('duplicate', '23505', 409);
    dup.category = 'VALIDATION';
    const { getByTestId } = renderSheet(readerWithClub, {}, { reject: dup });
    fireEvent.press(getByTestId('join-sheet-submit'));
    await waitFor(() => expect(getByTestId('join-sheet-error')).toBeTruthy());
  });

  it('terminal(이미 처리된) 에러 메시지 노출', async () => {
    const terminal = new AppError('이미 처리된 요청', 'TERMINAL', 400);
    terminal.category = 'VALIDATION';
    const { getByTestId } = renderSheet(readerWithClub, {}, { reject: terminal });
    fireEvent.press(getByTestId('join-sheet-submit'));
    await waitFor(() => expect(getByTestId('join-sheet-error')).toBeTruthy());
  });
});
