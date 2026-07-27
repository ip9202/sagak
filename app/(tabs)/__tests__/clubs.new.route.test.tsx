/**
 * clubs/new 라우트 통합 테스트 — SPEC-CLUB-004 M4 회귀 게이트
 *
 * 검증 대상:
 * - AC-030: bookId 주어지면 ClubCreateScreen 렌더링 (SPEC-CLUB-002 회귀 유지)
 * - AC-001: bookId 없으면 BookSelectionHub 렌더링
 * - AC-011: 허브 onSelectBook → router.replace({pathname:'/clubs/new', params:{bookId}})
 * - AC-032: clubs.tsx 진입점은 본 라우트로 연결 (wiring 회귀 — clubs.tsx 미변경)
 *
 * 전략: ClubCreateScreen / BookSelectionHub 을 thin mock 하여 라우트 분기 로직만 검증.
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// router.replace 추적
const mockReplace = jest.fn();
// useLocalSearchParams 가 반환할 params (테스트별로 제어)
let mockParams: { bookId?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

// useSession mock
jest.mock('../../../src/auth/useSession', () => ({
  useSession: () => ({ user: { id: 'u1' } }),
}));

// 네이티브 모듈 mock
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

// BookSelectionHub thin mock — onSelectBook 콜백 노출
jest.mock('../../../src/features/club/trackB/components/BookSelectionHub', () => {
  const ReactMod = require('react');
  const { View, Text, Pressable } = require('react-native');
  return {
    BookSelectionHub: ({
      onSelectBook,
    }: {
      onSelectBook: (bookId: string) => void;
    }) =>
      ReactMod.createElement(
        View,
        { testID: 'mock-hub' },
        ReactMod.createElement(Text, null, 'mock-hub'),
        ReactMod.createElement(
          Pressable,
          {
            testID: 'mock-hub-select',
            onPress: () => onSelectBook('selected-book-id'),
          },
          ReactMod.createElement(Text, null, 'select'),
        ),
      ),
  };
});

// ClubCreateScreen thin mock — bookId 표시
jest.mock('../../../src/features/club/trackB/components/ClubCreateScreen', () => {
  const ReactMod = require('react');
  const { View, Text } = require('react-native');
  return {
    ClubCreateScreen: ({ bookId }: { bookId: string }) =>
      ReactMod.createElement(
        View,
        { testID: 'mock-club-create' },
        ReactMod.createElement(Text, null, `bookId=${bookId}`),
      ),
  };
});

import ClubCreateRoute from '../clubs/new';

describe('SPEC-CLUB-004 M4: clubs/new 라우트 회귀', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('AC-030: bookId 가 주어지면 ClubCreateScreen 을 렌더링한다 (SPEC-CLUB-002 회귀 유지)', () => {
    mockParams = { bookId: 'book-42' };
    const { getByTestId, getByText } = render(<ClubCreateRoute />);

    expect(getByTestId('mock-club-create')).toBeTruthy();
    expect(getByText('bookId=book-42')).toBeTruthy();
  });

  it('AC-001: bookId 가 없으면 BookSelectionHub 를 렌더링한다', () => {
    mockParams = {};
    const { getByTestId, queryByTestId } = render(<ClubCreateRoute />);

    expect(getByTestId('mock-hub')).toBeTruthy();
    // 기존 "책 검색하기" 게이트 CTA 가 아닌 허브가 렌더되는지 확인
    expect(queryByTestId('mock-club-create')).toBeNull();
  });

  it('AC-011: 허브 onSelectBook 이 router.replace 로 /clubs/new?bookId= 를 갱신한다', () => {
    mockParams = {};
    const { getByTestId } = render(<ClubCreateRoute />);

    fireEvent.press(getByTestId('mock-hub-select'));

    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/clubs/new',
      params: { bookId: 'selected-book-id' },
    });
  });

  it('AC-002: 기존 "책 검색하기" 단일 CTA(testID club-new-search) 가 라우트에 존재하지 않는다', () => {
    mockParams = {};
    const { queryByTestId } = render(<ClubCreateRoute />);

    expect(queryByTestId('club-new-search')).toBeNull();
  });
});
