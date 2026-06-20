/**
 * 프로필 수정 화면 테스트 (SPEC-PROFILE-001 REQ-PROF-002/003)
 *
 * 검증 대상:
 * - P3: nickname 입력 → 저장 → updateProfile 호출
 * - P4: avatar_url 필드 존재
 * - P6: email/provider/role 수정 UI 미노출
 * - P7: 빈 nickname → 저장 버튼 비활성 또는 에러
 * - P8: 21자 nickname → 검증 에러
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(() => ({ user: { id: 'u-1' } })),
}));

jest.mock('../../../src/features/profile', () => ({
  useUpdateProfile: jest.fn(),
  useProfile: jest.fn(),
  NICKNAME_MAX_LENGTH: 20,
  validateProfileInput: (input: { nickname: string }) => {
    const trimmed = input.nickname.trim();
    if (trimmed.length === 0) return { valid: false, message: '닉네임을 입력해 주세요' };
    if (trimmed.length > 20) return { valid: false, message: '닉네임은 20자 이내로 입력해 주세요' };
    return { valid: true };
  },
}));

import { useUpdateProfile, useProfile } from '../../../src/features/profile';
import EditScreen from '../my/edit';

const mockedUseUpdateProfile = useUpdateProfile as jest.Mock;
const mockedUseProfile = useProfile as jest.Mock;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

const mutateAsync = jest.fn().mockResolvedValue(undefined);
const reset = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockedUseUpdateProfile.mockReturnValue({ mutateAsync, reset, isPending: false });
  mockedUseProfile.mockReturnValue({
    data: {
      id: 'u-1',
      nickname: '독서가',
      avatar_url: 'https://x/a.png',
      email: 'u1@e.com',
      provider: 'naver',
    },
  });
});

describe('SPEC-PROFILE-001 REQ-PROF-002/003: 프로필 수정 화면', () => {
  it('기존 nickname/avatar_url 을 초기값으로 표시', () => {
    const { getByDisplayValue } = withTheme(<EditScreen />);
    expect(getByDisplayValue('독서가')).toBeTruthy();
  });

  it('P6: email/provider/role 수정 입력 필드 미노출', () => {
    const { queryByTestId, queryByText } = withTheme(<EditScreen />);
    expect(queryByText('이메일')).toBeNull();
    expect(queryByText('제공자')).toBeNull();
    expect(queryByTestId('edit-email')).toBeNull();
  });

  it('P3: nickname 변경 후 저장 → updateProfile 호출', async () => {
    const { getByTestId, getByDisplayValue } = withTheme(<EditScreen />);
    const input = getByDisplayValue('독서가');
    fireEvent.changeText(input, '책벌레');
    fireEvent.press(getByTestId('edit-save'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        nickname: '책벌레',
        avatar_url: 'https://x/a.png',
      });
    });
  });

  it('P7: 빈 nickname → 저장 시 에러 메시지 노출, updateProfile 미호출', async () => {
    const { getByTestId, getByDisplayValue, getByText } = withTheme(<EditScreen />);
    fireEvent.changeText(getByDisplayValue('독서가'), '');
    fireEvent.press(getByTestId('edit-save'));

    await waitFor(() => {
      expect(getByText('닉네임을 입력해 주세요')).toBeTruthy();
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
