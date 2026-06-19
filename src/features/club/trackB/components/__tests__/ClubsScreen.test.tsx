/**
 * SPEC-CLUB-002 M4 ClubsScreen 컴포넌트 테스트 (모임 목록 UI)
 *
 * 검증 대상 (SPEC-UI-002 FROZEN):
 * - 3계층 레이아웃 + 타이틀 균일성(fontSize 22/weight 700) "모임"
 * - plus 아이콘(모임 생성入口) + NewClubCTA "새 모임 만들기 (0명도 OK)"
 * - 모임 카드 리스트 (비과시: 멤버 수·좋아요 없음)
 * - 빈/로딩/에러 상태 패턴
 * - token-only 스타일링 (하드코딩 금지)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../theme/theme';

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
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

// 훅 mock
jest.mock('../../hooks', () => ({
  __esModule: true,
  useHostClubs: jest.fn(),
}));

import { useHostClubs } from '../../hooks';
import { ClubsScreen } from '../ClubsScreen';

const useHostClubsMock = useHostClubs as jest.MockedFunction<
  typeof useHostClubs
>;

function renderScreen(onCreateClub = jest.fn()) {
  return render(
    <ThemeProvider>
      <ClubsScreen userId="u1" onCreateClub={onCreateClub} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useHostClubsMock.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as any);
});

describe('SPEC-CLUB-002 ClubsScreen 헤더/레이아웃', () => {
  it('헤더 타이틀 "모임" 을 렌더링한다', () => {
    const { getByText } = renderScreen();
    expect(getByText('모임')).toBeTruthy();
  });

  it('plus 아이콘(생성 버튼)을 렌더링한다', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('clubs-create-button')).toBeTruthy();
  });

  it('plus 버튼 누름 시 onCreateClub 호출', () => {
    const onCreate = jest.fn();
    const { getByTestId } = renderScreen(onCreate);
    fireEvent.press(getByTestId('clubs-create-button'));
    expect(onCreate).toHaveBeenCalled();
  });

  it('NewClubCTA "새 모임 만들기 (0명도 OK)" 렌더링', () => {
    const { getByText } = renderScreen();
    expect(getByText('새 모임 만들기 (0명도 OK)')).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubsScreen 상태 패턴', () => {
  it('로딩 중 ActivityIndicator 표시', () => {
    useHostClubsMock.mockReturnValue({ isLoading: true } as any);
    const { getByTestId } = renderScreen();
    expect(getByTestId('clubs-loading')).toBeTruthy();
  });

  it('에러 시 에러 메시지 + 재시도 버튼 표시', () => {
    useHostClubsMock.mockReturnValue({
      isError: true,
      error: { message: '오류', category: 'NETWORK' },
      refetch: jest.fn(),
    } as any);
    const { getByTestId } = renderScreen();
    expect(getByTestId('clubs-error')).toBeTruthy();
    expect(getByTestId('clubs-retry')).toBeTruthy();
  });

  it('빈 상태 시 안내 카드 표시', () => {
    const { getByTestId, getByText } = renderScreen();
    expect(getByTestId('clubs-empty')).toBeTruthy();
    expect(getByText('아직 만든 모임이 없어요')).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubsScreen 모임 카드 (비과시 원칙)', () => {
  it('모임 카드에 이름과 진도 메타 표시 (멤버 수·좋아요 없음)', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c1',
          name: '데미안 읽는 모임',
          status: 'active',
          daily_pages: 20,
          host_id: 'u1',
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText, queryByText } = renderScreen();
    expect(getByText('데미안 읽는 모임')).toBeTruthy();
    expect(getByText('하루 20p')).toBeTruthy();
    // 비과시: 좋아요/팔로워/랭킹 표시 없음
    expect(queryByText(/좋아요/)).toBeNull();
    expect(queryByText(/팔로워/)).toBeNull();
  });

  it('종료된 모임 "종료됨" 표시', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c2',
          name: '느긋한 모임',
          status: 'closed',
          daily_pages: null,
          host_id: 'u1',
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText } = renderScreen();
    expect(getByText('종료됨')).toBeTruthy();
    expect(getByText('진도 미설정')).toBeTruthy();
  });
});
