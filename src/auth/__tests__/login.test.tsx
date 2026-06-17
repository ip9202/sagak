/**
 * login.tsx 화면 테스트
 * SPEC-AUTH-001 — REQ-AUTH-002~004
 *
 * M2-B TDD 사이클:
 * - M2-B-1 AC-A2: 카카오 버튼 렌더링 — kakao 제공자로 signInWithProvider 호출
 * - M2-B-2 AC-A3: 네이버 버튼 렌더링 — naver 제공자로 signInWithProvider 호출
 * - M2-B-3 AC-A4: OAuth 실패 처리 — 에러 메시지 표시
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { LoginScreen } from '../login';
import { AuthContext } from '../AuthContext';
import type { AuthContextValue } from '../types';

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

// Mock AuthContext
const mockAuthContextValue: AuthContextValue = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

/**
 * AuthProvider 래퍼 — AuthContext를 모의값으로 주입
 */
function createWrapper(authValue: AuthContextValue) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    );
  };
}

describe('M2-B-1 + M2-B-2 AC-A2/A3: OAuth 버튼 렌더링', () => {
  it('카카오 로그인 버튼을 렌더링한다', () => {
    render(<LoginScreen />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const kakaoButton = screen.getByText('카카오로 시작하기');
    expect(kakaoButton).toBeTruthy();
  });

  it('네이버 로그인 버튼을 렌더링한다', () => {
    render(<LoginScreen />, {
      wrapper: createWrapper(mockAuthContextValue),
    });

    const naverButton = screen.getByText('네이버로 시작하기');
    expect(naverButton).toBeTruthy();
  });

  it('카카오 버튼 탭 시 signInWithProvider를 kakao로 호출한다', async () => {
    const mockSignIn = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen />, {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        signInWithProvider: mockSignIn,
      }),
    });

    const kakaoButton = screen.getByText('카카오로 시작하기');
    fireEvent.press(kakaoButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('kakao');
    });
  });

  it('네이버 버튼 탭 시 signInWithProvider를 naver로 호출한다', async () => {
    const mockSignIn = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen />, {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        signInWithProvider: mockSignIn,
      }),
    });

    const naverButton = screen.getByText('네이버로 시작하기');
    fireEvent.press(naverButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('naver');
    });
  });
});

describe('M2-B-3 AC-A4: OAuth 실패 처리', () => {
  it('signInWithProvider가 reject 시 에러 메시지를 표시한다', async () => {
    const mockSignIn = jest.fn().mockRejectedValue(new Error('OAuth 로그인 실패'));

    render(<LoginScreen />, {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        signInWithProvider: mockSignIn,
      }),
    });

    const kakaoButton = screen.getByText('카카오로 시작하기');
    fireEvent.press(kakaoButton);

    await waitFor(() => {
      const errorMessage = screen.queryByText('카카오 로그인에 실패했습니다');
      expect(errorMessage).toBeTruthy();
    });
  });

  it('에러 발생 후 retry 가능하다', async () => {
    let callCount = 0;
    const mockSignIn = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error('OAuth 로그인 실패'));
      }
      return Promise.resolve();
    });

    render(<LoginScreen />, {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        signInWithProvider: mockSignIn,
      }),
    });

    const kakaoButton = screen.getByText('카카오로 시작하기');

    // 첫 번째 클릭 (실패)
    fireEvent.press(kakaoButton);
    await waitFor(() => {
      const errorMessage = screen.queryByText('카카오 로그인에 실패했습니다');
      expect(errorMessage).toBeTruthy();
    });

    // 두 번째 클릭 (성공)
    fireEvent.press(kakaoButton);
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledTimes(2);
    });
  });
});
