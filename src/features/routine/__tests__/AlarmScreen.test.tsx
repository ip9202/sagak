/**
 * AlarmScreen 렌더 테스트 (SPEC-ROUTINE-001)
 *
 * 검증 대상:
 * - 설정 로딩 중 → alarm-loading
 * - 설정 로드 완료 → alarm-screen + 알림 시간/토글 표시
 * - 토글 press → toggleAlarmEnabled 호출
 * - 잘못된 시간 입력 onBlur → INVALID_TIME_FORMAT 에러 표시
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

jest.mock('../index', () => {
  const actual = jest.requireActual('../index');
  return {
    ...actual,
    useAlarmSettings: jest.fn(),
    useInvalidateAlarmSettings: () => jest.fn().mockResolvedValue(undefined),
    updateAlarmTime: jest.fn(),
    toggleAlarmEnabled: jest.fn(),
    INVALID_TIME_FORMAT: '올바른 시간 형식이 아닙니다',
  };
});

import { AlarmScreen } from '../components/AlarmScreen';
import {
  useAlarmSettings,
  updateAlarmTime,
  toggleAlarmEnabled,
} from '../index';

const mockedUseAlarmSettings = useAlarmSettings as jest.MockedFunction<typeof useAlarmSettings>;
const mockedUpdateAlarmTime = updateAlarmTime as jest.MockedFunction<typeof updateAlarmTime>;
const mockedToggleAlarmEnabled = toggleAlarmEnabled as jest.MockedFunction<typeof toggleAlarmEnabled>;

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

describe('SPEC-ROUTINE-001: AlarmScreen 렌더링', () => {
  it('설정 로딩 중 → alarm-loading', () => {
    mockedUseAlarmSettings.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    const { getByTestId, queryByTestId } = withTheme(<AlarmScreen />);
    expect(getByTestId('alarm-loading')).toBeTruthy();
    expect(queryByTestId('alarm-screen')).toBeNull();
  });

  it('설정 로드 완료 → alarm-screen + 알림 시간/토글 표시', () => {
    mockedUseAlarmSettings.mockReturnValue({
      data: { alarm_time: '21:30:00', alarm_enabled: true },
      isLoading: false,
    } as any);

    const { getByTestId } = withTheme(<AlarmScreen />);
    expect(getByTestId('alarm-screen')).toBeTruthy();
    expect(getByTestId('alarm-time-input')).toBeTruthy();
    expect(getByTestId('alarm-enabled-toggle')).toBeTruthy();
  });

  it('토글 press → toggleAlarmEnabled 호출', async () => {
    mockedUseAlarmSettings.mockReturnValue({
      data: { alarm_time: '21:30:00', alarm_enabled: true },
      isLoading: false,
    } as any);
    mockedToggleAlarmEnabled.mockResolvedValue({} as any);

    const { getByTestId } = withTheme(<AlarmScreen />);
    // RN Switch — onValueChange 이벤트(valueChange)로 토글 호출
    fireEvent(getByTestId('alarm-enabled-toggle'), 'onValueChange', false);

    await waitFor(() => {
      expect(mockedToggleAlarmEnabled).toHaveBeenCalledWith(false);
    });
  });

  it('잘못된 시간 입력 onBlur → 에러 메시지 표시', async () => {
    mockedUseAlarmSettings.mockReturnValue({
      data: { alarm_time: null, alarm_enabled: false },
      isLoading: false,
    } as any);
    mockedUpdateAlarmTime.mockRejectedValue(new Error('invalid time'));

    const { getByTestId, queryByTestId } = withTheme(<AlarmScreen />);
    const input = getByTestId('alarm-time-input');
    fireEvent.changeText(input, '99:99');
    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(getByTestId('alarm-time-error')).toBeTruthy();
    });
    expect(queryByTestId('alarm-time-error')).toBeTruthy();
  });
});
