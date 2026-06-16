/**
 * 탭 placeholder 셸 렌더링 테스트 — index/library/clubs/my
 * SPEC-NAV-001 — REQ-NAV-002, 인수 시나리오 T6
 * SPEC-BOOK-001 M4-7 — library 탭이 검색 진입 CTA 빈 상태로 교체됨에 따라 업데이트
 *
 * 각 탭이 헤더 타이틀을 렌더링하는지 검증.
 * library 탭은 SPEC-BOOK-001 M4-7 빈 상태("서재가 비어 있어요") + "책 검색하기" CTA 로 교체.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

// SPEC-BOOK-001 M4-7: library 탭이 router.push('/search') 를 사용하므로 mock 필요
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
}));

import HomeTab from '../index';
import LibraryTab from '../library';
import ClubsTab from '../clubs';
import MyTab from '../my';
import { ThemeProvider } from '../../../src/theme/theme';

function withTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('T6: 탭 헤더/placeholder 렌더링', () => {
  it('홈 탭이 "홈 화면" placeholder를 렌더링한다', () => {
    withTheme(<HomeTab />);
    expect(screen.getByText('홈 화면')).toBeTruthy();
  });

  it('서재 탭이 "서재" 헤더와 빈 상태 CTA "책 검색하기"를 렌더링한다', () => {
    // SPEC-BOOK-001 M4-7: placeholder → 검색 진입 빈 상태로 교체
    withTheme(<LibraryTab />);
    expect(screen.getByText('서재')).toBeTruthy();
    expect(screen.getByText('책 검색하기')).toBeTruthy();
  });

  it('모임 탭이 "모임 화면" placeholder를 렌더링한다', () => {
    withTheme(<ClubsTab />);
    expect(screen.getByText('모임 화면')).toBeTruthy();
  });

  it('마이 탭이 "마이 화면" placeholder를 렌더링한다', () => {
    withTheme(<MyTab />);
    expect(screen.getByText('마이 화면')).toBeTruthy();
  });
});
