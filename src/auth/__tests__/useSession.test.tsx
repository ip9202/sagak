/**
 * @jest-environment jsdom
 *
 * useSession 훅 테스트
 * SPEC-AUTH-001 — REQ-AUTH-030~033
 *
 * M2-A TDD 사이클:
 * - M2-A-1 AC-G1: useSession 훅 정의 — AuthContext 컨슘 및 값 반환
 * - M2-A-2 AC-G2: 인증 상태 파생값 — isAuthenticated, isOnboarded 정확성
 * - M2-A-3 AC-G3: 로딩 상태 가드 — loading 시 null 반환
 * - M2-A-4 AC-G4: 컨텍스트 미배치 방어 — 에러 발생
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useSession } from '../useSession';
import { AuthProvider, AuthContext } from '../AuthContext';
import type { AuthContextValue, UserProfile } from '../types';

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

// Mock React Context 생성
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

describe('M2-A-1 AC-G1: useSession 훅 정의', () => {
  it('AuthContext를 컨슘하여 값을 반환한다', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper(mockAuthContextValue),
    });

    expect(result.current).toEqual({
      session: null,
      user: null,
      profile: null,
      loading: false,
      isAuthenticated: false,
      isOnboarded: false,
      signInWithProvider: mockAuthContextValue.signInWithProvider,
      signOut: mockAuthContextValue.signOut,
      refreshProfile: mockAuthContextValue.refreshProfile,
    });
  });
});

describe('M2-A-2 AC-G2: 인증 상태 파생값', () => {
  it('session이 없으면 isAuthenticated는 false다', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        session: null,
      }),
    });

    expect(result.current!.isAuthenticated).toBe(false);
  });

  it('session이 있으면 authenticated는 true다', () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockUser = { id: 'user-123' };
    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        session: mockSession as any,
        user: mockUser as any,
      }),
    });

    expect(result.current!.isAuthenticated).toBe(true);
  });

  it('profile이 없거나 nickname이 null이면 isOnboarded는 false다', () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: UserProfile | null = null;

    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        session: mockSession as any,
        profile: mockProfile,
      }),
    });

    expect(result.current!.isOnboarded).toBe(false);
  });

  it('profile이 있고 nickname이 null이 아니면 isOnboarded는 true다', () => {
    const mockSession = { user: { id: 'user-123' } };
    const mockProfile: UserProfile = {
      id: 'user-123',
      nickname: '테스트유저',
      avatar_url: 'https://example.com/avatar.jpg',
      provider: 'kakao',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
    };

    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        session: mockSession as any,
        profile: mockProfile,
      }),
    });

    expect(result.current!.isOnboarded).toBe(true);
  });
});

describe('M2-A-3 AC-G3: 로딩 상태 가드', () => {
  it('loading이 true이면 null을 반환한다', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        loading: true,
      }),
    });

    expect(result.current).toBeNull();
  });

  it('loading이 false이면 세션 객체를 반환한다', () => {
    const { result } = renderHook(() => useSession(), {
      wrapper: createWrapper({
        ...mockAuthContextValue,
        loading: false,
      }),
    });

    expect(result.current).not.toBeNull();
    expect(result.current?.loading).toBe(false);
  });
});

describe('M2-A-4 AC-G4: 컨텍스트 미배치 방어', () => {
  it('AuthProvider 외부에서 호출 시 에러를 발생시킨다', () => {
    // AuthContext를 제공하지 않는 래퍼
    function NoAuthProviderWrapper({ children }: { children: React.ReactNode }) {
      return <>{children}</>;
    }

    // 에러를 감지하기 위해 console.error를 모킹
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      renderHook(() => useSession(), {
        wrapper: NoAuthProviderWrapper,
      });
    }).toThrow('useSession must be used within AuthProvider');

    consoleErrorSpy.mockRestore();
  });
});
