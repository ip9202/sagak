/**
 * BookSelectionHub (SPEC-CLUB-004 M1) — 모임 생성 책 선택 허브
 *
 * `/clubs/new` 진입 시 bookId 가 없으면 본 허브가 렌더링된다. 단일 화면에 두 선택지를 동등하게 노출:
 * 1. 서재 섹션 — 호스트 본인 user_books 의 reading/shelved 책 목록 (completed 제외)
 * 2. 외부 검색 섹션 — Kakao 도서 검색 (M2 구현)
 *
 * 설계 결정 (progress.md frozen):
 * - D1: 통합 허브 (단일 화면, 2-버튼 분기 게이트 아님)
 * - M1-1: 빈 서재(0건) → 서재 섹션 생략 + 외부 검색 부각
 * - M1-2: completed → hidden (쿼리 단 status 필터로 자연 제외)
 * - M1-3: 서재 아이템 프레젠테이션 = 기존 BookCard 재사용
 *
 * 회귀 안전 (메모리 교훈):
 * - #35: useLibrary queryKey 는 ['library',{userId,status}] — library 탭과 동일 키 공유(같은 데이터, 캐시 오염 없음).
 * - #36: FlatList flex 함정 회피 — ScrollView + contentContainerStyle gap 사용.
 * - #37: useState 초기값 race 해당 없음 — 허브는 useLibrary(비동기) 소비, bookId 초기값 race 무관.
 *
 * @MX:NOTE: [AUTO] 허브 컴포넌트 — onSelectBook 콜백으로 선택된 bookId 를 상위 라우트에 전달. 라우팅 책임 없음 (순수 presentational + data hooks).
 * @MX:SPEC SPEC-CLUB-004
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../../../theme/theme';
import { typography, spacing as spacingTokens } from '../../../../theme/tokens';
import { useLibrary } from '../../../library/useLibrary';
import { BookCard } from '../../../../components/BookCard';
import type { LibraryItem } from '../../../library/types';

export interface BookSelectionHubProps {
  /** auth.uid() — 서재 조회용 사용자 ID */
  userId: string;
  /** 책 선택 시 호출 — 상위 라우트가 ClubCreateScreen 으로 핸드오프 */
  onSelectBook: (bookId: string) => void;
}

/**
 * @MX:ANCHOR: [AUTO] BookSelectionHub — 모임 생성 진입 허브. /clubs/new 라우트가 마운트.
 * @MX:REASON: clubs.tsx "모임 만들기" CTA → /clubs/new → 본 허브. onSelectBook 계약이 ClubCreateScreen 진입으로 이어지며, 핸드오프를 위반하면 모임 생성 플로우 전체가 단절된다.
 */
