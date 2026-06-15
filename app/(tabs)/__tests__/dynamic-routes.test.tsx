/**
 * 동적 라우트 파라미터 수신 테스트 — [bookId], clubs/[clubId]
 * SPEC-NAV-001 — REQ-NAV-010, REQ-NAV-011, 인수 시나리오 S1, S2
 *
 * useLocalSearchParams()가 동적 라우트 파라미터를 반환하는지 검증.
 * 본 SPEC은 파라미터 수신까지만 보증 (도메인 콘텐츠는 위임).
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// useLocalSearchParams를 테스트별로 오버라이드 가능하게 팩토리에서 변수 참조
const mockSearchParams: Record<string, any> = {};
jest.mock('expo-router', () => {
  const ReactMod = require('react');
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => mockSearchParams,
    // 기타 export (라우트 파일이 미사용이더라도 안전망)
    useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) =>
      ReactMod.createElement(Text, { testID: 'redirect' }, href),
  };
});

import BookDetailRoute from '../[bookId]';
import ClubDetailRoute from '../clubs/[clubId]';

beforeEach(() => {
  for (const k of Object.keys(mockSearchParams)) delete mockSearchParams[k];
});

describe('S1: 도서 상세 [bookId] 파라미터 수신', () => {
  it('useLocalSearchParams()가 bookId를 반환하고 placeholder가 렌더링된다', () => {
    mockSearchParams.bookId = 'book-42';
    render(<BookDetailRoute />);
    // bookId가 어딘가에 표시되어야 함 (placeholder 셸)
    expect(screen.getByText(/book-42/)).toBeTruthy();
  });
});

describe('S2: 모임 상세 clubs/[clubId] 파라미터 수신', () => {
  it('useLocalSearchParams()가 clubId를 반환하고 placeholder가 렌더링된다', () => {
    mockSearchParams.clubId = 'club-7';
    render(<ClubDetailRoute />);
    expect(screen.getByText(/club-7/)).toBeTruthy();
  });
});
