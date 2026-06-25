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
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/theme';
import { typography } from '../../src/theme/tokens';
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
      {/* 헤더 (.pen F04-Library Header: padding [8,20,0,20], space-between) */}
      <View style={styles.header}>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text.primary,
              ...theme.typography.displaySm,
            },
          ]}
        >
          서재
        </Text>
        {/* @MX:NOTE: [AUTO] .pen Header Icons(gap 12): search(text.primary) + plus(brand[500]). Feather 사용. */}
        <View style={styles.headerIcons}>
          <Pressable
            testID="library-search-button"
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel="책 검색"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather
              name="search"
              size={22}
              color={theme.colors.text.primary}
            />
          </Pressable>
          <Pressable
            testID="library-add-button"
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel="책 추가"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="plus" size={22} color={theme.colors.brand[500]} />
          </Pressable>
        </View>
      </View>

      {/* 필터 탭 (.pen F04-Library FilterTabs: 개별 capsule, cornerRadius 18, padding [8,16], gap 8, container padding [16,20,8,20]) */}
      <View style={styles.filterRow}>
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
                // @MX:NOTE: [AUTO] cornerRadius 18 은 .pen FilterTabs capsule 고유값 — theme.radius 스펙트럼(6/10/16/24/9999)에 없어 .pen 특수값으로 직접 지정.
                { borderRadius: 18 },
                {
                  backgroundColor: active
                    ? theme.colors.brand[500]
                    : theme.colors.bg.muted,
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
                    fontWeight: active ? '600' : '500',
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
          {/* @MX:NOTE: [AUTO] .pen F04-Library-Empty / EmptyState: Icon(book-open, 48, text.tertiary) + Title + Sub + CTA. */}
          <Feather
            name="book-open"
            size={48}
            color={theme.colors.text.tertiary}
          />
          <Text
            style={[
              styles.emptyTitle,
              { color: theme.colors.text.primary },
            ]}
          >
            아직 담은 책이 없어요
          </Text>
          <Text
            style={[
              styles.emptyHint,
              { color: theme.colors.text.secondary },
            ]}
          >
            책을 검색하고 서재에 담아보세요
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
                // @MX:NOTE: [AUTO] 책 탭 → 도서 상세([bookId]) 이동. (tabs) 그룹 라우트는
                //           URL 에서 생략되므로 /<UUID> 로 push (PR #68 route fix 와 동일 패턴).
                onPress={() => router.push(`/${item.book_id}`)}
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
  // .pen F04-Library Header: padding [8,20,0,20]
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 0,
  },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700) — displaySm 토큰 spread 로 fontFamily(Inter) 자동 적용
  title: {},
  // .pen Header Icons: gap 12
  headerIcons: {
    flexDirection: 'row',
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
  // .pen FilterTabs: padding [16,20,8,20], gap 8 — 자식은 개별 capsule(flex 없음)
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  // .pen FT-*: padding [8,16], cornerRadius 18(인라인 지정)
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .pen FilterTab L: fontSize 13, fontWeight active 600 / inactive 500 (fontWeight 는 인라인 오버라이드)
  filterLabel: {
    ...typography.bodySm,
  },
  list: {
    flex: 1,
  },
  // .pen BookList: padding [8,20,20,20], gap 16 — paddingHorizontal 은 인라인(theme.spacing[5]) 으로 오버라이드됨
  listContent: {
    gap: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  // .pen EmptyState: padding [40,20], gap 12, center
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    gap: 12,
  },
  // .pen EmptyState Title: 16/600
  emptyTitle: {
    ...typography.headingSm,
    textAlign: 'center',
  },
  // .pen EmptyState Sub: 13/400, lineHeight 1.5, center
  emptyHint: {
    ...typography.bodySm,
    lineHeight: 20, // 13 * 1.5 ≈ 19.5 → 20
    textAlign: 'center',
  },
  // .pen PrimaryButton: height 48, padding [0,24], cornerRadius 10(radius.md 인라인)
  ctaButton: {
    minHeight: 48,
    paddingVertical: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // .pen PrimaryButton label: 16/600
  ctaText: {
    ...typography.headingSm,
  },
});
