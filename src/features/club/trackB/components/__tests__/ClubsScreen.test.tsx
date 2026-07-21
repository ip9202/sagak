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

  // SPEC-UI-002 PR-3: 헤더 search 아이콘 추가 (.pen ocxFV search 22 + K54AFO plus 24).
  it('헤더 search 아이콘(모임 검색 버튼)을 렌더링한다', () => {
    const { getByTestId } = renderScreen();
    expect(getByTestId('clubs-search-button')).toBeTruthy();
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
  // SPEC-UI-002 PR-3: 메타 라인이 .pen "2주 코스 · 하루 20p" 형식으로 확장.
  it('모임 카드에 코스 기간 + 일일 페이지 메타를 " · " 결합으로 표시', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c1',
          name: '데미안 읽는 모임',
          status: 'active',
          duration_days: 14,
          daily_pages: 20,
          host_id: 'u1',
          member_count: 4,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText, queryByText } = renderScreen();
    expect(getByText('데미안 읽는 모임')).toBeTruthy();
    expect(getByText('2주 코스 · 하루 20p')).toBeTruthy();
    expect(getByText('멤버 4명')).toBeTruthy();
    // 비과시: 좋아요/팔로워/랭킹 표시 없음
    expect(queryByText(/좋아요/)).toBeNull();
    expect(queryByText(/팔로워/)).toBeNull();
  });

  it('duration_days 미설정 시 "하루 Np" 만 표시', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c1b',
          name: '느긋한 모임',
          status: 'active',
          duration_days: null,
          daily_pages: 15,
          host_id: 'u1',
          member_count: 2,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText } = renderScreen();
    expect(getByText('하루 15p')).toBeTruthy();
    expect(getByText('멤버 2명')).toBeTruthy();
  });

  it('member_count 누락/0 시 "멤버 0명" 으로 폴백', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c1c',
          name: '새 모임',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 0,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText } = renderScreen();
    expect(getByText('멤버 0명')).toBeTruthy();
    expect(getByText('진도 미설정')).toBeTruthy();
  });

  it('종료된 모임 "종료됨" 표시', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c2',
          name: '느긋한 모임',
          status: 'closed',
          daily_pages: null,
          duration_days: null,
          host_id: 'u1',
          member_count: 1,
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

// ============================================================================
// SPEC-CLUB-003 ClubCard 진도 표시 (REQ-CLUBC-010~015)
// ============================================================================
// median>0+total_pages>0 → 진도 바 + "p.X · 진도 N명" 텍스트
// median=0 → "아직 진도가 없어요" 대체 (바 없음)
// total_pages=null → 바 생략, 텍스트만
describe('SPEC-CLUB-003 ClubsScreen ClubCard 진도 표시', () => {
  it('median>0 + total_pages>0 → 진도 바 + "p.X · 진도 N명" 텍스트 (REQ-CLUBC-010/011)', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c1',
          name: '데미안',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 5,
          median_page: 100,
          member_count_with_progress: 3,
          progress_total_pages: 300,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText, getByTestId } = renderScreen();
    // Pct 텍스트 (.pen Joxxl "p.90 · 멤버 4명" 형식 — 본 SPEC 은 "진도 N명")
    expect(getByText('p.100 · 진도 3명')).toBeTruthy();
    // 진도 바 Track 노드 존재
    expect(getByTestId('club-progress-track-c1')).toBeTruthy();
  });

  it('median=0 → "아직 진도가 없어요" 대체 텍스트, 진도 바 미표시 (REQ-CLUBC-013)', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c2',
          name: '새 모임',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 3,
          median_page: 0,
          member_count_with_progress: 0,
          progress_total_pages: 300,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText, queryByTestId } = renderScreen();
    expect(getByText('아직 진도가 없어요')).toBeTruthy();
    expect(queryByTestId('club-progress-track-c2')).toBeNull();
  });

  it('total_pages=null → 진도 바 생략, "p.X · 진도 N명" 텍스트만 (REQ-CLUBC-012)', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c3',
          name: '페이지 미정 모임',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 4,
          median_page: 50,
          member_count_with_progress: 2,
          progress_total_pages: null,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText, queryByTestId } = renderScreen();
    expect(getByText('p.50 · 진도 2명')).toBeTruthy();
    expect(queryByTestId('club-progress-track-c3')).toBeNull();
  });

  it('progress 필드 누락(degradation) 시 "아직 진도가 없어요" 폴백', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c4',
          name: 'RPC 장애 모임',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 4,
          median_page: 0,
          member_count_with_progress: 0,
          progress_total_pages: null,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText } = renderScreen();
    // RPC degradation (0/0/null) → median=0 분기와 동일하게 "아직 진도가 없어요"
    expect(getByText('아직 진도가 없어요')).toBeTruthy();
  });

  it('기존 "멤버 N명" 라인은 진도 표시 추가 후에도 유지된다 (회귀)', () => {
    useHostClubsMock.mockReturnValue({
      data: [
        {
          id: 'c5',
          name: '회귀 모임',
          status: 'active',
          duration_days: null,
          daily_pages: null,
          host_id: 'u1',
          member_count: 7,
          median_page: 80,
          member_count_with_progress: 4,
          progress_total_pages: 200,
        },
      ],
      isLoading: false,
      isError: false,
    } as any);
    const { getByText } = renderScreen();
    expect(getByText('멤버 7명')).toBeTruthy();
    expect(getByText('p.80 · 진도 4명')).toBeTruthy();
  });
});
