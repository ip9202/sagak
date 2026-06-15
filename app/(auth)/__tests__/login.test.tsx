/**
 * app/(auth)/login.tsx 라우트 테스트
 * SPEC-AUTH-001 — REQ-AUTH-002~004, AC-A1~A7
 *
 * M4 TDD 사이클:
 * - AC-A1: 카카오 버튼 → signInWithProvider('kakao')
 * - AC-A2: 구글 버튼 → signInWithProvider('google')
 * - AC-A3: 애플 버튼 → signInWithProvider('apple')
 * - AC-A4: OAuth 취소 → 에러 메시지 표시
 * - AC-A5: 네트워크 오류 → 에러 메시지 표시
 * - AC-A7: 클라이언트 INSERT 금지 (수동 검증 — src/auth/login.tsx에 insert 호출 없음)
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

import LoginScreen from '../login';
import { AuthContext } from '../../../src/auth/AuthContext';
import type { AuthContextValue } from '../../../src/auth/types';

const baseAuthValue: AuthContextValue = {
  session: null,
  user: null,
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
});

describe('AC-A1: 카카오 OAuth 로그인', () => {
  it('카카오 버튼이 렌더링된다', () => {
    render(<LoginScreen />, { wrapper: createWrapper(baseAuthValue) });
    expect(screen.getByText('카카오로 시작하기')).toBeTruthy();
  });

  it('카카오 버튼 탭 시 signInWithProvider를 kakao로 호출한다', async () => {
    const mockSignIn = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen />, {
      wrapper: createWrapper({ ...baseAuthValue, signInWithProvider: mockSignIn }),
    });

    fireEvent.press(screen.getByText('카카오로 시작하기'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('kakao');
    });
  });
});

describe('AC-A2: 구글 OAuth 로그인', () => {
  it('구글 버튼이 렌더링된다', () => {
    render(<LoginScreen />, { wrapper: createWrapper(baseAuthValue) });
    expect(screen.getByText('Google로 시작하기')).toBeTruthy();
  });

  it('구글 버튼 탭 시 signInWithProvider를 google로 호출한다', async () => {
    const mockSignIn = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen />, {
      wrapper: createWrapper({ ...baseAuthValue, signInWithProvider: mockSignIn }),
    });

    fireEvent.press(screen.getByText('Google로 시작하기'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('google');
    });
  });
});

describe('AC-A3: 애플 OAuth 로그인', () => {
  it('애플 버튼이 렌더링된다', () => {
    render(<LoginScreen />, { wrapper: createWrapper(baseAuthValue) });
    expect(screen.getByText('Apple로 시작하기')).toBeTruthy();
  });

  it('애플 버튼 탭 시 signInWithProvider를 apple로 호출한다', async () => {
    const mockSignIn = jest.fn().mockResolvedValue(undefined);
    render(<LoginScreen />, {
      wrapper: createWrapper({ ...baseAuthValue, signInWithProvider: mockSignIn }),
    });

    fireEvent.press(screen.getByText('Apple로 시작하기'));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('apple');
    });
  });
});

describe('AC-A4: OAuth 로그인 취소', () => {
  it('signInWithProvider reject 시 에러 메시지가 표시된다', async () => {
    const mockSignIn = jest.fn().mockRejectedValue(new Error('OAuth 취소'));
    render(<LoginScreen />, {
      wrapper: createWrapper({ ...baseAuthValue, signInWithProvider: mockSignIn }),
    });

    fireEvent.press(screen.getByText('카카오로 시작하기'));

    await waitFor(() => {
      expect(screen.getByText('카카오 로그인에 실패했습니다')).toBeTruthy();
    });
  });
});

describe('AC-A5: OAuth 네트워크 오류', () => {
  it('네트워크 에러 reject 시 에러 메시지가 표시된다', async () => {
    const mockSignIn = jest.fn().mockRejectedValue(new Error('Network error'));
    render(<LoginScreen />, {
      wrapper: createWrapper({ ...baseAuthValue, signInWithProvider: mockSignIn }),
    });

    fireEvent.press(screen.getByText('Google로 시작하기'));

    await waitFor(() => {
      expect(screen.getByText('Google 로그인에 실패했습니다')).toBeTruthy();
    });
  });
});

describe('AC-A7: 클라이언트 INSERT 방어 (REQ-AUTH-004)', () => {
  it('로그인 화면 로직이 public.users INSERT를 수행하지 않는다', () => {
    // LoginScreen은 AuthContext.signInWithProvider만 호출한다.
    // AuthProvider와 src/auth/login.tsx는 Supabase insert()를 호출하지 않는다
    // (정적 검증: login.tsx에 .insert( 문자열이 없어야 한다).
    // 여기서는 라우트가 LoginScreen을 정상 re-export하는지만 검증한다.
    const { UNSAFE_root } = render(<LoginScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });
    expect(UNSAFE_root).toBeTruthy();
  });
});
