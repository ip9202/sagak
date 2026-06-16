/**
 * BookDetailScreen 컴포넌트 테스트 (SPEC-BOOK-001 M4-3, REQ-BOOK-015)
 *
 * 시나리오 매핑:
 * - S19: getBookDetail(bookId) 성공 → 표지/제목/저자/출판사/출판일 렌더링
 * - S20: NOT_FOUND 에러 메시지
 * - S22: useSession() loading(null) 시 ActivityIndicator, 미인증 시 onRequireAuth 콜백
 * - 로딩 상태
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { BookDetailScreen, type BookDetailScreenProps } from '../BookDetailScreen';
import type { BookRow } from '../../../types/book';
import { AppError } from '../../../errors';

// useSession mock — 각 테스트에서 반환값 오버라이드
jest.mock('../../../auth/useSession', () => ({
  useSession: jest.fn(),
}));

// bookDetailApi mock
jest.mock('../bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

import { useSession } from '../../../auth/useSession';
import { getBookDetail } from '../bookDetailApi';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;

// 헬퍼: ThemeProvider + 인증된 세션으로 감싼 렌더
function renderScreen(props: BookDetailScreenProps) {
  return render(
    <ThemeProvider>
      <BookDetailScreen {...props} />
    </ThemeProvider>
  );
}

const sampleBook: BookRow = {
  id: 'book-uuid-1',
  isbn: '9788937477029',
  title: '미드나잇 라이브러리',
  author: '매트 헤이그',
  publisher: '다산책방',
  published_at: '2021-06-15',
  cover_url: 'https://example.com/cover.jpg',
  total_pages: 400,
  kakao_id: 'kakao-1',
  created_at: '2024-01-01T00:00:00Z',
};

// 인증된 세션 응답 객체
const authenticatedSession = {
  session: { access_token: 'token', user: { id: 'u1' } },
  user: { id: 'u1' },
  profile: { id: 'u1', nickname: '독자' },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  // 기본: 인증된 세션
  mockedUseSession.mockReturnValue(authenticatedSession as any);
});

describe('BookDetailScreen — S22: 세션 가드', () => {
  it('useSession 이 null(loading) 일 때 ActivityIndicator 를 표시한다', () => {
    mockedUseSession.mockReturnValue(null);
    const { getByTestId } = renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    expect(getByTestId('book-detail-loading')).toBeTruthy();
  });

  it('loading 중에는 getBookDetail 을 호출하지 않는다', () => {
    mockedUseSession.mockReturnValue(null);
    renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    expect(mockedGetBookDetail).not.toHaveBeenCalled();
  });

  it('미인증 시 onRequireAuth 콜백을 호출한다', () => {
    mockedUseSession.mockReturnValue({
      ...authenticatedSession,
      session: null,
      user: null,
      isAuthenticated: false,
    } as any);
    const onRequireAuth = jest.fn();
    renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth,
    });
    expect(onRequireAuth).toHaveBeenCalledTimes(1);
  });
});

describe('BookDetailScreen — S19: 상세 조회 성공', () => {
  it('getBookDetail 성공 시 제목을 렌더링한다', async () => {
    mockedGetBookDetail.mockResolvedValueOnce(sampleBook);
    const { getByText } = renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByText('미드나잇 라이브러리')).toBeTruthy();
    });
  });

  it('getBookDetail 성공 시 저자를 렌더링한다', async () => {
    mockedGetBookDetail.mockResolvedValueOnce(sampleBook);
    const { getByText } = renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByText('매트 헤이그')).toBeTruthy();
    });
  });

  it('getBookDetail 성공 시 출판사·출판일을 렌더링한다', async () => {
    mockedGetBookDetail.mockResolvedValueOnce(sampleBook);
    const { getByText } = renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByText(/다산책방/)).toBeTruthy();
    });
  });

  it('bookId 를 인자로 getBookDetail 을 호출한다', async () => {
    mockedGetBookDetail.mockResolvedValueOnce(sampleBook);
    renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(mockedGetBookDetail).toHaveBeenCalledWith('book-uuid-1');
    });
  });
});

describe('BookDetailScreen — S20: NOT_FOUND 에러', () => {
  it('NOT_FOUND 에러 시 에러 메시지를 표시한다', async () => {
    const notFoundError = new AppError(
      '책을 찾을 수 없습니다',
      'NOT_FOUND',
      404
    );
    notFoundError.category = 'NOT_FOUND';
    mockedGetBookDetail.mockRejectedValueOnce(notFoundError);
    const { getByText } = renderScreen({
      bookId: 'missing-id',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByText(/찾을 수 없습니다/)).toBeTruthy();
    });
  });
});

describe('BookDetailScreen — S22 엣지: RLS_DENIED 에러', () => {
  it('RLS_DENIED 에러 시 "접근 권한이 없습니다" 메시지를 표시한다', async () => {
    const rlsError = new AppError(
      '행 수준 보안 정책에 의해 차단되었습니다',
      'RLS_DENIED',
      403
    );
    rlsError.category = 'RLS_DENIED';
    mockedGetBookDetail.mockRejectedValueOnce(rlsError);
    const { getByText } = renderScreen({
      bookId: 'forbidden-id',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByText(/접근 권한이 없습니다/)).toBeTruthy();
    });
  });
});

describe('BookDetailScreen — 로딩 상태', () => {
  it('getBookDetail 진행 중 ActivityIndicator 를 표시한다', async () => {
    // 결코 resolve 되지 않음 — 로딩 상태 유지
    mockedGetBookDetail.mockReturnValueOnce(new Promise(() => {}));
    const { getByTestId } = renderScreen({
      bookId: 'book-uuid-1',
      onRequireAuth: jest.fn(),
    });
    await waitFor(() => {
      expect(getByTestId('book-detail-loading')).toBeTruthy();
    });
  });
});
