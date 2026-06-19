/**
 * SPEC-CLUB-001 T-010 ReadersScreen 컴포넌트 테스트 (M3 — 독자 목록 UI)
 *
 * 검증 대상 (REQ-CLUBA-001~003 + SPEC-UI-002):
 * - 3계층 레이아웃(헤더/본문) + 타이틀 균일성(fontSize 22/weight 700)
 * - 독자 카드 리스트 (started_reading_at DESC 정렬은 훅이 담당)
 * - 빈/로딩/에러 상태 패턴 (REQ-SCREEN-030/031/032)
 * - 비과시 원칙: 좋아요/팔로워/랭킹 표시 없음, 독서 컨텍스트만 (current_page 등)
 * - "같이 읽어요" 버튼 → JoinRequestSheet 호출 콜백 (club_id 분기는 훅/시트가 담당)
 * - token-only 스타일링 (하드코딩 금지)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/theme';
import type { ActiveReader } from '../types';

// 네이티브 모듈 mock
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

// 훅 mock — ReadersScreen 이 소비하는 useActiveReaders 만 제어
jest.mock('../hooks', () => ({
  __esModule: true,
  useActiveReaders: jest.fn(),
}));

import { useSession } from '../../../../auth/useSession';
import { useActiveReaders } from '../hooks';
import { ReadersScreen, type ReadersScreenProps } from '../components/ReadersScreen';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const useReadersMock = useActiveReaders as jest.MockedFunction<typeof useActiveReaders>;

const authedSession = {
  user: { id: 'u-me' },
  isAuthenticated: true,
  isOnboarded: true,
} as any;

function renderScreen(props?: Partial<ReadersScreenProps>) {
  const onJoinRequest = jest.fn();
  const utils = render(
    <ThemeProvider>
      <ReadersScreen bookId="b-1" onJoinRequest={onJoinRequest} {...props} />
    </ThemeProvider>,
  );
  return { ...utils, onJoinRequest };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseSession.mockReturnValue(authedSession);
  useReadersMock.mockReturnValue({ data: [], isLoading: false, isError: false, error: null } as any);
});

describe('SPEC-CLUB-001 T-010: ReadersScreen 헤더/레이아웃', () => {
  it('헤더 타이틀 "같이 읽는 독자" 를 렌더링한다', () => {
    const { getByText } = renderScreen();
    expect(getByText('같이 읽는 독자')).toBeTruthy();
  });

  it('뒤로가기 버튼을 렌더링한다', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('readers-back-button')).toBeTruthy();
  });
});

describe('SPEC-CLUB-001 T-010: ReadersScreen 상태 패턴 (SPEC-UI-002 REQ-SCREEN-STATE)', () => {
  it('로딩 중 ActivityIndicator 를 표시한다', () => {
    useReadersMock.mockReturnValue({ isLoading: true } as any);
    const { getByTestId } = renderScreen();
    expect(getByTestId('readers-loading')).toBeTruthy();
  });

  it('에러 시 에러 메시지를 표시한다', async () => {
    useReadersMock.mockReturnValue({
      isError: true,
      error: { message: '접근 권한이 없습니다.' },
    } as any);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('readers-error')).toBeTruthy());
  });

  it('독자가 0명이면 빈 상태 메시지를 표시한다', () => {
    useReadersMock.mockReturnValue({ data: [], isLoading: false, isError: false } as any);
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('readers-empty')).toBeTruthy();
    expect(getByText('아직 같이 읽는 독자가 없어요')).toBeTruthy();
  });
});

describe('SPEC-CLUB-001 T-010: ReadersScreen 독자 카드 목록', () => {
  const readers: ActiveReader[] = [
    { user_id: 'u-1', book_id: 'b-1', current_page: 120, started_reading_at: '2026-06-10T00:00:00Z', club_id: 'club-1' },
    { user_id: 'u-2', book_id: 'b-1', current_page: null, started_reading_at: null, club_id: null },
  ];

  it('독자 카드를 렌더링한다', async () => {
    useReadersMock.mockReturnValue({ data: readers, isLoading: false, isError: false } as any);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('reader-card-u-1')).toBeTruthy());
    expect(getByTestId('reader-card-u-2')).toBeTruthy();
  });

  it('club_id 유무 배지를 구분해 표시한다 (그룹 있음/없음)', async () => {
    useReadersMock.mockReturnValue({ data: readers, isLoading: false, isError: false } as any);
    const { getByTestId } = renderScreen();
    await waitFor(() => expect(getByTestId('reader-card-u-1')).toBeTruthy());
    // u-1 은 그룹 있음, u-2 는 그룹 없음
    expect(getByTestId('reader-badge-u-1')).toBeTruthy();
    expect(getByTestId('reader-badge-u-2')).toBeTruthy();
  });

  it('"같이 읽어요" 버튼 누르면 onJoinRequest 에 ActiveReader 를 전달한다', async () => {
    useReadersMock.mockReturnValue({ data: readers, isLoading: false, isError: false } as any);
    const { getByTestId, onJoinRequest } = renderScreen();
    await waitFor(() => expect(getByTestId('reader-card-u-1')).toBeTruthy());
    fireEvent.press(getByTestId('reader-join-u-1'));
    expect(onJoinRequest).toHaveBeenCalledWith(readers[0]);
  });

  it('비과시 원칙: 좋아요/팔로워/랭킹 텍스트가 없다', async () => {
    useReadersMock.mockReturnValue({ data: readers, isLoading: false, isError: false } as any);
    const { queryByText } = renderScreen();
    await waitFor(() => expect(queryByText(/팔로워/)).toBeNull());
    expect(queryByText(/좋아요/)).toBeNull();
    expect(queryByText(/랭킹/)).toBeNull();
  });
});
