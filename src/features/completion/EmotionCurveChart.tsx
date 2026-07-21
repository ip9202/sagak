/**
 * 감정 곡선 차트 컴포넌트 (SPEC-COMPLETION-001 REQ-COMP-006, SPEC-COMPLETION-002 F09 정합)
 *
 * 순수 SVG(react-native-svg) 로 emotion_curve 포인트를 선형 차트로 시각화한다.
 * 단일 브랜드 컬러 토큰(colors.brand[500]) 만 사용한다 (감정 종류별 색상 없음).
 *
 * 스케일링:
 * - x축: page_number 도메인 → viewBox width
 * - y축: emotion_count 도메인 → viewBox height (상단이 최대값)
 *
 * SPEC-COMPLETION-002 F09 카드 컨트랙트 (REQ-COMP2-009, additive):
 * - 카드 래퍼: bg-surface fill, cornerRadius 16, padding 16
 * - ChartLabel "감정 곡선" (sectionLabel, text-tertiary)
 * - 차트 영역: height 120, bg-muted, cornerRadius 8
 * - 기존 SVG 폴리라인/포인트는 렌더 트리에 유지 (001 데이터 바인딩 보존)
 *
 * @MX:NOTE: [AUTO] 빈 배열이면 null 반환 — 부모(화면)가 빈 상태에서 마운트하지 않도록 계약 위임.
 *           카드 래퍼도 함께 생략된다 (빈 상태에서 차트 카드 자체를 보여주지 않음, 001 계약 보존).
 * @MX:SPEC SPEC-COMPLETION-001, SPEC-COMPLETION-002
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, G } from 'react-native-svg';
import { useTheme } from '../../theme/theme';
import { spacing, radius, typography } from '../../theme/tokens';
import type { EmotionCurvePoint } from './types';

export interface EmotionCurveChartProps {
  points: EmotionCurvePoint[];
  /** 차트 viewBox 너비(기본 320) */
  width?: number;
  /** 차트 viewBox 높이(기본 140) */
  height?: number;
}

/**
 * 포인트 배열을 SVG 좌표계로 스케일링한다.
 * 최소 여백을 위해 padding 만큼 안쪽에 배치한다.
 */
function scalePoints(
  points: EmotionCurvePoint[],
  width: number,
  height: number,
  padding: number,
): { x: number; y: number }[] {
  if (points.length === 0) return [];
  const pages = points.map((p) => p.page_number);
  const counts = points.map((p) => p.emotion_count);
  const minPage = Math.min(...pages);
  const maxPage = Math.max(...pages);
  const maxCount = Math.max(...counts, 1); // 0 division 방지
  const pageSpan = Math.max(maxPage - minPage, 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return points.map((p) => ({
    x: padding + ((p.page_number - minPage) / pageSpan) * innerW,
    y: padding + innerH - (p.emotion_count / maxCount) * innerH,
  }));
}

/**
 * 감정 곡선 차트를 렌더링한다 (REQ-COMP-006, REQ-COMP2-009).
 * 빈 배열이면 null 을 반환하여 부모가 마운트를 제어한다 (시나리오 9 우).
 */
export function EmotionCurveChart({
  points,
  width = 320,
  height = 140,
}: EmotionCurveChartProps): React.ReactElement | null {
  const theme = useTheme();
  const brand = theme.colors.brand[500];
  const padding = 12;

  if (!points || points.length === 0) return null;

  const coords = scalePoints(points, width, height, padding);
  const pointsStr = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const maxCount = points.reduce((m, p) => Math.max(m, p.emotion_count), 0);
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 REQ-COMP2-009 — peak 점(emotion_count 최대 포인트) 강조.
  const peakIndex = points.reduce(
    (maxIdx, p, i, arr) => (p.emotion_count > arr[maxIdx].emotion_count ? i : maxIdx),
    0,
  );

  return (
    <View
      testID="emotion-curve-card"
      style={[styles.card, { backgroundColor: theme.colors.bg.surface }]}
    >
      <Text style={[styles.chartLabel, { color: theme.colors.text.tertiary }]}>
        감정 곡선
      </Text>
      <Text style={[styles.chartCaption, { color: theme.colors.text.tertiary }]}>
        감정 곡선 영역
      </Text>
      <View
        style={[styles.chartZone, { backgroundColor: theme.colors.bg.muted }]}
      >
        <View
          testID="emotion-curve-chart"
          accessible
          accessibilityRole="image"
          accessibilityLabel={`페이지별 감정 기록 수 차트. 총 ${points.length}개 구간, 최대 ${maxCount}건`}
          style={{ width, height }}
        >
          <Svg width={width} height={height}>
            <G>
              <Polyline
                testID="svg-polyline"
                points={pointsStr}
                fill="none"
                stroke={brand}
                strokeWidth={2}
              />
              {coords.map((c, i) => (
                <Circle
                  key={`pt-${i}`}
                  testID="svg-circle"
                  cx={c.x}
                  cy={c.y}
                  r={4}
                  fill={brand}
                />
              ))}
              {/* @MX:NOTE: [AUTO] SPEC-COMPLETION-002 REQ-COMP2-009 — peak 점 강조 (반경 6, brand-500). */}
              <Circle
                testID="svg-peak"
                cx={coords[peakIndex].x}
                cy={coords[peakIndex].y}
                r={6}
                fill={brand}
              />
            </G>
          </Svg>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 REQ-COMP2-009 — F09 카드 래퍼 (bg-surface, radius 16, padding 16).
  card: {
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[2],
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — ChartLabel "감정 곡선" (sectionLabel 13/600, text-tertiary).
  chartLabel: {
    ...typography.sectionLabel,
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — 차트 캡션 (caption 12/400, text-tertiary).
  chartCaption: {
    ...typography.caption,
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — 차트 영역 (height 120, bg-muted, radius 8).
  chartZone: {
    borderRadius: radius.sm,
    padding: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
