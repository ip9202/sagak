/**
 * 도서 상세 동적 라우트 — [bookId]
 * SPEC-NAV-001 — REQ-NAV-010, 인수 시나리오 S1
 *
 * 본 SPEC은 bookId 파라미터 수신까지만 보증한다.
 * 실제 도서 상세 콘텐츠는 SPEC-LIBRARY-001에서 구현한다 (EC5: 잘못된 bookId 처리 위임).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function BookDetailRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>도서 상세</Text>
      <Text style={[styles.placeholder, { color: theme.colors.text.tertiary }]}>
        bookId: {bookId}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  placeholder: { fontSize: 14 },
});
