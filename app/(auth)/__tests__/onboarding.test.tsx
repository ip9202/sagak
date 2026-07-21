/**
 * app/(auth)/onboarding.tsx 라우트 테스트
 * SPEC-AUTH-001 — REQ-AUTH-020~024, AC-O3~O9
 *
 * M4 TDD 사이클:
 * 라우트 파일이 src/auth/onboarding.tsx의 OnboardingScreen을 re-export하는지 검증.
 * 세부 동작(검증/UPDATE/실패)은 src/auth/__tests__/onboarding.test.tsx에서 커버한다.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

// AsyncStorage 관련 네이티브 모듈 mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('expo-secure-store', () => ({
  default: {
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  },
}));

// Supabase 클라이언트 mock
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSupabaseClient = {
  from: jest.fn(() => ({ update: mockUpdate })),
};
jest.mock('../../../src/lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

import OnboardingScreen from '../onboarding';
import { AuthContext } from '../../../src/auth/AuthContext';
import type { AuthContextValue } from '../../../src/auth/types';
import type { User } from '@supabase/supabase-js';

function makeMockUser(userId: string): User {
  return {
    id: userId,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  } as unknown as User;
}

const baseAuthValue: AuthContextValue = {
  session: null,
  user: makeMockUser('user-123'),
  profile: null,
  loading: false,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

function createWrapper(authValue: AuthContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockResolvedValue({ data: null, error: null });
});

describe('AC-O3~O9: OnboardingScreen 라우트 통합', () => {
  it('라우트가 OnboardingScreen을 렌더링한다', () => {
    render(<OnboardingScreen />, { wrapper: createWrapper(baseAuthValue) });

    // nickname 입력 필드가 표시되어야 함
    expect(screen.getByPlaceholderText('닉네임을 입력하세요')).toBeTruthy();
    // 완료 버튼이 표시되어야 함
    expect(screen.getByText('완료')).toBeTruthy();
  });

  it('AC-O3: nickname 입력 전에는 완료 버튼 탭이 UPDATE를 트리거하지 않는다', () => {
    render(<OnboardingScreen />, { wrapper: createWrapper(baseAuthValue) });

    fireEvent.press(screen.getByText('완료'));

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('AC-O6: nickname 입력 후 완료 시 users UPDATE가 호출된다', async () => {
    render(<OnboardingScreen />, { wrapper: createWrapper(baseAuthValue) });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');
    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockUpdate).toHaveBeenCalledWith({
        nickname: '독서왕',
        avatar_url: null,
      });
    });
  });
});
