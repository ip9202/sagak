/**
 * BookCard Component - pages_11 §9.2
 * Book card with cover, title, author, progress bar
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { useTheme } from '../theme/theme';

export interface BookCardProps {
  title: string;
  author: string;
  currentPage: number;
  totalPages: number;
  coverUri?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * @MX:NOTE
 * BookCard component - displays book with reading progress
 * Cover: 80×110dp placeholder (or Image if coverUri provided)
 * Title: 2 lines with ellipsis (C5)
 * Author: caption style
 * Progress bar: current/total with percentage
 * Uses Card base component
 * Supports dark mode
 */
export const BookCard: React.FC<BookCardProps> = ({
  title,
  author,
  currentPage,
  totalPages,
  coverUri,
  style,
  testID = 'book-card',
}) => {
  const theme = useTheme();

  return (
    <Card style={StyleSheet.flatten([styles.card, style])} testID={testID}>
      <View style={styles.content}>
        {/* Cover placeholder or image */}
        {coverUri ? (
          <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]} />
        )}

        {/* Title - 2 lines with ellipsis (C5) */}
        <Text
          testID="book-card-title"
          style={[
            styles.title,
            {
              color: theme.colors.text.primary,
              fontSize: theme.typography.headingSm.fontSize,
              fontWeight: theme.typography.headingSm.fontWeight as any,
            },
          ]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>

        {/* Author */}
        <Text
          style={[
            styles.author,
            {
              color: theme.colors.text.secondary,
              fontSize: theme.typography.caption.fontSize,
              lineHeight: theme.typography.caption.lineHeight,
            },
          ]}
        >
          {author}
        </Text>

        {/* Progress bar */}
        <ProgressBar current={currentPage} total={totalPages} style={styles.progress} />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 12,
  },
  content: {
    gap: 8,
  },
  cover: {
    width: 80,
    height: 110,
    borderRadius: 8,
    alignSelf: 'center',
  },
  coverPlaceholder: {
    backgroundColor: '#F4EFE8',
  },
  title: {
    minHeight: 44, // 2 lines * 22px line-height
  },
  author: {
    marginTop: 4,
  },
  progress: {
    marginTop: 8,
  },
});
