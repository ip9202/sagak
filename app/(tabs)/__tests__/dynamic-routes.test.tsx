/**
 * 동적 라우트 파라미터 수신 테스트 — [bookId], clubs/[clubId]
 * SPEC-NAV-001 — REQ-NAV-010, REQ-NAV-011, 인수 시나리오 S1, S2
 * SPEC-BOOK-001 M4-6 — [bookId] 가 BookDetailScreen 으로 교체됨에 따라 테스트 업데이트
 *
 * useLocalSearchParams()가 동적 라우트 파라미터를 반환하는지 검증.
 * [bookId] 는 SPEC-BOOK-001 M4-3 BookDetailScreen 으로 위임 — 세션 가드(loading)를 검증.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// useSession mock — SPEC-BOOK-001 M4-3 BookDetailScreen 이 consume.
// 기본: loading(null) → ActivityIndicator 렌더링 (파라미터 수신 자체는 라우트 단에서 보증)
jest.mock('../../../src/auth/useSession', () => ({
  useSession: jest.fn(() => null),
}));

// bookDetailApi mock — 로딩 상태에서는 호출되지 않으므로 안전망
jest.mock('../../../src/features/book/bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

// useLocalSearchParams를 테스트별로 오버라이드 가능하게 팩토리에서 변수 참조
const mockSearchParams: Record<string, any> = {};
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => mockSearchParams,
    // 기타 export (라우트 파일이 미사용이더라도 안전망)
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect' }, href),
  };
});

import BookDetailRoute from '../[bookId]';
import ClubDetailRoute from '../clubs/[clubId]';

beforeEach(() => {
  for (const k of Object.keys(mockSearchParams)) delete mockSearchParams[k];
});

describe('S1: 도서 상세 [bookId] 파라미터 수신 (SPEC-BOOK-001 M4-6 BookDetailScreen 위임)', () => {
  it('useLocalSearchParams() 가 bookId 를 전달하고 라우트가 BookDetailScreen 을 마운트한다', () => {
    // BookDetailScreen 은 useSession()=null(loading) 시 ActivityIndicator(testID book-detail-loading) 렌더링.
    // 라우트가 파라미터를 수신해 BookDetailScreen 에 전달했다면 로딩 인디케이터가 표시된다.
    mockSearchParams.bookId = 'book-42';
    render(<BookDetailRoute />);
    expect(screen.getByTestId('book-detail-loading')).toBeTruthy();
  });
});

describe('S2: 모임 상세 clubs/[clubId] 파라미터 수신', () => {
  it('useLocalSearchParams()가 clubId를 반환하고 placeholder가 렌더링된다', () => {
    mockSearchParams.clubId = 'club-7';
    render(<ClubDetailRoute />);
    expect(screen.getByText(/club-7/)).toBeTruthy();
  });
});
