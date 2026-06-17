/**
 * 하이라이트 카드 리스트 컴포넌트 (SPEC-COMPLETION-001, REQ-COMP-007, 시나리오 10/15)
 *
 * report_data.highlights 를 FlatList 카드로 표시한다.
 * 각 카드는 페이지 번호 + 기록 내용(content) 만 포함한다 (감정 종류 필드 없음).
 * FlatList 가상화로 대량(50+) 하이라이트도 성능을 유지한다 (시나리오 15).
 *
 * 디자인 토큰(tokens.ts) 만 사용 — SPEC-UI-001 EmotionRecordCard 패턴 준수.
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */
import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/theme';
import type { Highlight } from './types';

export interface HighlightListProps {
  highlights: Highlight[];
}

/**
 * 하이라이트 카드 리스트를 렌더링한다 (REQ-COMP-007).
 */
export function HighlightList({ highlights }: HighlightListProps): React.ReactElement {
  const theme = useTheme();

  const renderItem = ({ item }: { item: Highlight }) => (
    <View
      testID="highlight-card"
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderColor: theme.colors.border.default,
        },
      ]}
    >
      <Text style={[styles.pageNumber, { color: theme.colors.text.brand }]}>
        p.{item.page_number}
      </Text>
      <Text style={[styles.content, { color: theme.colors.text.primary }]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={highlights}
      keyExtractor={(item, index) => `hl-${item.page_number}-${index}`}
      renderItem={renderItem}
      scrollEnabled
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginVertical: 6,
  },
  pageNumber: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  content: {
    fontSize: 14,
    lineHeight: 22,
  },
});
