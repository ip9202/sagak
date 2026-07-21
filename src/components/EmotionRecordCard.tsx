/**
 * EmotionRecordCard Component - pages_11 §9.3
 * Emotion record with avatar, content, spoiler blur
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Card } from './Card';
import { useTheme } from '../theme/theme';
import { spacing, iconSizes, radius } from '../theme/tokens';

export interface EmotionRecordCardProps {
  nickname: string;
  page: number;
  daysAgo: number;
  content: string;
  bookTitle: string;
  stickers?: { type: 'empathy' | 'touching' | 'comforted'; count: number }[];
  isSpoiler?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * @MX:NOTE
 * EmotionRecordCard component - displays user's emotion record
 * Left accent: brand-300 2dp vertical line (C3)
- Spoiler blur: 12px with overlay when isSpoiler is true (C3)
- Avatar, nickname, page, days ago header
- Content: body-md style
- Book title link (placeholder)
- Sticker reactions: 3 types with counts
- Uses Card base component
- Supports dark mode
 */
export const EmotionRecordCard: React.FC<EmotionRecordCardProps> = ({
  nickname,
  page,
  daysAgo,
  content,
  bookTitle,
  stickers = [],
  isSpoiler = false,
  style,
  testID = 'emotion-record-card',
}) => {
  const theme = useTheme();

  const timeLabel = daysAgo === 0 ? '오늘' : daysAgo === 1 ? '어제' : `${daysAgo}일 전`;

  return (
    <Card style={StyleSheet.flatten([styles.card, style])} testID={testID}>
      {/* Left accent line - brand-300 2dp (C3) */}
      <View
        style={StyleSheet.flatten([
          styles.accentLine,
          {
            backgroundColor: theme.colors.brand[300],
          },
        ])}
      />

      <View style={styles.content}>
        {/* Header: avatar, nickname, page, time */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.bg.muted }]} />
          <Text
            style={[
              styles.nickname,
              {
                color: theme.colors.text.primary,
                fontSize: theme.typography.bodyMd.fontSize,
                fontWeight: '600' as any,
              },
            ]}
          >
            {nickname} · p.{page} · {timeLabel}
          </Text>
        </View>

        {/* Content with spoiler blur (C3) */}
        <View style={styles.contentWrapper}>
          {isSpoiler ? (
            <BlurView intensity={12} tint="default" style={styles.spoilerOverlay}>
              <Text
                style={[
                  styles.spoilerLabel,
                  {
                    backgroundColor: `${theme.colors.text.primary}E6`, // 90% opacity
                    color: theme.colors.text.inverse,
                  },
                ]}
              >
                이 기록은 내 진도를 넘었어요
              </Text>
            </BlurView>
          ) : null}

          <Text
            style={[
              styles.contentText,
              {
                color: theme.colors.text.primary,
                fontSize: theme.typography.bodyMd.fontSize,
                lineHeight: theme.typography.bodyMd.lineHeight,
              },
            ]}
          >
            {content}
          </Text>

          <Text
            style={[
              styles.bookTitle,
              {
                color: theme.colors.text.brand,
              },
            ]}
          >
            {bookTitle} ↗
          </Text>
        </View>

        {/* Sticker reactions */}
        {stickers.length > 0 && !isSpoiler && (
          <View style={styles.stickers}>
            {stickers.map((sticker, index) => (
              <View key={index} style={styles.sticker}>
                <Text
                  style={[
                    styles.stickerText,
                    {
                      color: theme.colors.text.secondary,
                      fontSize: theme.typography.caption.fontSize,
                    },
                  ]}
                >
                  {getStickerEmoji(sticker.type)} {sticker.count}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Card>
  );
};

const getStickerEmoji = (type: 'empathy' | 'touching' | 'comforted'): string => {
  switch (type) {
    case 'empathy':
      return '🤗';
    case 'touching':
      return '😢';
    case 'comforted':
      return '🫂';
    default:
      return '❓';
  }
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: spacing[4],
    bottom: spacing[4],
    width: 2,
  },
  content: {
    paddingLeft: spacing[2],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  avatar: {
    width: iconSizes.xl,
    height: iconSizes.xl,
    borderRadius: iconSizes.xl,
  },
  nickname: {
    flex: 1,
  },
  contentWrapper: {
    position: 'relative',
    minHeight: 60,
  },
  spoilerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  spoilerLabel: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.xs,
    fontSize: 12,
    fontWeight: '500',
  },
  contentText: {
    marginTop: spacing[1],
  },
  bookTitle: {
    marginTop: spacing[1],
    fontSize: 13,
    fontWeight: '500',
  },
  stickers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  sticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  stickerText: {
    fontWeight: '500',
  },
});
