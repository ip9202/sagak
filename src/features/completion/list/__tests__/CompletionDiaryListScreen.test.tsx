/**
 * CompletionDiaryListScreen 통합 테스트 (SPEC-COMPLETION-002, REQ-COMP2-003~007/014/015/016)
 *
 * 검증 대상 (시나리오 1, 5, 6, 7, 15, 16, 17):
 * - StatusBar + Header("완독 다이어리", 22/700) + Content 3계층 렌더
 * - SummaryStat "지금까지 N권 완독" (비경쟁 — 좋아요/팔로워/랭킹 없음, REQ-COMP2-004/016)
 * - populated list: N개 DiaryCard + summary
 * - 빈 상태: EmptyState (sparkles, "완독한 책이 아직 없어요", "첫 책을 끝까지 읽어보세요", CTA "읽으러 가기")
 * - 빈 상태 CTA 탭 → 서재 라우트 이동
 * - 에러 상태: 에러 메시지 + 재시도 버튼
 * - 로딩 상태: ActivityIndicator (Header 유지)
 * - 카드 탭 → /completion/{bookId} 네비게이션
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

jest.mock('../useCompletionDiaryList', () => ({
  useCompletionDiaryList: jest.fn(),
}));

import { CompletionDiaryListScreen } from '../CompletionDiaryListScreen';
import { useCompletionDiaryList } from '../useCompletionDiaryList';

const mockedUseList = useCompletionDiaryList as jest.MockedFunction<
  typeof useCompletionDiaryList
>;

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

function withProviders(ui: React.ReactElement) {
  const client = createClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

const SAMPLE = [
  {
    userBookId: 'ub-1',
    bookId: 'b-1',
    title: '데미안',
    author: '헤르만 헤세',
    coverUrl: null,
    completedAt: '2026-06-20T00:00:00Z',
    totalRecords: 12,
    recentHighlight: '테스트 하이라이트',
  },
  {
    userBookId: 'ub-2',
    bookId: 'b-2',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    coverUrl: null,
    completedAt: '2026-05-20T00:00:00Z',
    totalRecords: 8,
    recentHighlight: null,
  },
];

describe('SPEC-COMPLETION-002: CompletionDiaryListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('시나리오 1/5: populated list — summary "지금까지 2권 완독" + 2개 카드', async () => {
    mockedUseList.mockReturnValue({
      data: SAMPLE,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText, getAllByTestId, getByTestId } = withProviders(
      <CompletionDiaryListScreen />,
    );

    expect(getByText('완독 다이어리')).toBeTruthy();
    expect(getByText(/지금까지 2권 완독/)).toBeTruthy();
    expect(getAllByTestId('diary-card')).toHaveLength(2);
    // Header 유지 (testID screen 루트)
    expect(getByTestId('completion-list-screen')).toBeTruthy();
  });

  it('시나리오 17: 비경쟁 원칙 — 좋아요/팔로워/랭킹 문자열이 화면에 없다', () => {
    mockedUseList.mockReturnValue({
      data: SAMPLE,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { toJSON } = withProviders(<CompletionDiaryListScreen />);
    const json = JSON.stringify(toJSON());
    expect(json).not.toContain('좋아요');
    expect(json).not.toContain('팔로워');
    expect(json).not.toContain('랭킹');
  });

  it('시나리오 6: 빈 상태 — EmptyState + CTA "읽으러 가기"', () => {
    mockedUseList.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: true,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = withProviders(<CompletionDiaryListScreen />);
    expect(getByText('완독한 책이 아직 없어요')).toBeTruthy();
    expect(getByText('첫 책을 끝까지 읽어보세요')).toBeTruthy();
    expect(getByText('읽으러 가기')).toBeTruthy();
  });

  it('시나리오 6: 빈 상태 CTA 탭 → 서재 라우트로 네비게이션', () => {
    mockedUseList.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: true,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText } = withProviders(<CompletionDiaryListScreen />);
    fireEvent.press(getByText('읽으러 가기'));
    expect(mockPush).toHaveBeenCalled();
    const arg = mockPush.mock.calls[0][0];
    expect(arg).toMatch(/library/);
  });

  it('시나리오 15: 에러 상태 — 에러 메시지 + 재시도 버튼', () => {
    mockedUseList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      isEmpty: false,
      error: new Error('network'),
      refetch: jest.fn(),
    } as any);

    const { getByText } = withProviders(<CompletionDiaryListScreen />);
    expect(getByText(/다시/)).toBeTruthy(); // 재시도 버튼
  });

  it('시나리오 15: 재시도 버튼 탭 → refetch 호출', () => {
    const refetch = jest.fn().mockResolvedValue(undefined);
    mockedUseList.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isSuccess: false,
      isEmpty: false,
      error: new Error('network'),
      refetch,
    } as any);

    const { getByText } = withProviders(<CompletionDiaryListScreen />);
    fireEvent.press(getByText(/다시/));
    expect(refetch).toHaveBeenCalled();
  });

  it('로딩 상태 — ActivityIndicator + Header 유지', () => {
    mockedUseList.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isSuccess: false,
      isEmpty: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getByText, getByTestId } = withProviders(<CompletionDiaryListScreen />);
    expect(getByText('완독 다이어리')).toBeTruthy(); // Header 유지
    expect(getByTestId('completion-list-loading')).toBeTruthy();
  });

  it('시나리오 7: 카드 탭 → /completion/{bookId} 네비게이션', () => {
    mockedUseList.mockReturnValue({
      data: SAMPLE,
      isLoading: false,
      isError: false,
      isSuccess: true,
      isEmpty: false,
      error: null,
      refetch: jest.fn(),
    } as any);

    const { getAllByTestId } = withProviders(<CompletionDiaryListScreen />);
    const cards = getAllByTestId('diary-card');
    fireEvent.press(cards[0]);
    expect(mockPush).toHaveBeenCalledWith('/completion/b-1');
  });
});
