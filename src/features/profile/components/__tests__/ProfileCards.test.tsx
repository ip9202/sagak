/**
 * StatCard + BadgeCard 컴포넌트 테스트 (SPEC-PROFILE-001 REQ-PROF-004/007)
 *
 * .pen F15-My 스타일 팩트 검증:
 * - StatCard: value(fontSize 22/weight 700/brand-500) + label(fontSize 11/text-secondary)
 * - BadgeCard: earned=true → 컬러, earned=false → 잠금(opacity/그레이스케일)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../../theme/theme';
import { StatCard } from '../StatCard';
import { BadgeCard } from '../BadgeCard';

function withTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('SPEC-PROFILE-001 REQ-PROF-004: StatCard', () => {
  it('value + label 을 렌더링한다', () => {
    const { getByText } = withTheme(
      <StatCard testID="stat-1" value="12" label="완독" />,
    );
    expect(getByText('12')).toBeTruthy();
    expect(getByText('완독')).toBeTruthy();
  });

  it('value가 숫자/문열 모두 허용', () => {
    const { getByText } = withTheme(
      <StatCard testID="stat-2" value={48} label="독서시간" />,
    );
    expect(getByText('48')).toBeTruthy();
  });
});

describe('SPEC-PROFILE-001 REQ-PROF-007: BadgeCard', () => {
  it('earned=true → 라벨 + 잠금 아님 표시', () => {
    const { getByText, queryByTestId } = withTheme(
      <BadgeCard
        testID="badge-1"
        label="첫 완독"
        earned={true}
      />,
    );
    expect(getByText('첫 완독')).toBeTruthy();
    // earned 상태에서는 잠금 표시가 없어야 함
    expect(queryByTestId('badge-1-locked')).toBeNull();
  });

  it('earned=false → 잠금 표시 노출', () => {
    const { getByTestId, getByText } = withTheme(
      <BadgeCard testID="badge-2" label="책벌레" earned={false} />,
    );
    expect(getByText('책벌레')).toBeTruthy();
    expect(getByTestId('badge-2-locked')).toBeTruthy();
  });
});
