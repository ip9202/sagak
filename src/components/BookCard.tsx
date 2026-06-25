/**
 * BookCard Component - pages_11 §9.2 / .pen P5cRv
 * Book card with cover, title, author, progress bar + caption
 *
 * .pen BookCard(P5cRv):
 * - gap 12 (Info frame gap 6 내부, 카드 자체 gap 12)
 * - Cover 80×110, cornerRadius 6 (radius.sm), placeholder fill brand[200]
 * - Title 15/600 (alarmTitle 토큰), numberOfLines 2
 * - Author 12/400 (caption)
 * - Progress: Track 4px bg-muted cornerRadius 2, Fill brand[500], Caption 11/500 text.tertiary "X / Yp (Z%)"
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../theme/theme';
import { spacing, radius, typography } from '../theme/tokens';

export interface BookCardProps {
  title: string;
  author: string;
  currentPage: number;
  totalPages: number;
  coverUri?: string;
  style?: ViewStyle;
  testID?: string;
  /** 탭 시 호출 — 서재에서 책 상세로 이동 등. 전달 시 Pressable(Card) 로 렌더. */
  onPress?: () => void;
}

/**
 * @MX:NOTE: [AUTO] BookCard — .pen P5cRv 기반. Cover 80×110/radius.sm/brand[200] placeholder,
 *           Title 15/600(alarmTitle), Author 12/400(caption), Progress 4px + caption "X / Yp (Z%)".
 *           진행률 캡션은 totalPages 0 이면 생략(currentPage/0 NaN 방지).
 *           onPress 전달 시 Card 가 Pressable 로 전환되어 탭 가능.
 */
export const BookCard: React.FC<BookCardProps> = ({
  title,
  author,
  currentPage,
  totalPages,
  coverUri,
  style,
  testID = 'book-card',
  onPress,
}) => {
  const theme = useTheme();

  const showCaption = totalPages > 0;
  const percent =
    totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <Card
      style={StyleSheet.flatten([styles.card, style])}
      testID={testID}
      onPress={onPress}
    >
      <View style={styles.content}>
        {/* Cover: 80×110, radius.sm(6), placeholder brand[200] (.pen Cover) */}
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.cover}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.cover,
              { backgroundColor: theme.colors.brand[200] },
            ]}
          />
        )}

        <View style={styles.info}>
          {/* Title: 15/600 (alarmTitle), 2 lines with ellipsis (C5) */}
          <Text
            testID="book-card-title"
            style={[
              styles.title,
              {
                color: theme.colors.text.primary,
                ...theme.typography.alarmTitle,
              },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>

          {/* Author: 12/400 (caption) */}
          <Text
            style={[
              styles.author,
              {
                color: theme.colors.text.secondary,
                ...theme.typography.caption,
              },
            ]}
          >
            {author}
          </Text>

          {/* Progress (.pen Progress: Track 4px, Fill brand[500], Caption 11/500 text.tertiary) */}
          <View style={styles.progressWrap}>
            <ProgressBar
              current={currentPage}
              total={totalPages}
              style={styles.progress}
              showCaption={false}
            />
            {showCaption && (
              <Text
                style={[
                  styles.progressCaption,
                  {
                    color: theme.colors.text.tertiary,
                    ...theme.typography.label,
                  },
                ]}
              >
                {currentPage} / {totalPages}p ({percent}%)
              </Text>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing[3], // 12
  },
  // @MX:NOTE: [AUTO] .pen BookCard gap 12 — Cover 와 Info 나란히 배치(Row). 기존 Column 레이아웃에서 Row 로 정정.
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3], // 12
  },
  // .pen Cover: 80×110, cornerRadius 6 (radius.sm)
  cover: {
    width: 80,
    height: 110,
    borderRadius: radius.sm,
  },
  info: {
    flex: 1,
    gap: spacing[1] + 2, // .pen Info gap 6
  },
  title: {},
  author: {},
  progressWrap: {
    // .pen Progress frame: padding [4,0,0,0], gap 4
    marginTop: spacing[1],
    gap: spacing[1],
  },
  progress: {},
  // .pen Caption: 11/500 (label 토큰)
  progressCaption: {
    ...typography.label,
  },
});
