/**
 * 서재 탭 (SPEC-LIBRARY-001 TASK-009)
 *
 * useLibrary 로 서재 목록을 조회하고 BookCard 리스트로 표시한다.
 * - status 필터 캡슐 4탭 (전체/읽는중/완독/보관함)
 * - 빈 상태 CTA (검색 진입) 유지
 * - loading/error/empty 상태 패턴 (SPEC-UI-002 REQ-SCREEN-STATE)
 * - token-only 스타일링 (useTheme + tokens.ts 변수만 사용)
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] 서재 탭 화면 — useLibrary(user_books 조회) + BookCard(진행률 표시) 결합. 비과시 원칙 준수.
 * @MX:SPEC SPEC-LIBRARY-001
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/theme';
import { useSession } from '../../src/auth/useSession';
import { useLibrary } from '../../src/features/library/useLibrary';
import { BookCard } from '../../src/components/BookCard';
import type { ReadingStatus } from '../../src/features/library/types';

type StatusFilter = ReadingStatus | 'all';

interface FilterTab {
  key: StatusFilter;
  label: string;
}

// @MX:NOTE: [AUTO] 캡슐 4탭 정의 — 전체(all) + 3 상태(reading/completed/shelved). 라벨은 한국어.
const FILTER_TABS: readonly FilterTab[] = [
  { key: 'all', label: '전체' },
  { key: 'reading', label: '읽는중' },
  { key: 'completed', label: '완독' },
  { key: 'shelved', label: '보관함' },
];

export default function LibraryTab() {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  const userId = session?.user?.id ?? '';
  const status =
    activeFilter === 'all' ? undefined : (activeFilter as ReadingStatus);
  const { data, isLoading, isError, error } = useLibrary({ userId, status });

  // @MX:NOTE: [AUTO] 미인증/세션 로딩(useSession null) 시 빈 userId 로 쿼리 비활성화.
  // 인증 복구 후 자동 활성화된다.
  const items = data ?? [];
  const isEmpty = items.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          서재
        </Text>
        <Pressable
          testID="library-search-button"
          onPress={() => router.push('/search')}
          style={[
            styles.searchIcon,
            {
              backgroundColor: theme.colors.brand[50],
              borderRadius: theme.radius.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="책 검색"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.searchIconText}>🔍</Text>
        </Pressable>
      </View>

      {/* 캡슐 4탭 필터 (SPEC-UI-002 REQ-SCREEN-TABBAR — 단 화면 내 인라인 필터) */}
      <View
        style={[
          styles.filterRow,
          {
            backgroundColor: theme.colors.bg.muted,
            borderRadius: theme.radius.full,
            marginHorizontal: theme.spacing[5],
          },
        ]}
      >
        {FILTER_TABS.map((tab) => {
          const active = tab.key === activeFilter;
          return (
            <Pressable
              key={tab.key}
              testID={`library-filter-${tab.key}`}
              onPress={() => setActiveFilter(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={`필터: ${tab.label}`}
              style={[
                styles.filterTab,
                active && {
                  backgroundColor: theme.colors.brand[500],
                  borderRadius: theme.radius.full,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterLabel,
                  {
                    color: active
                      ? theme.colors.text.inverse
                      : theme.colors.text.secondary,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 본문: 상태 패턴 (SPEC-UI-002 REQ-SCREEN-STATE) */}
      {isLoading ? (
        <View testID="library-loading" style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      ) : isError ? (
        <View
          testID="library-error"
          style={styles.bodyCenter}
        >
          <Text
            style={[styles.errorText, { color: theme.colors.semantic.error }]}
          >
            {(error as { message?: string })?.message ??
              '서재를 불러오는 중 오류가 발생했습니다.'}
          </Text>
        </View>
      ) : isEmpty ? (
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
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingHorizontal: theme.spacing[5] },
          ]}
        >
          {items.map((item) => {
            const book = item.books;
            return (
              <BookCard
                key={item.id}
                testID={`library-item-${item.id}`}
                title={book?.title ?? '제목 없음'}
                author={book?.author ?? '저자 미상'}
                currentPage={item.current_page ?? 0}
                totalPages={book?.total_pages ?? 0}
                coverUri={book?.cover_url ?? undefined}
              />
            );
          })}
        </ScrollView>
      )}
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
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700)
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  filterRow: {
    flexDirection: 'row',
    padding: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingTop: 4,
    paddingBottom: 24,
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
