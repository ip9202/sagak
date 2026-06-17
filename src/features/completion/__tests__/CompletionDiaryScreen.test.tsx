/**
 * 완독 다이어리 컴포넌트/화면 통합 테스트 (SPEC-COMPLETION-001)
 *
 * 검증 대상:
 * - S-1 EmotionCurveChart (REQ-COMP-006, 시나리오 9 좌/중/우)
 * - S-2 HighlightList (REQ-COMP-007, 시나리오 10, 15)
 * - S-3 total_records 헤더 (REQ-COMP-008, 시나리오 11)
 * - F-1 CelebrationHeader (REQ-COMP-009/010, 시나리오 12, 13)
 * - F-2 CompletionDiaryScreen 통합 (REQ-COMP-001~010, 시나리오 1/7/8/12/17, 엣지 14/16/17)
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../../../theme/theme';
import { colors } from '../../../theme/tokens';
import { AppError } from '../../../errors';

// react-native-svg mock — 차트 렌더 검증용. 실제 SVG 엘리먼트 대신 단순 뷰로 대체.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Mock = ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
    React.createElement(View, { testID }, children);
  const Line = (props: { testID?: string }) =>
    React.createElement(View, { testID: props.testID ?? 'svg-line' });
  const Polyline = (props: { testID?: string; stroke?: string }) =>
    React.createElement(View, { testID: props.testID ?? 'svg-polyline', stroke: props.stroke });
  const Circle = (props: { testID?: string; fill?: string }) =>
    React.createElement(View, { testID: props.testID ?? 'svg-circle', fill: props.fill });
  const G = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, null, children);
  return { __esModule: true, default: Mock, Svg: Mock, Line, Polyline, Circle, G };
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

import { EmotionCurveChart } from '../EmotionCurveChart';
import { HighlightList } from '../HighlightList';
import { CelebrationHeader } from '../CelebrationHeader';
import { CompletionDiaryScreen } from '../CompletionDiaryScreen';
import type { EmotionCurvePoint, Highlight, ReportData } from '../types';

jest.mock('../useCompletionReport', () => ({
  __esModule: true,
  useCompletionReport: jest.fn(),
}));
import { useCompletionReport } from '../useCompletionReport';
import type { UseCompletionReportResult } from '../useCompletionReport';

const hookMock = useCompletionReport as jest.MockedFunction<typeof useCompletionReport>;

function makeReport(overrides: Partial<ReportData> = {}): ReportData {
  return {
    emotion_curve: [
      { page_number: 5, emotion_count: 2 },
      { page_number: 20, emotion_count: 5 },
      { page_number: 50, emotion_count: 3 },
    ],
    highlights: [
      { page_number: 5, content: '첫인상' },
      { page_number: 20, content: '절정' },
    ],
    total_records: 47,
    ...overrides,
  };
}

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
// S-1: EmotionCurveChart (REQ-COMP-006, 시나리오 9)
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-001 S-1: EmotionCurveChart (REQ-COMP-006)', () => {
  it('시나리오 9 좌: 포인트 1개여도 차트가 렌더링된다 (에러 없음)', () => {
    const points: EmotionCurvePoint[] = [{ page_number: 12, emotion_count: 3 }];
    const { getByTestId } = renderWith(<EmotionCurveChart points={points} />);
    expect(getByTestId('emotion-curve-chart')).toBeTruthy();
  });

  it('시나리오 9 중: 3개 이상 포인트 차트 렌더 + 단일 브랜드 컬러(brand-500) 적용', () => {
    const points: EmotionCurvePoint[] = [
      { page_number: 5, emotion_count: 2 },
      { page_number: 20, emotion_count: 5 },
      { page_number: 50, emotion_count: 3 },
    ];
    const { getAllByTestId } = renderWith(<EmotionCurveChart points={points} />);
    // 포인트 수만큼 Circle 렌더
    expect(getAllByTestId('svg-circle').length).toBe(3);
  });

  it('시나리오 9 중: Polyline stroke 는 단일 brand-500 색상이다', () => {
    const points: EmotionCurvePoint[] = [
      { page_number: 1, emotion_count: 1 },
      { page_number: 2, emotion_count: 2 },
    ];
    const { getByTestId } = renderWith(<EmotionCurveChart points={points} />);
    const polyline = getByTestId('svg-polyline');
    expect(polyline.props.stroke).toBe(colors.brand[500]);
  });

  it('시나리오 9 우: 빈 배열이면 차트가 렌더링되지 않는다 (null)', () => {
    const { queryByTestId } = renderWith(<EmotionCurveChart points={[]} />);
    expect(queryByTestId('emotion-curve-chart')).toBeNull();
  });

  it('감정 종류별 범례(legend)는 렌더링되지 않는다', () => {
    const points: EmotionCurvePoint[] = [{ page_number: 1, emotion_count: 1 }];
    const { queryByTestId } = renderWith(<EmotionCurveChart points={points} />);
    expect(queryByTestId('chart-legend')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// S-2: HighlightList (REQ-COMP-007, 시나리오 10, 15)
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-001 S-2: HighlightList (REQ-COMP-007)', () => {
  it('시나리오 10: 2개 하이라이트를 카드 리스트로 렌더한다', () => {
    const highlights: Highlight[] = [
      { page_number: 5, content: '첫인상' },
      { page_number: 20, content: '절정' },
    ];
    const { getByText } = renderWith(<HighlightList highlights={highlights} />);
    expect(getByText('첫인상')).toBeTruthy();
    expect(getByText('절정')).toBeTruthy();
  });

  it('각 카드에 페이지 번호가 포함된다', () => {
    const highlights: Highlight[] = [{ page_number: 12, content: '마음이 찡해졌다' }];
    const { getByText } = renderWith(<HighlightList highlights={highlights} />);
    expect(getByText(/12/)).toBeTruthy();
  });

  it('감정 종류 필드는 표시되지 않는다 (데이터에 존재하지 않음)', () => {
    const highlights: Highlight[] = [{ page_number: 1, content: '내용' }];
    const { queryByTestId } = renderWith(<HighlightList highlights={highlights} />);
    expect(queryByTestId('emotion-kind')).toBeNull();
  });

  it('시나리오 15: 50개 이상 하이라이트도 FlatList 가상화로 렌더된다', () => {
    const highlights: Highlight[] = Array.from({ length: 60 }, (_, i) => ({
      page_number: i + 1,
      content: `하이라이트 ${i + 1}`,
    }));
    const { getByText } = renderWith(<HighlightList highlights={highlights} />);
    expect(getByText('하이라이트 1')).toBeTruthy();
  });

  it('빈 하이라이트는 카드를 렌더하지 않는다', () => {
    const { queryAllByTestId } = renderWith(<HighlightList highlights={[]} />);
    expect(queryAllByTestId('highlight-card').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// F-1: CelebrationHeader (REQ-COMP-009/010, 시나리오 12/13)
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-001 F-1: CelebrationHeader (REQ-COMP-009/010)', () => {
  it('시나리오 12: 축하 메시지가 표시된다', () => {
    const { getByText } = renderWith(<CelebrationHeader />);
    expect(getByText('이 책과의 여정을 완성하셨어요')).toBeTruthy();
  });

  it('시나리오 13: 완독 배지가 렌더링된다', () => {
    const { getByTestId } = renderWith(<CelebrationHeader />);
    expect(getByTestId('completion-badge')).toBeTruthy();
  });

  it('시나리오 13: 배지에 brand-500 강조색이 적용된다', () => {
    const { getByTestId } = renderWith(<CelebrationHeader />);
    const badge = getByTestId('completion-badge');
    // View 의 style(배열 또는 객체) 에서 backgroundColor 추출 — brand-500 적용 검증
    const styleFlat = StyleSheet.flatten(badge.props.style);
    expect(styleFlat.backgroundColor).toBe(colors.brand[500]);
  });
});

// ---------------------------------------------------------------------------
// F-2: CompletionDiaryScreen 통합 (REQ-COMP-001~010, 시나리오 1/7/8/12/16/17)
// ---------------------------------------------------------------------------
describe('SPEC-COMPLETION-001 F-2: CompletionDiaryScreen 통합', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 상태: 로딩 인디케이터/텍스트를 표시한다', () => {
    setHook({ status: 'loading', data: null, error: null, isLoading: true });
    const { getByTestId } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    expect(getByTestId('completion-loading')).toBeTruthy();
  });

  it('시나리오 8: 성공 시 축하 메시지 + 차트 + 하이라이트 + 총 기록 수 표시', () => {
    setHook({ status: 'success', data: makeReport(), error: null, isLoading: false });
    const { getByText, getByTestId } = renderWith(
      <CompletionDiaryScreen userBookId="ub-1" />,
    );
    // 축하 메시지
    expect(getByText('이 책과의 여정을 완성하셨어요')).toBeTruthy();
    // 차트 렌더
    expect(getByTestId('emotion-curve-chart')).toBeTruthy();
    // 하이라이트 내용
    expect(getByText('첫인상')).toBeTruthy();
    // 시나리오 11: 총 기록 수 헤더
    expect(getByText(/이 책에서 남긴 감정 47개/)).toBeTruthy();
  });

  it('시나리오 7: 빈 상태(total_records=0) → 빈 상태 메시지 + 차트/리스트 미렌더', () => {
    setHook({
      status: 'empty',
      data: makeReport({ emotion_curve: [], highlights: [], total_records: 0 }),
      error: null,
      isLoading: false,
    });
    const { getByText, queryByTestId } = renderWith(
      <CompletionDiaryScreen userBookId="ub-1" />,
    );
    expect(getByText(/기록된 감정이 없/)).toBeTruthy();
    expect(queryByTestId('emotion-curve-chart')).toBeNull();
  });

  it('시나리오 11 (0건): 헤더에 "이 책에서 남긴 감정 0개" 표시', () => {
    setHook({
      status: 'empty',
      data: makeReport({ emotion_curve: [], highlights: [], total_records: 0 }),
      error: null,
      isLoading: false,
    });
    const { getByText } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    expect(getByText(/이 책에서 남긴 감정 0개/)).toBeTruthy();
  });

  it('시나리오 12 우: 에러 상태에서 축하 메시지 미표시', () => {
    const err = new AppError('fail', 'NETWORK_ERROR', 0);
    err.category = 'NETWORK';
    err.retriesExhausted = true;
    setHook({ status: 'error', data: null, error: err, isLoading: false });
    const { queryByText, getByText } = renderWith(
      <CompletionDiaryScreen userBookId="ub-1" />,
    );
    expect(queryByText('이 책과의 여정을 완성하셨어요')).toBeNull();
    // 에러 메시지는 표시
    expect(getByText(/완독 리포트를 불러올 수 없/)).toBeTruthy();
  });

  it('시나리오 16: 네트워크 에러 시 재시도 버튼 노출 + refetch 호출', () => {
    const err = new AppError('Failed to fetch', 'NETWORK_ERROR', 0);
    err.category = 'NETWORK';
    err.retriesExhausted = true;
    const refetch = jest.fn();
    setHook({ status: 'error', data: null, error: err, isLoading: false, refetch });
    const { getByText } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    const retryBtn = getByText(/다시 시도|재시도/);
    fireEvent.press(retryBtn);
    expect(refetch).toHaveBeenCalled();
  });

  it('시나리오 6 (데이터 오류): VALIDATION → "데이터 오류" 메시지 (빈 상태와 구분)', () => {
    const err = new AppError('schema', 'SCHEMA', 400);
    err.category = 'VALIDATION';
    setHook({ status: 'data-error', data: null, error: err, isLoading: false });
    const { getByText, queryByText } = renderWith(
      <CompletionDiaryScreen userBookId="ub-1" />,
    );
    expect(getByText(/데이터 오류/)).toBeTruthy();
    // 빈 상태 메시지와 혼동되지 않음
    expect(queryByText(/기록된 감정이 없/)).toBeNull();
  });

  it('시나리오 17: AUTH 에러 → 인증 메시지 표시', () => {
    const err = new AppError('jwt expired', 'AUTH_ERROR', 401);
    err.category = 'AUTH';
    setHook({ status: 'auth', data: null, error: err, isLoading: false });
    const { getByText } = renderWith(<CompletionDiaryScreen userBookId="ub-1" />);
    expect(getByText(/로그인/)).toBeTruthy();
  });
});
