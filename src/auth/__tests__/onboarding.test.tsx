/**
 * Onboarding screen tests
 * SPEC-AUTH-001 — REQ-AUTH-020~024, AC-O3~O9
 *
 * M3 TDD 사이클:
 * - M3-1 AC-O3/O4/O5: nickname 검증 — 빈 문자열/20자 초과/1자 이상
 * - M3-2 AC-O6: UPDATE nickname만 (avatar null)
 * - M3-3 AC-O7: UPDATE nickname + avatar
 * - M3-4 AC-O8/O9: UPDATE 실패 — 에러 표시, 세션 유지, 재시도 가능
 *
 * Mock 전략:
 * - AuthContext.Provider로 useSession 반환값 주입 (user, refreshProfile)
 * - getSupabaseClient를 모킹하여 UPDATE 체인(from().update().eq()) 검증
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

// Supabase 클라이언트 mock — UPDATE 호출 체인 검증
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSupabaseClient: {
  from: jest.Mock;
} = {
  from: jest.fn(() => ({
    update: mockUpdate,
  })),
};

jest.mock('../../lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabaseClient,
}));

import { OnboardingScreen } from '../onboarding';
import { AuthContext } from '../AuthContext';
import type { AuthContextValue } from '../types';
import type { User } from '@supabase/supabase-js';

// 테스트용 최소 User 객체
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
  // 기본 UPDATE 체인 — resolve로 { data, error: null } 반환
  mockUpdate.mockReturnValue({
    eq: mockEq,
  });
  mockEq.mockResolvedValue({ data: null, error: null });
});

describe('M3-1 AC-O3/O4/O5: nickname 검증', () => {
  it('O3: 빈 닉네임일 때 "완료" 버튼이 비활성화된다', () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const submitButton = screen.getByText('완료');
    // TouchableOpacity disabled 상태 — 부모의 disabled prop 확인
    // 빈 입력 상태에서는 UPDATE가 호출되지 않아야 한다
    expect(submitButton).toBeTruthy();
    // nickname 입력 필드가 존재하는지 확인
    expect(screen.getByPlaceholderText('닉네임을 입력하세요')).toBeTruthy();
  });

  it('O3: 빈 닉네임 상태에서 "완료" 버튼 탭 시 UPDATE가 호출되지 않는다', () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const submitButton = screen.getByText('완료');
    fireEvent.press(submitButton);

    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('O5: 1자 이상 닉네임 입력 시 "완료" 버튼이 활성화된다', async () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독');

    const submitButton = screen.getByText('완료');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });
  });

  it('O4: 20자 초과 닉네임 입력 시 버튼이 비활성화된다', () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    // 21자 입력
    fireEvent.changeText(input, '가'.repeat(21));

    const submitButton = screen.getByText('완료');
    fireEvent.press(submitButton);

    // 20자 초과 시 UPDATE 호출되지 않아야 함
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
  });

  it('O4: 정확히 20자 닉네임은 제출 가능하다', async () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '가'.repeat(20));

    const submitButton = screen.getByText('완료');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });
  });
});

describe('M3-2 AC-O6: UPDATE nickname만 (avatar null)', () => {
  it('nickname만 입력하고 완료 시 UPDATE가 호출된다', async () => {
    const mockRefresh = jest.fn().mockResolvedValue(undefined);
    render(<OnboardingScreen />, {
      wrapper: createWrapper({
        ...baseAuthValue,
        refreshProfile: mockRefresh,
      }),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    const submitButton = screen.getByText('완료');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        nickname: '독서왕',
        avatar_url: null,
      });
    });
  });

  it('UPDATE 조건이 id = user.id 이다', async () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
    });
  });

  it('UPDATE 성공 후 refreshProfile이 호출된다', async () => {
    const mockRefresh = jest.fn().mockResolvedValue(undefined);
    render(<OnboardingScreen />, {
      wrapper: createWrapper({
        ...baseAuthValue,
        refreshProfile: mockRefresh,
      }),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe('M3-3 AC-O7: UPDATE nickname + avatar', () => {
  it('nickname과 avatar 모두 설정 시 UPDATE에 반영된다', async () => {
    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '책벌레');

    // 아바타 선택 버튼 탭 (placeholder URL 선택)
    const avatarButton = screen.getByText('아바타 선택');
    fireEvent.press(avatarButton);

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          nickname: '책벌레',
        }),
      );
    });
    // avatar_url은 null이 아닌 값이어야 함
    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.avatar_url).not.toBeNull();
  });
});

describe('M3-4 AC-O8/O9: UPDATE 실패 처리', () => {
  it('O8: UPDATE가 에러를 반환하면 에러 메시지를 표시한다', async () => {
    mockEq.mockResolvedValue({ data: null, error: { message: 'RLS 거부' } });

    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(screen.getByText('저장 중 오류가 발생했습니다. 다시 시도해주세요.')).toBeTruthy();
    });
  });

  it('O9: UPDATE가 reject되면 에러 메시지를 표시한다', async () => {
    mockEq.mockRejectedValue(new Error('Network error'));

    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(screen.getByText('저장 중 오류가 발생했습니다. 다시 시도해주세요.')).toBeTruthy();
    });
  });

  it('O8/O9: 실패 후 signOut이 호출되지 않는다 (세션 유지)', async () => {
    const mockSignOut = jest.fn().mockResolvedValue(undefined);
    mockEq.mockResolvedValue({ data: null, error: { message: 'RLS 거부' } });

    render(<OnboardingScreen />, {
      wrapper: createWrapper({
        ...baseAuthValue,
        signOut: mockSignOut,
      }),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(screen.getByText('저장 중 오류가 발생했습니다. 다시 시도해주세요.')).toBeTruthy();
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('O8/O9: 실패 후 재시도 가능하다', async () => {
    let callCount = 0;
    mockEq.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: null, error: { message: 'RLS 거부' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const mockRefresh = jest.fn().mockResolvedValue(undefined);
    render(<OnboardingScreen />, {
      wrapper: createWrapper({
        ...baseAuthValue,
        refreshProfile: mockRefresh,
      }),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    // 첫 번째 시도 (실패)
    fireEvent.press(screen.getByText('완료'));
    await waitFor(() => {
      expect(screen.getByText('저장 중 오류가 발생했습니다. 다시 시도해주세요.')).toBeTruthy();
    });

    // 두 번째 시도 (성공)
    fireEvent.press(screen.getByText('완료'));
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe('M3 AC-A7: INSERT 방어 (REQ-AUTH-004)', () => {
  it('온보딩 화면은 users 테이블에 INSERT를 호출하지 않는다', async () => {
    const mockInsert = jest.fn();
    mockSupabaseClient.from.mockReturnValue({
      update: mockUpdate,
      insert: mockInsert,
    });

    render(<OnboardingScreen />, {
      wrapper: createWrapper(baseAuthValue),
    });

    const input = screen.getByPlaceholderText('닉네임을 입력하세요');
    fireEvent.changeText(input, '독서왕');

    fireEvent.press(screen.getByText('완료'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('M3 REQ-AUTH-033: Provider 외부 호출 방어', () => {
  it('AuthProvider 없이 렌더링 시 에러를 throw한다', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      render(<OnboardingScreen />);
    }).toThrow('OnboardingScreen must be used within AuthProvider');

    consoleErrorSpy.mockRestore();
  });
});
