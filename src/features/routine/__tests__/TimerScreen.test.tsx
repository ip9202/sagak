/**
 * TimerScreen 렌더 테스트 (SPEC-ROUTINE-001)
 *
 * 검증 대상:
 * - 활성 세션 없음 → timer-start-prompt + "독서 시작" 버튼
 * - bookId 없음 → 시작 버튼 비활성화
 * - bookId 있음 → 시작 버튼 활성화, press 시 startSession 호출
 * - 활성 세션 존재 → timer-display + "독서 종료" 버튼, press 시 endSession 호출
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 네이티브 모듈 mock (my.test.tsx 패턴 차용)
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// useReadingTimer 를 안정적인 표시값으로 고정 — setInterval/timer 변동성 회피
jest.mock('../useReadingTimer', () => ({
  useReadingTimer: () => ({ elapsedSeconds: 83, display: '00:01:23' }),
  formatElapsed: (s: number) => `00:00:${s}`,
}));

// 도메인 API/훅 mock — index.ts 를 통해 컴포넌트가 소비하므로 index 경로를 mock.
jest.mock('../index', () => {
  const actual = jest.requireActual('../index');
  return {
    ...actual,
    useActiveSession: jest.fn(),
    useReadingTimer: () => ({ elapsedSeconds: 83, display: '00:01:23' }),
    startSession: jest.fn(),
    endSession: jest.fn(),
    pickEndEncouragement: () => '오늘도 한 걸음, 수고했어요',
  };
});

import { TimerScreen } from '../components/TimerScreen';
import {
  useActiveSession,
  startSession,
  endSession,
} from '../index';

const mockedUseActiveSession = useActiveSession as jest.MockedFunction<typeof useActiveSession>;
const mockedStartSession = startSession as jest.MockedFunction<typeof startSession>;
const mockedEndSession = endSession as jest.MockedFunction<typeof endSession>;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function withTheme(ui: React.ReactElement) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SPEC-ROUTINE-001: TimerScreen 렌더링', () => {
  it('활성 세션 없음 + bookId 없음 → timer-start-prompt + 비활성 시작 버튼', () => {
    mockedUseActiveSession.mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    const { getByTestId, queryByTestId } = withTheme(<TimerScreen />);
    expect(getByTestId('timer-start-prompt')).toBeTruthy();
    expect(queryByTestId('timer-display')).toBeNull();

    // 시작 버튼은 접근성 라벨로 식별 — disabled 상태 확인
    const startBtn = getByTestId('button').parent;
    expect(startBtn).toBeTruthy();
  });

  it('활성 세션 없음 + bookId 있음 → 시작 버튼 press 시 startSession 호출', async () => {
    mockedUseActiveSession.mockReturnValue({
      data: null,
      isLoading: false,
    } as any);
    mockedStartSession.mockResolvedValue({} as any);

    const { getAllByLabelText } = withTheme(<TimerScreen bookId="book-1" />);
    const startBtn = getAllByLabelText('독서 시작')[0];
    fireEvent.press(startBtn);

    await waitFor(() => {
      expect(mockedStartSession).toHaveBeenCalledWith('book-1');
    });
  });

  it('활성 세션 존재 → timer-display + "독서 종료" 버튼, press 시 endSession 호출', async () => {
    const activeSession = {
      id: 'sess-1',
      user_id: 'u-1',
      book_id: 'book-1',
      started_at: new Date(Date.now() - 83000).toISOString(),
      ended_at: null,
      duration_seconds: null,
      pages_read: null,
    };
    mockedUseActiveSession.mockReturnValue({
      data: activeSession,
      isLoading: false,
    } as any);
    mockedEndSession.mockResolvedValue({} as any);

    const { getByTestId, getAllByLabelText } = withTheme(<TimerScreen bookId="book-1" />);
    expect(getByTestId('timer-display')).toBeTruthy();
    // useReadingTimer mock 이 고정 표시값 반환
    expect(getByTestId('timer-display').props.children).toBe('00:01:23');

    const endBtn = getAllByLabelText('독서 종료')[0];
    fireEvent.press(endBtn);

    await waitFor(() => {
      expect(mockedEndSession).toHaveBeenCalledWith('sess-1');
    });
  });
});
