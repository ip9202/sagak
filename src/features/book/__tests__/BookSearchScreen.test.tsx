/**
 * BookSearchScreen 컴포넌트 테스트 (SPEC-BOOK-001 M4-2, REQ-BOOK-005, REQ-BOOK-016)
 *
 * 시나리오 매핑:
 * - S5 / REQ-BOOK-005: 빈 쿼리 제출 시 VALIDATION 에러 메시지, searchBooks 호출 안 됨
 * - S21: 빈 결과 "도서를 찾을 수 없습니다" + 수동 입력 유도
 * - 로딩/에러/결과 상태 UI
 * - ScanButton 탭 → onNavigateScan 콜백
 * - 결과 카드 탭 → onSelectBook(result) 콜백
 *
 * Pencil 디자인 기준: F06-Search (node E44G9).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { BookSearchScreen, type BookSearchScreenProps } from '../BookSearchScreen';
import type { SearchResult } from '../../../types/book';

// searchApi 모듈 mock — 각 테스트에서 mockResolvedValueOnce/mockRejectedValueOnce 로 오버라이드.
// 컴포넌트가 빈/공백 쿼리를 선제 차단하므로(REQ-BOOK-005) mock 은 유효 쿼리 경로만 처리.
jest.mock('../searchApi', () => ({
  searchBooks: jest.fn(async () => []),
}));

// 모듈 가져오기 (mock 적용 후)
import { searchBooks } from '../searchApi';
const mockedSearchBooks = searchBooks as jest.MockedFunction<typeof searchBooks>;

// 헬퍼: ThemeProvider 로 감싼 렌더
function renderScreen(props: BookSearchScreenProps) {
  return render(
    <ThemeProvider>
      <BookSearchScreen {...props} />
    </ThemeProvider>
  );
}

const sampleResults: SearchResult[] = [
  {
    title: '미드나잇 라이브러리',
    authors: ['매트 헤이그'],
    publisher: '다산책방',
    published_at: '2021-06-15',
    cover_url: 'https://example.com/1.jpg',
    isbn: '9788937477029',
    kakao_id: 'k-1',
    total_pages: 400,
  },
  {
    title: '코스모스',
    authors: ['칼 세이건'],
    publisher: '사이언스북스',
    published_at: '2006-12-01',
    cover_url: null,
    isbn: '9788937477030',
    kakao_id: 'k-2',
    total_pages: 500,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BookSearchScreen — REQ-BOOK-005 (S5): 빈 쿼리 검증', () => {
  it('빈 쿼리 제출 시 VALIDATION 에러 메시지를 표시한다', async () => {
    const { getByTestId, getByText } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    // 빈 쿼리로 검색 제출
    fireEvent.press(getByTestId('search-submit-button'));
    // 에러 메시지 노출 대기
    await waitFor(() => {
      expect(getByText(/검색어를 입력/)).toBeTruthy();
    });
  });

  it('빈 쿼리 제출 시 searchBooks 를 호출하지 않는다', async () => {
    const { getByTestId } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(mockedSearchBooks).not.toHaveBeenCalled();
    });
  });

  it('공백만 있는 쿼리도 VALIDATION 에러를 표시한다', async () => {
    const { getByTestId, getByText } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    // 입력 필드에 공백 입력 후 제출
    fireEvent.changeText(getByTestId('search-input'), '   ');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByText(/검색어를 입력/)).toBeTruthy();
    });
    expect(mockedSearchBooks).not.toHaveBeenCalled();
  });
});

describe('BookSearchScreen — 검색 결과 상태', () => {
  it('유효 쿼리 제출 시 searchBooks 를 호출한다', async () => {
    mockedSearchBooks.mockResolvedValueOnce(sampleResults);
    const { getByTestId } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.changeText(getByTestId('search-input'), '미드나잇');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(mockedSearchBooks).toHaveBeenCalledWith('미드나잇', 'title');
    });
  });

  it('검색 성공 시 결과 카드들을 렌더링한다', async () => {
    mockedSearchBooks.mockResolvedValueOnce(sampleResults);
    const { getByTestId, getByText } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.changeText(getByTestId('search-input'), '미드나잇');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByText('미드나잇 라이브러리')).toBeTruthy();
    });
    expect(getByText('코스모스')).toBeTruthy();
  });

  it('검색 중 로딩 상태를 표시한다', async () => {
    // 결코 resolve 되지 않는 Promise — 로딩 상태 유지
    mockedSearchBooks.mockReturnValueOnce(new Promise(() => {}));
    const { getByTestId } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.changeText(getByTestId('search-input'), '테스트');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByTestId('search-loading')).toBeTruthy();
    });
  });

  it('검색 실패 시 에러 메시지를 표시한다', async () => {
    mockedSearchBooks.mockRejectedValueOnce(new Error('네트워크 오류'));
    const { getByTestId, getByText } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.changeText(getByTestId('search-input'), '테스트');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByText(/오류|실패|에러/)).toBeTruthy();
    });
  });
});

describe('BookSearchScreen — S21: 빈 결과', () => {
  it('빈 결과 시 "도서를 찾을 수 없습니다" 메시지를 표시한다', async () => {
    mockedSearchBooks.mockResolvedValueOnce([]);
    const { getByTestId, getByText } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    fireEvent.changeText(getByTestId('search-input'), '존재하지않는책');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByText(/도서를 찾을 수 없습니다/)).toBeTruthy();
    });
  });
});

describe('BookSearchScreen — ScanButton', () => {
  it('ScanButton 탭 시 onNavigateScan 을 호출한다', () => {
    const onNavigateScan = jest.fn();
    const { getByTestId } = renderScreen({
      onNavigateScan,
      onSelectBook: jest.fn(),
    });
    fireEvent.press(getByTestId('search-scan-button'));
    expect(onNavigateScan).toHaveBeenCalledTimes(1);
  });
});

describe('BookSearchScreen — S13: 스캔 후 자동 ISBN 검색', () => {
  it('initialQuery + initialTarget prop 전달 시 검색 버튼 press 없이 searchBooks 를 자동 호출한다', async () => {
    // SPEC-BOOK-001 S13: 바코드 스캔 → router.replace 로 initialQuery(ISBN), initialTarget('isbn') 전달
    // 사용자가 검색 버튼을 누르기 전에 자동 검색이 실행되어야 함 (프리즈 방지)
    mockedSearchBooks.mockResolvedValueOnce([]);
    const { getByTestId } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
      initialQuery: '9788932917245',
      initialTarget: 'isbn',
    });

    // 검색 버튼 press 없이 자동 호출 대기
    await waitFor(() => {
      expect(mockedSearchBooks).toHaveBeenCalledWith('9788932917245', 'isbn');
    });

    // 입력 필드에도 ISBN 이 채워져 있어야 함
    expect(getByTestId('search-input').props.value).toBe('9788932917245');
  });

  it('initialQuery 가 비어 있을 때 자동 검색을 호출하지 않는다', async () => {
    // 기본 진입(직접 탭 이동) 시 자동 검색 실행 X — 빈 쿼리 검증(S5)과 일관성
    renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
    });
    // 자동 검색이 비활성화되어 있는지 약간 대기 후 확인
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockedSearchBooks).not.toHaveBeenCalled();
  });

  it('자동 검색은 1회만 실행된다 (중복/무한 호출 방지)', async () => {
    // ref 가드가 없으면 query/target 변경 시 effect 재실행으로 중복 호출 가능
    mockedSearchBooks.mockResolvedValue([]);
    renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook: jest.fn(),
      initialQuery: '9788932917245',
      initialTarget: 'isbn',
    });

    // 첫 자동 검색 대기
    await waitFor(() => {
      expect(mockedSearchBooks).toHaveBeenCalledTimes(1);
    });

    // 충분한 시간 대기 후에도 1회만 호출되었는지 확인 (무한 루프/중복 방지)
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockedSearchBooks).toHaveBeenCalledTimes(1);
  });
});

describe('BookSearchScreen — 결과 카드 선택', () => {
  it('결과 카드 탭 시 onSelectBook(result) 을 호출한다', async () => {
    mockedSearchBooks.mockResolvedValueOnce(sampleResults);
    const onSelectBook = jest.fn();
    const { getByTestId } = renderScreen({
      onNavigateScan: jest.fn(),
      onSelectBook,
    });
    fireEvent.changeText(getByTestId('search-input'), '미드나잇');
    fireEvent.press(getByTestId('search-submit-button'));
    await waitFor(() => {
      expect(getByTestId('search-result-card-0')).toBeTruthy();
    });
    fireEvent.press(getByTestId('search-result-card-0'));
    expect(onSelectBook).toHaveBeenCalledTimes(1);
    expect(onSelectBook).toHaveBeenCalledWith(sampleResults[0]);
  });
});
