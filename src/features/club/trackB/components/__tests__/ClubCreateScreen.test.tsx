/**
 * SPEC-CLUB-002 M4 ClubCreateScreen 컴포넌트 테스트 (모임 생성 폼)
 *
 * 검증 대상 (SPEC-UI-002 FROZEN):
 * - 헤더 타이틀 "새 모임 만들기" (fontSize 22/weight 700)
 * - 필수 필드: 모임 이름 (빈 이름 시 검증 에러)
 * - 진도 계획 입력(하루 페이지/트리거 페이지), 음수/비정수 시 검증 에러
 * - 제출 시 useCreateClub.mutate 호출
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../../theme/theme';

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
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ back: jest.fn(), replace: jest.fn() })),
}));

jest.mock('../../../../book/bookDetailApi', () => ({
  __esModule: true,
  getBookDetail: jest.fn(),
}));

jest.mock('../../hooks', () => ({
  __esModule: true,
  useCreateClub: jest.fn(),
}));

import { useCreateClub } from '../../hooks';
import { getBookDetail } from '../../../../book/bookDetailApi';
import type { BookRow } from '../../../../../types/book';
import { ClubCreateScreen } from '../ClubCreateScreen';

const useCreateClubMock = useCreateClub as jest.MockedFunction<
  typeof useCreateClub
>;
const getBookDetailMock = getBookDetail as jest.MockedFunction<
  typeof getBookDetail
>;

// issue #182: 폼 상단 책 표시용 기본 BookRow (기존 테스트와 제목 충돌 방지)
const defaultBookRow: BookRow = {
  id: 'b1',
  isbn: '0000000000',
  title: '테스트 도서',
  author: '테스트 저자',
  publisher: null,
  published_at: null,
  cover_url: null,
  total_pages: null,
  kakao_id: null,
  created_at: '2024-01-01T00:00:00Z',
};

function renderScreen(onCreated = jest.fn()) {
  return render(
    <ThemeProvider>
      <ClubCreateScreen
        userId="u1"
        bookId="b1"
        onCreated={onCreated}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useCreateClubMock.mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  } as any);
  getBookDetailMock.mockResolvedValue(defaultBookRow);
});

describe('SPEC-CLUB-002 ClubCreateScreen 헤더/레이아웃', () => {
  it('헤더 타이틀 "새 모임 만들기" 렌더링', () => {
    const { getByText } = renderScreen();
    expect(getByText('새 모임 만들기')).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubCreateScreen 검증', () => {
  it('빈 이름 시 검증 에러 표시', () => {
    const mutate = jest.fn();
    useCreateClubMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.press(getByTestId('club-create-submit'));
    expect(mutate).not.toHaveBeenCalled();
    expect(getByText('모임 이름을 입력해주세요.')).toBeTruthy();
  });

  it('하루 페이지 음수 시 검증 에러', () => {
    const mutate = jest.fn();
    useCreateClubMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId, getByText } = renderScreen();
    fireEvent.changeText(getByTestId('club-create-name'), '모임');
    fireEvent.changeText(getByTestId('club-create-daily-pages'), '-5');
    fireEvent.press(getByTestId('club-create-submit'));
    expect(mutate).not.toHaveBeenCalled();
    expect(
      getByText('하루 페이지는 0 이상의 정수여야 합니다.'),
    ).toBeTruthy();
  });
});

describe('SPEC-CLUB-002 ClubCreateScreen 제출', () => {
  it('유효 입력 시 mutate 호출', async () => {
    const mutate = jest.fn();
    useCreateClubMock.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('club-create-name'), '함께 읽는 모임');
    fireEvent.changeText(getByTestId('club-create-daily-pages'), '20');
    fireEvent.press(getByTestId('club-create-submit'));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const arg = mutate.mock.calls[0][0];
    expect(arg.name).toBe('함께 읽는 모임');
    expect(arg.dailyPages).toBe(20);
    expect(arg.bookId).toBe('b1');
    expect(arg.hostId).toBe('u1');
  });
});

describe('SPEC-CLUB-002 ClubCreateScreen 선택한 책 표시 (issue #182)', () => {
  it('bookId 로 조회한 책을 폼 상단 BookCard 로 표시', async () => {
    getBookDetailMock.mockResolvedValue({
      ...defaultBookRow,
      title: '데미안',
      author: '헤르만 헤세',
      cover_url: 'https://example.com/demian.jpg',
      total_pages: 300,
    });
    const { getByText, getByTestId } = renderScreen();
    await waitFor(() => expect(getBookDetail).toHaveBeenCalledWith('b1'));
    expect(getByText('데미안')).toBeTruthy();
    expect(getByText('헤르만 헤세')).toBeTruthy();
    expect(getByTestId('club-create-selected-book')).toBeTruthy();
  });

  it('책 로드 실패 시에도 폼 정상 렌더 (빈 폼 회귀 부재)', async () => {
    getBookDetailMock.mockRejectedValue(new Error('network error'));
    const { getByText, getByTestId } = renderScreen();
    await waitFor(() => expect(getBookDetail).toHaveBeenCalled());
    expect(getByText('새 모임 만들기')).toBeTruthy();
    expect(getByTestId('club-create-name')).toBeTruthy();
    expect(() => getByTestId('club-create-selected-book')).toThrow();
  });

  it('bookId 빈 값 가드 — getBookDetail 호출 없이 폼 렌더', () => {
    getBookDetailMock.mockClear();
    const { getByText } = render(
      <ThemeProvider>
        <ClubCreateScreen userId="u1" bookId="" onCreated={jest.fn()} />
      </ThemeProvider>,
    );
    expect(getBookDetail).not.toHaveBeenCalled();
    expect(getByText('새 모임 만들기')).toBeTruthy();
  });
});
