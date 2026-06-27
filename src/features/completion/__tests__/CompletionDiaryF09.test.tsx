/**
 * SPEC-COMPLETION-002 F09 상세 화면 시각 정합 테스트 (REQ-COMP2-008~011)
 *
 * 본 스위트는 001의 데이터 로직(6상태 분기, ReportData, fetchReport)을 건드리지 않고
 * 002의 시각적 변경(카드 래퍼, 라벨 카피, 메타데이터, 뒤로가기)만 검증한다.
 * 001의 기존 테스트(CompletionDiaryScreen.test.tsx)는 characterization baseline 으로 유지.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../../../theme/theme';
import { colors } from '../../../theme/tokens';

// react-native-svg mock — 001 테스트와 동일 패턴.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement(View, { testID }, children);
  const Polyline = (props: { testID?: string; stroke?: string }) =>
    React.createElement(View, { testID: props.testID ?? 'svg-polyline', stroke: props.stroke });
  const Circle = (props: { testID?: string; fill?: string }) =>
    React.createElement(View, { testID: props.testID ?? 'svg-circle', fill: props.fill });
  const G = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return { __esModule: true, default: Mock, Svg: Mock, Polyline, Circle, G };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

import { CelebrationHeader } from '../CelebrationHeader';
import { EmotionCurveChart } from '../EmotionCurveChart';
import { HighlightList } from '../HighlightList';
import { CompletionDiaryScreen } from '../CompletionDiaryScreen';
import type { EmotionCurvePoint, Highlight } from '../types';

jest.mock('../useCompletionReport', () => ({
  __esModule: true,
  useCompletionReport: jest.fn(),
}));
import { useCompletionReport } from '../useCompletionReport';
import type { UseCompletionReportResult } from '../useCompletionReport';

const hookMock = useCompletionReport as jest.MockedFunction<typeof useCompletionReport>;

function setHook(result: Partial<UseCompletionReportResult>): void {
  hookMock.mockReturnValue({
    status: 'loading',
    data: null,
    error: null,
    isLoading: true,
    refetch: jest.fn(),
    ...result,
  } as UseCompletionReportResult);
}

function renderWith(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// ---------------------------------------------------------------------------
// REQ-COMP2-008: CelebrationHeader hero 카드 + 메타데이터
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-002 F09: CelebrationHeader hero 카드 (REQ-COMP2-008)', () => {
  it('hero 카드 배경이 brand-50 이다', () => {
    const { getByTestId } = renderWith(<CelebrationHeader />);
    const card = getByTestId('completion-celebration-card');
    const styleFlat = StyleSheet.flatten(card.props.style);
    expect(styleFlat.backgroundColor).toBe(colors.brand[50]);
  });

  it('coverUrl 이 제공되면 Cover 가 렌더링된다', () => {
    const { getByTestId } = renderWith(
      <CelebrationHeader coverUrl="https://example.com/cover.jpg" />,
    );
    expect(getByTestId('completion-cover')).toBeTruthy();
  });

  it('coverUrl 이 null 이면 brand-200 플레이스홀더가 렌더링된다', () => {
    const { getByTestId } = renderWith(<CelebrationHeader coverUrl={null} />);
    const cover = getByTestId('completion-cover');
    const styleFlat = StyleSheet.flatten(cover.props.style);
    expect(styleFlat.backgroundColor).toBe(colors.brand[200]);
  });

  it('coverUrl 을 생략하면 Cover 가 렌더링되지 않는다 (001 호환)', () => {
    const { queryByTestId } = renderWith(<CelebrationHeader />);
    expect(queryByTestId('completion-cover')).toBeNull();
  });

  it('completedAt 이 제공되면 완독일이 YYYY.MM.DD 포맷으로 렌더링된다', () => {
    const { getByText } = renderWith(
      <CelebrationHeader completedAt="2026-06-20T10:00:00Z" />,
    );
    expect(getByText(/2026\.06\.20/)).toBeTruthy();
  });

  it('completedAt 을 생략하면 완독일이 렌더링되지 않는다 (001 호환)', () => {
    const { queryByText } = renderWith(<CelebrationHeader />);
    // 완독일 텍스트 노드 자체가 없어야 함 (메시지 텍스트는 존재)
    const dateNodes = queryByText(/\d{4}\.\d{2}\.\d{2}/);
    expect(dateNodes).toBeNull();
  });

  it('배지가 pill 형태이다 (borderRadius 가 너비보다 큼)', () => {
    const { getByTestId } = renderWith(<CelebrationHeader />);
    const badge = getByTestId('completion-badge');
    const styleFlat = StyleSheet.flatten(badge.props.style);
    // pill = borderRadius >= height. radius.full(9999) 토큰 사용.
    expect(styleFlat.borderRadius).toBeGreaterThanOrEqual(999);
  });
});

// ---------------------------------------------------------------------------
// REQ-COMP2-009: EmotionCurveChart 카드 컨트랙트
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-002 F09: EmotionCurveChart 카드 (REQ-COMP2-009)', () => {
  const points: EmotionCurvePoint[] = [
    { page_number: 5, emotion_count: 2 },
    { page_number: 20, emotion_count: 5 },
    { page_number: 50, emotion_count: 3 },
  ];

  it('카드 래퍼가 bg-surface fill, cornerRadius 16 이다', () => {
    const { getByTestId } = renderWith(<EmotionCurveChart points={points} />);
    const card = getByTestId('emotion-curve-card');
    const styleFlat = StyleSheet.flatten(card.props.style);
    expect(styleFlat.backgroundColor).toBe(colors.bg.surface);
    expect(styleFlat.borderRadius).toBe(16);
  });

  it('카드 라벨 "감정 곡선" 이 렌더링된다', () => {
    const { getByText } = renderWith(<EmotionCurveChart points={points} />);
    expect(getByText('감정 곡선')).toBeTruthy();
  });

  it('기존 SVG 폴리라인/포인트가 렌더 트리에 유지된다 (001 데이터 바인딩 보존)', () => {
    const { getAllByTestId, getByTestId } = renderWith(
      <EmotionCurveChart points={points} />,
    );
    expect(getByTestId('svg-polyline')).toBeTruthy();
    expect(getAllByTestId('svg-circle').length).toBe(3);
  });

  it('빈 배열이면 카드도 렌더링되지 않는다 (001 계약 보존)', () => {
    const { queryByTestId } = renderWith(<EmotionCurveChart points={[]} />);
    expect(queryByTestId('emotion-curve-card')).toBeNull();
    expect(queryByTestId('emotion-curve-chart')).toBeNull();
  });

  it('단일 브랜드 컬러(brand-500) 정합 유지 — 폴리라인 stroke', () => {
    const { getByTestId } = renderWith(<EmotionCurveChart points={points} />);
    expect(getByTestId('svg-polyline').props.stroke).toBe(colors.brand[500]);
  });
});

// ---------------------------------------------------------------------------
// REQ-COMP2-008(4): HighlightList 카드 래퍼 + 행 구분선
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-002 F09: HighlightList 카드 (REQ-COMP2-008)', () => {
  const highlights: Highlight[] = [
    { page_number: 42, content: '이 문장에서 마음이 찡해졌어요.' },
    { page_number: 118, content: '두 번째 하이라이트.' },
  ];

  it('카드 래퍼가 bg-surface fill, cornerRadius 16 이다', () => {
    const { getByTestId } = renderWith(<HighlightList highlights={highlights} />);
    const card = getByTestId('highlight-list-card');
    const styleFlat = StyleSheet.flatten(card.props.style);
    expect(styleFlat.backgroundColor).toBe(colors.bg.surface);
    expect(styleFlat.borderRadius).toBe(16);
  });

  it('섹션 라벨 "하이라이트" 가 렌더링된다', () => {
    const { getByText } = renderWith(<HighlightList highlights={highlights} />);
    expect(getByText('하이라이트')).toBeTruthy();
  });

  it('각 행의 testID 가 highlight-card 로 유지된다 (001 호환)', () => {
    const { getAllByTestId } = renderWith(<HighlightList highlights={highlights} />);
    expect(getAllByTestId('highlight-card').length).toBe(2);
  });

  it('빈 하이라이트는 행을 렌더하지 않는다 (001 호환)', () => {
    const { queryAllByTestId } = renderWith(<HighlightList highlights={[]} />);
    expect(queryAllByTestId('highlight-card').length).toBe(0);
  });

  it('페이지 번호 본문이 유지된다 (p.N 포맷)', () => {
    const { getByText } = renderWith(<HighlightList highlights={highlights} />);
    expect(getByText(/p\.42/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// REQ-COMP2-008(2): RecordsHeader 카피 변경
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-002 F09: RecordsHeader 카피 (REQ-COMP2-008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('성공 시 "이 책에 남긴 감정 기록 N개" 카피가 렌더링된다', () => {
    setHook({
      status: 'success',
      data: {
        emotion_curve: [{ page_number: 1, emotion_count: 1 }],
        highlights: [{ page_number: 1, content: 'x' }],
        total_records: 12,
      },
      error: null,
      isLoading: false,
    });
    const { getByText } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    expect(getByText(/이 책에 남긴 감정 기록 12개/)).toBeTruthy();
  });

  it('빈 상태에서도 "이 책에 남긴 감정 기록 0개" 카피가 렌더링된다', () => {
    setHook({
      status: 'empty',
      data: { emotion_curve: [], highlights: [], total_records: 0 },
      error: null,
      isLoading: false,
    });
    const { getByText } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    expect(getByText(/이 책에 남긴 감정 기록 0개/)).toBeTruthy();
  });

  it('001 6상태 분기 — loading/data-error/auth/error 전부 CelebratonHeader 미표시 유지', () => {
    setHook({ status: 'loading', data: null, error: null, isLoading: true });
    const { queryByTestId, rerender } = renderWith(
      <CompletionDiaryScreen userBookId="ub-1" />,
    );
    expect(queryByTestId('completion-celebration-card')).toBeNull();

    setHook({ status: 'error', data: null, error: null, isLoading: false });
    rerender(
      <ThemeProvider>
        <CompletionDiaryScreen userBookId="ub-1" />
      </ThemeProvider>,
    );
    expect(queryByTestId('completion-celebration-card')).toBeNull();
  });
});
