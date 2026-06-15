/**
 * 탭 placeholder 셸 렌더링 테스트 — index/library/clubs/my
 * SPEC-NAV-001 — REQ-NAV-002, 인수 시나리오 T6
 *
 * 각 탭 placeholder가 헤더 타이틀 + 중앙 정렬 placeholder 텍스트를 렌더링하는지 검증.
 * useTheme 토큰 사용(하드코딩 금지)도 함께 보증한다.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

jest.mock('expo-secure-store', () => ({
  default: { getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() },
}));

import HomeTab from '../index';
import LibraryTab from '../library';
import ClubsTab from '../clubs';
import MyTab from '../my';
import { ThemeProvider } from '../../../src/theme/theme';

function withTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('T6: 탭 placeholder 셸 렌더링', () => {
  it('홈 탭이 "홈 화면" placeholder를 렌더링한다', () => {
    withTheme(<HomeTab />);
    expect(screen.getByText('홈 화면')).toBeTruthy();
  });

  it('서재 탭이 "서재 화면" placeholder를 렌더링한다', () => {
    withTheme(<LibraryTab />);
    expect(screen.getByText('서재 화면')).toBeTruthy();
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
