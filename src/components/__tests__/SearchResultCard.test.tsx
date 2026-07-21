/**
 * SearchResultCard 컴포넌트 테스트 (SPEC-BOOK-001 M4-1, REQ-BOOK-014)
 *
 * Pencil 디자인 기준: SearchResultCard (node x8zuOu)
 * - Cover(80×110 $brand-200) + Info(Title 15/600 $text-primary, Author 12 $text-secondary,
 *   Publisher 12 $text-tertiary "출판사 · YYYY.MM")
 *
 * 시나리오 매핑:
 * - 표지/제목/저자/출판사·출판일 렌더링
 * - 저자 다수 시 쉼표 join
 * - onPress 콜백
 * - 표지 null 시 플레이스홀더
 * - accessibilityLabel
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/theme';
import { SearchResultCard, type SearchResultCardProps } from '../SearchResultCard';
import type { SearchResult } from '../../types/book';

// 헬퍼: ThemeProvider 로 감싼 렌더
function renderCard(props: SearchResultCardProps) {
  return render(
    <ThemeProvider>
      <SearchResultCard {...props} />
    </ThemeProvider>
  );
}

const baseResult: SearchResult = {
  title: '미드나잇 라이브러리',
  authors: ['매트 헤이그'],
  publisher: '다산책방',
  published_at: '2021-06-15',
  cover_url: 'https://example.com/cover.jpg',
  isbn: '9788937477029',
  kakao_id: 'kakao-1',
  total_pages: 400,
};

describe('SearchResultCard — 렌더링', () => {
  it('제목을 렌더링한다', () => {
    const { getByText } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    expect(getByText('미드나잇 라이브러리')).toBeTruthy();
  });

  it('단일 저자를 렌더링한다', () => {
    const { getByText } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    expect(getByText('매트 헤이그')).toBeTruthy();
  });

  it('저자가 다수일 때 쉼표로 join 하여 렌더링한다', () => {
    const multiAuthor: SearchResult = {
      ...baseResult,
      authors: ['매트 헤이그', '공저자'],
    };
    const { getByText } = renderCard({
      result: multiAuthor,
      onPress: jest.fn(),
    });
    expect(getByText('매트 헤이그, 공저자')).toBeTruthy();
  });

  it('출판사와 출판일을 "출판사 · YYYY.MM" 형태로 렌더링한다', () => {
    const { getByText } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    expect(getByText('다산책방 · 2021.06')).toBeTruthy();
  });

  it('출판사가 null 이면 메타에서 출판사를 생략한다', () => {
    const noPublisher: SearchResult = {
      ...baseResult,
      publisher: null,
    };
    const { getByText, queryByText } = renderCard({
      result: noPublisher,
      onPress: jest.fn(),
    });
    expect(getByText('2021.06')).toBeTruthy();
    expect(queryByText('다산책방 · 2021.06')).toBeNull();
  });

  it('출판일이 null 이면 메타에서 출판일을 생략한다', () => {
    const noDate: SearchResult = {
      ...baseResult,
      published_at: null,
    };
    const { getByText, queryByText } = renderCard({
      result: noDate,
      onPress: jest.fn(),
    });
    expect(getByText('다산책방')).toBeTruthy();
    expect(queryByText('다산책방 · ')).toBeNull();
  });

  it('출판사와 출판일이 모두 null 이면 메타 라인을 렌더링하지 않는다', () => {
    const noMeta: SearchResult = {
      ...baseResult,
      publisher: null,
      published_at: null,
    };
    const { queryByText } = renderCard({
      result: noMeta,
      onPress: jest.fn(),
    });
    // 메타 영역 자체가 미표시 — 제목/저자는 여전히 렌더링
    expect(queryByText(/·/)).toBeNull();
  });
});

describe('SearchResultCard — 표지', () => {
  it('cover_url 이 있으면 Image 를 렌더링한다', () => {
    const { queryByTestId } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    expect(queryByTestId('search-result-card-cover')).toBeTruthy();
  });

  it('cover_url 이 null 이면 플레이스홀더를 렌더링한다', () => {
    const noCover: SearchResult = {
      ...baseResult,
      cover_url: null,
    };
    const { queryByTestId } = renderCard({
      result: noCover,
      onPress: jest.fn(),
    });
    expect(queryByTestId('search-result-card-cover')).toBeNull();
    expect(queryByTestId('search-result-card-cover-placeholder')).toBeTruthy();
  });
});

describe('SearchResultCard — 상호작용', () => {
  it('카드 탭 시 onPress 가 result 와 함께 호출된다', () => {
    const onPress = jest.fn();
    const { getByTestId } = renderCard({
      result: baseResult,
      onPress,
      testID: 'result-card',
    });
    fireEvent.press(getByTestId('result-card'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith(baseResult);
  });

  it('accessibilityLabel 에 제목이 포함된다', () => {
    const { getByLabelText } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    const labeled = getByLabelText(/미드나잇 라이브러리/);
    expect(labeled).toBeTruthy();
  });

  it('accessibilityRole 가 button 이다', () => {
    const { getByLabelText } = renderCard({
      result: baseResult,
      onPress: jest.fn(),
    });
    const labeled = getByLabelText(/미드나잇 라이브러리/);
    // @ts-ignore — props 접근 (RN 컴포넌트)
    expect(labeled.props.accessibilityRole).toBe('button');
  });
});
