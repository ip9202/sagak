/**
 * 하이라이트 카드 리스트 컴포넌트 (SPEC-COMPLETION-001 REQ-COMP-007, SPEC-COMPLETION-002 F09 정합)
 *
 * report_data.highlights 를 F09 카드 내 행 리스트로 표시한다.
 * 각 행은 페이지 배지(p.N) + 기록 내용(content) 만 포함한다 (감정 종류 필드 없음).
 *
 * SPEC-COMPLETION-002 F09 카드 컨트랙트 (REQ-COMP2-008, additive):
 * - 카드 래퍼: bg-surface fill, cornerRadius 16
 * - SectionLabel "하이라이트" (sectionLabel, text-secondary)
 * - 행 구분선: borderTopWidth 1 / borderTopColor border.default (strokeSides:["top"] RN 매핑)
 *   첫 행은 top border 없음
 *
 * 001 호환 (characterization):
 * - 각 행의 testID="highlight-card" 유지 — 빈 상태에서 0개 유지
 * - FlatList 가상화로 대량(50+) 하이라이트도 성능 유지 (시나리오 15)
 *
 * 디자인 토큰(tokens.ts) 만 사용 — SPEC-UI-001 EmotionRecordCard 패턴 준수.
 *
 * @MX:SPEC SPEC-COMPLETION-001, SPEC-COMPLETION-002
 */
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import { spacing, radius, borderWidth, typography } from '../../theme/tokens';
import type { Highlight } from './types';

export interface HighlightListProps {
  highlights: Highlight[];
}

/**
 * 하이라이트 카드 리스트를 렌더링한다 (REQ-COMP-007, REQ-COMP2-008).
 */
export function HighlightList({ highlights }: HighlightListProps): React.ReactElement {
  const theme = useTheme();

  const renderItem = ({
    item,
    index,
  }: {
    item: Highlight;
    index: number;
  }) => (
    <View
      testID="highlight-card"
      style={[
        styles.row,
        // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — strokeSides:["top"] → borderTopWidth/topColor.
        //           첫 행(index 0)은 top border 없음.
        index === 0 ? null : { borderTopWidth: borderWidth.hairline, borderTopColor: theme.colors.border.default },
      ]}
    >
      <View
        style={[styles.pageBadge, { backgroundColor: theme.colors.brand[50] }]}
      >
        <Text style={[styles.pageNumber, { color: theme.colors.text.brand }]}>
          p.{item.page_number}
        </Text>
      </View>
      <Text style={[styles.content, { color: theme.colors.text.primary }]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <View
      testID="highlight-list-card"
      style={[
        styles.card,
        { backgroundColor: theme.colors.bg.surface },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.colors.text.secondary }]}>
          하이라이트
        </Text>
      </View>
      <FlatList
        data={highlights}
        keyExtractor={(item, index) => `hl-${item.page_number}-${index}`}
        renderItem={renderItem}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 REQ-COMP2-008 — F09 카드 래퍼 (bg-surface, radius 16).
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  sectionHeader: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — SectionLabel "하이라이트" (sectionLabel 13/600).
  sectionLabel: {
    ...typography.sectionLabel,
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — 행 (padding 12/16, gap 10 → pageBadge + body).
  row: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'flex-start',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — PageBadge (brand-50, radius 6, padding 2/6).
  //           Pencil padding [2,6] 은 spacing 스케일(4의 배수)에 없으므로 고정값 사용 (token-only 예외: 레이아웃 고정값).
  pageBadge: {
    borderRadius: radius.sm,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — 페이지 번호 (label 11/600, text-brand).
  pageNumber: {
    ...typography.label,
    fontWeight: '600',
  },
  // @MX:NOTE: [AUTO] SPEC-COMPLETION-002 F09 — 본문 (bodyMd 14/400, text-primary).
  content: {
    ...typography.bodyMd,
    flex: 1,
  },
});