export const BookSelectionHub: React.FC<BookSelectionHubProps> = ({
  userId,
  onSelectBook,
}) => {
  const theme = useTheme();
  const tc = theme.colors;

  // reading + shelved 별도 쿼리 — completed 는 쿼리 단에서 제외 (M1-2 hidden).
  // queryKey 가 library 탭과 동일하여 캐시 공유 (메모리 #35 — 오염 아님, 같은 데이터).
  const readingQuery = useLibrary({ userId, status: 'reading' });
  const shelvedQuery = useLibrary({ userId, status: 'shelved' });

  const readingItems = readingQuery.data ?? [];
  const shelvedItems = shelvedQuery.data ?? [];
  const libraryItems: LibraryItem[] = [...readingItems, ...shelvedItems];

  const isLoading = readingQuery.isLoading || shelvedQuery.isLoading;
  const isError = readingQuery.isError || shelvedQuery.isError;
  const hasLibraryItems = libraryItems.length > 0;

  return (
    <ScrollView
      testID="book-selection-hub"
      style={[styles.container, { backgroundColor: tc.bg.base }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: tc.text.primary, ...typography.displaySm }]}
        >
          어떤 책으로 모임을 만들까요?
        </Text>
        <Text
          style={[styles.subtitle, { color: tc.text.secondary, ...typography.bodyMd }]}
        >
          내 서재에서 선택하거나 새로 검색하세요.
        </Text>
      </View>

      {/* 서재 섹션 — 로딩/에러/빈 상태 분기 (AC-013/014/015) */}
      {isLoading && (
        <View
          testID="hub-library-loading"
          style={[styles.statusBlock, { gap: spacingTokens[2] }]}
        >
          <ActivityIndicator size="large" color={tc.brand[500]} />
          <Text style={[styles.statusText, { color: tc.text.secondary, ...typography.bodyMd }]}>
            서재를 불러오는 중...
          </Text>
        </View>
      )}

      {!isLoading && isError && (
        <View
          testID="hub-library-error"
          style={[styles.statusBlock, { gap: spacingTokens[2] }]}
        >
          <Text style={[styles.errorText, { color: tc.semantic.error, ...typography.bodyMd }]}>
            서재를 불러올 수 없어요. 잠시 후 다시 시도해주세요.
          </Text>
        </View>
      )}

      {!isLoading && !isError && hasLibraryItems && (
        <View testID="hub-library-section" style={styles.librarySection}>
          <Text
            style={[styles.sectionLabel, { color: tc.text.secondary, ...typography.sectionLabel }]}
          >
            내 서재
          </Text>
          {libraryItems.map((item) => {
            const book = item.books;
            return (
              <BookCard
                key={item.id}
                testID={`hub-library-item-${item.book_id}`}
                title={book?.title ?? '제목 없음'}
                author={book?.author ?? '저자 미상'}
                currentPage={item.current_page ?? 0}
                totalPages={book?.total_pages ?? 0}
                coverUri={book?.cover_url ?? undefined}
                onPress={() => onSelectBook(item.book_id)}
              />
            );
          })}
        </View>
      )}

      {/* 외부 검색 섹션 — M2 에서 인라인 검색(Option B) 구현. 빈 서재일 때 1차 선택지로 부각(AC-013). */}
      <View
        testID="hub-search-section"
        style={[
          styles.searchSection,
          {
            backgroundColor: tc.bg.muted,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Text
          style={[styles.searchLabel, { color: tc.text.primary, ...typography.headingSm }]}
        >
          {hasLibraryItems ? '또는 외부에서 책 검색' : '책 검색으로 시작하기'}
        </Text>
        <Text
          style={[styles.searchHint, { color: tc.text.secondary, ...typography.bodySm }]}
        >
          서재에 없는 책도 검색해 모임을 만들 수 있어요.
        </Text>
        {/* M2: 검색 입력 + 결과 목록 인라인 렌더 */}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // @MX:NOTE: [AUTO] 메모리 #36 — FlatList flex 함정 회피. ScrollView + contentContainerStyle gap 사용.
  content: {
    padding: spacingTokens[5],
    gap: spacingTokens[5],
  },
  header: {
    gap: spacingTokens[1],
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 token-only — displaySm(22/700/30) 토큰.
  title: {},
  // @MX:NOTE: [AUTO] bodyMd(14/400/22) 토큰.
  subtitle: {},
  statusBlock: {
    alignItems: 'center',
    paddingVertical: spacingTokens[6],
  },
  // @MX:NOTE: [AUTO] bodyMd 토큰.
  statusText: {},
  // @MX:NOTE: [AUTO] bodyMd 토큰.
  errorText: { textAlign: 'center' },
  librarySection: {
    gap: spacingTokens[3],
  },
  // @MX:NOTE: [AUTO] sectionLabel(13/600/18) 토큰.
  sectionLabel: {},
  searchSection: {
    padding: spacingTokens[5],
    gap: spacingTokens[1],
  },
  // @MX:NOTE: [AUTO] headingSm(16/600/23) 토큰.
  searchLabel: {},
  // @MX:NOTE: [AUTO] bodySm(13/400/20) 토큰.
  searchHint: {},
});
