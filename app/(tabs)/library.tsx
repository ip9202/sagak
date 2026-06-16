/**
 * 서재 탭
 * SPEC-NAV-001 — REQ-NAV-002 (T6)
 * SPEC-BOOK-001 M4-7 — 검색 진입점 추가 (빈 상태 CTA + 헤더 아이콘)
 *
 * 실제 서재 콘텐츠는 SPEC-LIBRARY-001 에서 구현.
 * 본 SPEC 범위: 검색 진입 CTA("책 검색하기") → router.push('/search').
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/theme';

export default function LibraryTab() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          서재
        </Text>
        <Pressable
          testID="library-search-button"
          onPress={() => router.push('/search')}
          style={[
            styles.searchIcon,
            { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md },
          ]}
          accessibilityRole="button"
          accessibilityLabel="책 검색"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.searchIconText}>🔍</Text>
        </Pressable>
      </View>

      {/* 빈 상태 CTA — SPEC-BOOK-001 M4-7: 검색 진입 유도 */}
      <View style={styles.emptyState}>
        <Text
          style={[styles.emptyTitle, { color: theme.colors.text.primary }]}
        >
          서재가 비어 있어요
        </Text>
        <Text
          style={[styles.emptyHint, { color: theme.colors.text.secondary }]}
        >
          읽고 싶은 책을 검색해서 추가해 보세요.
        </Text>
        <Pressable
          testID="library-search-cta"
          onPress={() => router.push('/search')}
          style={[
            styles.ctaButton,
            {
              backgroundColor: theme.colors.brand[500],
              borderRadius: theme.radius.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="책 검색하기"
        >
          <Text
            style={[styles.ctaText, { color: theme.colors.text.inverse }]}
          >
            책 검색하기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  searchIcon: {
    padding: 8,
  },
  searchIconText: {
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  ctaButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
