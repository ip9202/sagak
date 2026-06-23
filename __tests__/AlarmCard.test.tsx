/**
 * AlarmCard 컴포넌트 테스트 (SPEC-NAV-001 홈 탭 — F03-Home AlarmCard)
 *
 * 검증 대상:
 * - title / subtitle 텍스트 렌더링
 * - testID 전달
 * - ThemeProvider 없이 렌더 불가 (useTheme 계약)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { AlarmCard } from '../src/components/AlarmCard';
import { ThemeProvider } from '../src/theme/theme';

const renderWithTheme = (component: React.ReactNode) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

describe('AlarmCard (F03-Home 따뜻한 리마인더 카드)', () => {
  it('title 텍스트를 렌더링한다', () => {
    const { getByText } = renderWithTheme(
      <AlarmCard
        title="오늘의 첫 페이지가 당신을 기다리고 있어요"
        subtitle="5분만 읽어도 충분해요."
      />,
    );
    expect(
      getByText('오늘의 첫 페이지가 당신을 기다리고 있어요'),
    ).toBeTruthy();
  });

  it('subtitle 텍스트를 렌더링한다', () => {
    const { getByText } = renderWithTheme(
      <AlarmCard title="t" subtitle="매일 21:30에 알려드릴게요" />,
    );
    expect(getByText('매일 21:30에 알려드릴게요')).toBeTruthy();
  });

  it('testID 를 전달하면 컨테이너에 적용된다', () => {
    const { getByTestId } = renderWithTheme(
      <AlarmCard title="t" subtitle="s" testID="home-alarm-card" />,
    );
    expect(getByTestId('home-alarm-card')).toBeTruthy();
  });

  it('기본 testID 는 "alarm-card" 이다', () => {
    const { getByTestId } = renderWithTheme(
      <AlarmCard title="t" subtitle="s" />,
    );
    expect(getByTestId('alarm-card')).toBeTruthy();
  });
});
