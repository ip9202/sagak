/**
 * 홈 탭(HomeTab) 컴포넌트 테스트 (SPEC-NAV-001 — F03-Home 구현)
 *
 * 검증 대상:
 * - 헤더 타이틀 "오늘의 독서" + 알림종 아이콘
 * - AlarmCard 따뜻한 카피 렌더링 (알림 미설정 시 기본 문구)
 * - 알림 설정 시 동적 문구("매일 HH:MM에 알려드릴게요")
 * - 읽는중 책 존재 시 BookCard 렌더링
 * - 읽는중 책 없을 때 빈 상태(검색 진입) 렌더링
 * - CTA "오늘의 감정 기록하기" 네비게이션 (책 유무 분기)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/theme/theme';
import type { LibraryItem } from '../../../src/features/library/types';

// expo-router mock — useRouter 인스턴스를 캡처하여 push 호출 검증.
// 변수명은 mock 접두어 필수 (jest.mock 호이스팅 시 out-of-scope 참조 허용 조건).
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

// @expo/vector-icons(Feather) — 네이티브 의존성 mock (expo-asset/expo-font 회피)
jest.mock('@expo/vector-icons', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props: Record<string, unknown>) =>
    ReactMod.createElement(
      Text,
      { testID: 'feather-icon' },
      (props.name as string) || 'icon',
    );
  return {
    __esModule: true,
    Feather: MockIcon,
    default: MockIcon,
  };
});

// 네이티브 인증/저장소 모듈 mock
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
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props),
  };
});

// useSession / useLibrary / useAlarmSettings mock
jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));
jest.mock('../../../src/features/library/useLibrary', () => ({
  useLibrary: jest.fn(),
}));
jest.mock('../../../src/features/routine/useAlarmSettings', () => ({
  useAlarmSettings: jest.fn(),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '../../../src/auth/useSession';
import { useLibrary } from '../../../src/features/library/useLibrary';
import { useAlarmSettings } from '../../../src/features/routine/useAlarmSettings';
import HomeTab from '../index';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseLibrary = useLibrary as jest.MockedFunction<typeof useLibrary>;
const mockedUseAlarmSettings =
  useAlarmSettings as jest.MockedFunction<typeof useAlarmSettings>;

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1' },
  profile: { id: 'u-1', nickname: '독자', bio: null },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const sampleReadingItem: LibraryItem = {
  id: 'ub-1',
  book_id: 'b-1',
  user_id: 'u-1',
  status: 'reading',
  current_page: 50,
  is_public: true,
  last_progress_at: '2026-06-15T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  books: {
    id: 'b-1',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    cover_url: null,
    total_pages: 400,
  },
} as LibraryItem;

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderTab(client: QueryClient): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <HomeTab />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPush.mockClear();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  // 기본: 읽는중 책 없음, 알림 미설정
  mockedUseLibrary.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  mockedUseAlarmSettings.mockReturnValue({
    data: { alarm_time: null, alarm_enabled: false },
    isLoading: false,
    isError: false,
    error: null,
  } as any);
});

describe('SPEC-NAV-001 홈 탭: F03-Home 렌더링', () => {
  describe('로딩 상태', () => {
    it('useSession 이 null(로딩)이면 home-loading 인디케이터를 렌더링한다', () => {
      mockedUseSession.mockReturnValue(null as any);
      const { getByTestId } = renderTab(createTestQueryClient());
      expect(getByTestId('home-loading')).toBeTruthy();
    });
  });

  describe('헤더', () => {
    it('타이틀 "오늘의 독서" 를 렌더링한다', () => {
      const { getByText } = renderTab(createTestQueryClient());
      expect(getByText('오늘의 독서')).toBeTruthy();
    });

    it('알림종 아이콘을 렌더링한다', () => {
      const { getByTestId } = renderTab(createTestQueryClient());
      expect(getByTestId('home-bell-icon')).toBeTruthy();
    });
  });

  describe('AlarmCard 따뜻한 카피', () => {
    it('알림 미설정 시 기본 따뜻한 카피를 렌더링한다', () => {
      const { getByText } = renderTab(createTestQueryClient());
      expect(
        getByText('오늘의 첫 페이지가 당신을 기다리고 있어요'),
      ).toBeTruthy();
      expect(
        getByText(
          '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.',
        ),
      ).toBeTruthy();
    });

    it('알림 설정 시 "매일 HH:MM에 알려드릴게요" 동적 카피를 렌더링한다', () => {
      mockedUseAlarmSettings.mockReturnValue({
        data: { alarm_time: '21:30:00', alarm_enabled: true },
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      expect(getByText('매일 21:30에 알려드릴게요')).toBeTruthy();
    });

    it('alarm_enabled 이지만 alarm_time 이 null 이면 기본 카피를 렌더링한다', () => {
      mockedUseAlarmSettings.mockReturnValue({
        data: { alarm_time: null, alarm_enabled: true },
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      expect(
        getByText(
          '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.',
        ),
      ).toBeTruthy();
    });

    // FIX 4: formatAlarmTime 비정형 입력 방어 — 범위/형식 위반 시 기본 카피 폴백.
    it('alarm_time 이 비정형("25:99:99", 시 범위 위반)이면 기본 카피를 렌더링한다', () => {
      mockedUseAlarmSettings.mockReturnValue({
        data: { alarm_time: '25:99:99', alarm_enabled: true },
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      expect(
        getByText(
          '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.',
        ),
      ).toBeTruthy();
    });

    it('alarm_time 이 비정형("::")이면 기본 카피를 렌더링한다', () => {
      mockedUseAlarmSettings.mockReturnValue({
        data: { alarm_time: '::', alarm_enabled: true },
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      expect(
        getByText(
          '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.',
        ),
      ).toBeTruthy();
    });

    it('alarm_time 이 비정형("9:5", 분 자리 부족)이면 기본 카피를 렌더링한다', () => {
      mockedUseAlarmSettings.mockReturnValue({
        data: { alarm_time: '9:5', alarm_enabled: true },
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      expect(
        getByText(
          '5분만 읽어도 충분해요. 작은 시작이 큰 여정이 될 거예요.',
        ),
      ).toBeTruthy();
    });
  });

  describe('지금 읽는 책 (CurrentBook)', () => {
    it('읽는중 책이 있으면 BookCard 제목을 렌더링한다', async () => {
      mockedUseLibrary.mockReturnValue({
        data: [sampleReadingItem],
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      await waitFor(() => {
        expect(getByText('미드나잇 라이브러리')).toBeTruthy();
      });
    });

    it('읽는중 책이 없으면 빈 상태("읽고 있는 책이 없어요")를 렌더링한다', () => {
      const { getByText } = renderTab(createTestQueryClient());
      expect(getByText('읽고 있는 책이 없어요')).toBeTruthy();
    });

    it('빈 상태의 검색 CTA를 누르면 /search 로 이동한다', () => {
      const { getByTestId } = renderTab(createTestQueryClient());
      fireEvent.press(getByTestId('home-empty-search-cta'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });
  });

  describe('CTA "오늘의 감정 기록하기"', () => {
    it('CTA 텍스트를 렌더링한다', () => {
      const { getByText } = renderTab(createTestQueryClient());
      expect(getByText('오늘의 감정 기록하기')).toBeTruthy();
    });

    it('읽는중 책이 있으면 CTA 누를 때 책 상세 라우트로 이동한다', async () => {
      mockedUseLibrary.mockReturnValue({
        data: [sampleReadingItem],
        isLoading: false,
        isError: false,
        error: null,
      } as any);
      const { getByText } = renderTab(createTestQueryClient());
      const cta = getByText('오늘의 감정 기록하기');
      fireEvent.press(cta);
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/emotion/[bookId]',
          params: { bookId: 'b-1' },
        }),
      );
    });

    it('읽는중 책이 없으면 CTA 누를 때 /search 로 이동한다', () => {
      const { getByText } = renderTab(createTestQueryClient());
      fireEvent.press(getByText('오늘의 감정 기록하기'));
      expect(mockPush).toHaveBeenCalledWith('/search');
    });
  });
});
