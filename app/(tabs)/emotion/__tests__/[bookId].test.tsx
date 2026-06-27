/**
 * 감정 입력/타임라인 통합 라우트 테스트 (SPEC-EMOTION-001 P1-B conformance)
 *
 * 검증 대상:
 * - 세션 로딩(useSession null) 시 로딩 인디케이터
 * - 미인증 시 로그인 라우트로 replace
 * - 인증 시 EmotionInputScreen + TimelineScreen 통합 렌더링
 * - EmotionInputScreen.onSubmit → useCreateEmotionRecord.mutate 호출
 * - sort 토글 → useEmotionRecords sort 파라미터 전달
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../../src/theme/theme';

// expo-router mock — useRouter 인스턴스 캡처
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ replace: mockReplace, push: jest.fn() })),
  useLocalSearchParams: (...args: unknown[]) => mockUseLocalSearchParams(...args),
}));

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

// @expo/vector-icons(Feather) mock
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

// 도메인 훅/API mock
jest.mock('../../../../src/auth/useSession', () => ({
  useSession: jest.fn(),
}));
jest.mock('../../../../src/features/library/useLibraryItem', () => ({
  useLibraryItem: jest.fn(),
}));
jest.mock('../../../../src/features/book/bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));
jest.mock('../../../../src/features/emotion/useEmotionRecords', () => ({
  useEmotionRecords: jest.fn(),
  useCreateEmotionRecord: jest.fn(),
}));

import { useSession } from '../../../../src/auth/useSession';
import { useLibraryItem } from '../../../../src/features/library/useLibraryItem';
import { getBookDetail } from '../../../../src/features/book/bookDetailApi';
import {
  useEmotionRecords,
  useCreateEmotionRecord,
} from '../../../../src/features/emotion/useEmotionRecords';
import type { LibraryItem } from '../../../../src/features/library/types';
import type { BookRow } from '../../../../src/types/book';
import type { EmotionListResult } from '../../../../src/features/emotion/types';

import EmotionBookRoute from '../[bookId]';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;
const mockedUseEmotionRecords = useEmotionRecords as jest.MockedFunction<typeof useEmotionRecords>;
const mockedUseCreateEmotionRecord = useCreateEmotionRecord as jest.MockedFunction<typeof useCreateEmotionRecord>;

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

const sampleLibraryItem: LibraryItem = {
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

const sampleBook: BookRow = {
  id: 'b-1',
  title: '미드나잇 라이브러리',
  author: '매트 헤이그',
  cover_url: null,
  total_pages: 400,
} as unknown as BookRow;

const emptyResult: EmotionListResult = { safe: [], spoiler: [] };

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderRoute(client: QueryClient): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <EmotionBookRoute />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReplace.mockClear();
  mockUseLocalSearchParams.mockReturnValue({ bookId: 'b-1' });
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  mockedUseLibraryItem.mockReturnValue({
    data: sampleLibraryItem,
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  mockedGetBookDetail.mockResolvedValue(sampleBook);
  mockedUseEmotionRecords.mockReturnValue({
    data: emptyResult,
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  const mutate = jest.fn();
  mockedUseCreateEmotionRecord.mockReturnValue({
    mutate,
    mutateAsync: jest.fn(),
    isPending: false,
    isIdle: true,
    isError: false,
    isSuccess: false,
    isPaused: false,
    status: 'idle',
    variables: undefined,
    data: undefined,
    error: null,
    reset: jest.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
  } as any);
});

describe('SPEC-EMOTION-001 P1-B: 감정 통합 라우트 (emotion/[bookId])', () => {
  describe('세션 가드', () => {
    it('useSession 이 null(로딩)이면 로딩 인디케이터를 렌더링한다', () => {
      mockedUseSession.mockReturnValue(null as any);
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('emotion-route-loading')).toBeTruthy();
    });

    it('미인증 시 로그인 라우트로 replace 한다', () => {
      mockedUseSession.mockReturnValue({
        ...authenticatedSession,
        session: null,
        user: null,
        isAuthenticated: false,
      } as any);
      renderRoute(createTestQueryClient());
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  describe('통합 렌더링', () => {
    it('EmotionInputScreen 을 렌더링한다', () => {
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('emotion-input-screen')).toBeTruthy();
    });

    it('TimelineScreen 을 렌더링한다 (빈 상태 testID)', () => {
      // 빈 데이터 시 timeline-empty testID 노출 (TimelineScreen 빈 상태 분기)
      const { getByTestId } = renderRoute(createTestQueryClient());
      expect(getByTestId('timeline-empty')).toBeTruthy();
    });
  });

  describe('데이터 연결', () => {
    it('useLibraryItem 의 current_page 를 currentPage 로 전달한다', () => {
      renderRoute(createTestQueryClient());
      expect(mockedUseLibraryItem).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'b-1', userId: 'u-1' }),
      );
    });

    it('getBookDetail 로 totalPages 를 조회한다', async () => {
      renderRoute(createTestQueryClient());
      await waitFor(() => {
        expect(mockedGetBookDetail).toHaveBeenCalledWith('b-1');
      });
    });

    it('useEmotionRecords 에 bookId/userId/currentPage/sort 를 전달한다', async () => {
      renderRoute(createTestQueryClient());
      await waitFor(() => {
        expect(mockedUseEmotionRecords).toHaveBeenCalledWith(
          expect.objectContaining({
            bookId: 'b-1',
            userId: 'u-1',
            currentPage: 50,
            sort: 'time',
          }),
        );
      });
    });

    it('EmotionInputScreen onSubmit 시 useCreateEmotionRecord.mutate 를 호출한다', async () => {
      const { getByPlaceholderText, getByText } = renderRoute(createTestQueryClient());
      // mutate 함수 캡처 (가장 최근 호출 결과)
      const lastResult = mockedUseCreateEmotionRecord.mock.results.at(-1);
      const mutate = (lastResult?.value as { mutate: jest.Mock }).mutate;

      fireEvent.changeText(
        getByPlaceholderText(/감정|내용|기록/),
        '멈춘 문장',
      );
      fireEvent.press(getByText('기록 저장'));

      await waitFor(() => {
        expect(mutate).toHaveBeenCalledWith(
          expect.objectContaining({
            content: '멈춘 문장',
            visibility: 'public',
          }),
        );
      });
    });

    it('sort 토글(페이지순) 시 useEmotionRecords sort 가 page 로 전달된다', async () => {
      // 타임라인이 렌더링되려면 데이터 1건 필요 — 빈 상태면 sortRow 가 안 보임.
      // 빈 상태에서는 sortRow 미노출이므로, 데이터 1건 주입 후 렌더/토글.
      mockedUseEmotionRecords.mockReturnValue({
        data: {
          safe: [
            {
              id: 'r1',
              book_id: 'b-1',
              user_id: 'u-1',
              page_number: 10,
              content: '기록',
              visibility: 'public',
              club_id: null,
              created_at: '2026-06-17T00:00:00Z',
              updated_at: null,
              users: { nickname: '독자', avatar_url: null },
              sticker_reactions: [],
            },
          ],
          spoiler: [],
        },
        isLoading: false,
        isError: false,
        error: null,
      } as any);

      const { getByText: getByText2 } = renderRoute(createTestQueryClient());
      fireEvent.press(getByText2('페이지순'));

      await waitFor(() => {
        expect(mockedUseEmotionRecords).toHaveBeenCalledWith(
          expect.objectContaining({ sort: 'page' }),
        );
      });
    });
  });
});
