/**
 * SearchResultCard 컴포넌트 (SPEC-BOOK-001 M4-1, REQ-BOOK-014)
 *
 * 검색 결과 1건을 표시하는 카드. Pencil 디자인 기준: SearchResultCard (node x8zuOu).
 * - Cover(80×110 $brand-200) + Info(Title 15/600 $text-primary, Author 12 $text-secondary,
 *   Publisher 12 $text-tertiary "출판사 · YYYY.MM")
 *
 * BookCard(서재용, currentPage/totalPages 필수) 와 분리 — 검색 결과는 진행률이 없다.
 * token-only 스타일링 (SPEC-UI-002 FROZEN). useTheme() 사용, 하드코딩 금지.
 */
import React from 'react';
import { Pressable, Text, View, Image, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useTheme } from '../theme/theme';
import { spacing, typography } from '../theme/tokens';
import { formatPublishedMonth } from '../features/book/format';
import type { SearchResult } from '../types/book';

export interface SearchResultCardProps {
  /** 검색 결과 1건 */
  result: SearchResult;
  /** 카드 탭 시 호출 (result 전달) */
  onPress: (result: SearchResult) => void;
  testID?: string;
}

// @MX:NOTE: [AUTO] formatPublishedMonth 는 공유 유틸로 추출 (DRY, src/features/book/format.ts)
//           BookDetailScreen(M4-3) 과 동일 포맷 공유 — REQ-BOOK-014/REQ-BOOK-015

/**
 * @MX:ANCHOR: [AUTO] SearchResultCard — 검색 결과 카드 공개 컴포넌트
 * @MX:REASON: BookSearchScreen(M4) 이 결과 리스트에서 다중 인스턴스로 렌더링하며, onPress 계약·메타 포맷·표지 fallback 을 위반하면 검색→상세 전환이 고장난다.
 */
export const SearchResultCard: React.FC<SearchResultCardProps> = ({
  result,
  onPress,
  testID = 'search-result-card',
}) => {
  const theme = useTheme();
  const tc = theme.colors;

  const authorText = result.authors.join(', ');
  const formattedDate = formatPublishedMonth(result.published_at);

  // 메타 라인: 출판사 / 출판일 조합 ("출판사 · YYYY.MM", 단일, 또는 생략)
  let metaText: string | null = null;
  if (result.publisher && formattedDate) {
    metaText = `${result.publisher} · ${formattedDate}`;
  } else if (result.publisher) {
    metaText = result.publisher;
  } else if (formattedDate) {
    metaText = formattedDate;
  }

  const accessibilityLabel = `${result.title}. 저자 ${authorText}${
    metaText ? `. ${metaText}` : ''
  }`;

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress(result)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Card style={styles.card} testID={`${testID}-inner`}>
        <View style={styles.content}>
          {/* Cover — Pencil x8zuOu/Cover: 80×110, fill $brand-200 */}
          {result.cover_url ? (
            <Image
              testID={`${testID}-cover`}
              source={{ uri: result.cover_url }}
              style={styles.cover}
              resizeMode="cover"
            />
          ) : (
            <View
              testID={`${testID}-cover-placeholder`}
              style={[styles.cover, { backgroundColor: tc.brand[200] }]}
            />
          )}

          {/* Info — Pencil x8zuOu/Info: gap 6, fill_container width */}
          <View style={styles.info}>
            <Text
              style={[
                styles.title,
                { color: tc.text.primary },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {result.title}
            </Text>

            <Text
              style={[styles.author, { color: tc.text.secondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {authorText}
            </Text>

            {metaText !== null && (
              <Text
                style={[styles.meta, { color: tc.text.tertiary }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {metaText}
              </Text>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  content: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cover: {
    width: 80, // 토큰에 없음, 하드코딩 유지
    height: 110, // 토큰에 없음, 하드코딩 유지
    borderRadius: spacing[2],
  },
  info: {
    flex: 1,
    gap: 6, // spacing 토큰에 6 없음, 하드코딩 유지
    justifyContent: 'center',
  },
  title: {
    ...typography.bodyPrompt,
    fontWeight: '600', // override from '400'
    lineHeight: 21, // override from 22
  },
  author: {
    ...typography.caption,
  },
  meta: {
    ...typography.caption,
  },
});
