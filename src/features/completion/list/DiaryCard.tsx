/**
 * DiaryCard 컴포넌트 (SPEC-COMPLETION-002, REQ-COMP2-003)
 *
 * 완독 다이어리 리스트의 단일 항목 카드. `.pen` F08-CompletionDiaryList 의
 * DiaryCard-N 노드와 정합.
 *
 * 구조 (.pen cL8wA2 기준):
 * - Pressable(bg-surface, cornerRadius 16, padding 16, row, gap 12)
 *   ├── Cover (60×84, cornerRadius 6) — coverUrl null 시 brand-200 플레이스홀더
 *   ├── Info (flex 1, gap 6)
 *   │   ├── BookTitle (15/600, text-primary)
 *   │   ├── Meta (row, gap 8): "완독 YYYY.MM.DD" + "기록 N개" (11/500, text-tertiary)
 *   │   └── Highlight (13/normal, text-secondary, numberOfLines 2) — recentHighlight null 시 생략
 *   └── Chevron (chevron-right, 20×20, text-tertiary)
 *
 * 토큰만 사용 (SPEC-UI-002 FROZEN — token-only styling).
 *
 * @MX:SPEC SPEC-COMPLETION-002
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../../theme/theme';
import { radius, spacing, typography } from '../../../theme/tokens';
import type { CompletionDiaryListItem } from './types';

export interface DiaryCardProps {
  item: CompletionDiaryListItem;
  onPress: (bookId: string) => void;
}

/** COVER_DIM: 60×84 (.pen F08). cornerRadius 6 → radius.sm. */
const COVER_WIDTH = 60;
const COVER_HEIGHT = 84;

/** ISO completedAt → "YYYY.MM.DD" 포맷. invalid/null → null. */
function formatCompletedDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * 완독 다이어리 단일 카드. F08 DiaryCard 정합.
 *
 * @MX:NOTE: [AUTO] 비과시 원칙(REQ-COMP2-016) — 좋아요/팔로워/랭킹 표시 없음. 개인 기록(완독일/기록수)만 표시.
 */
export function DiaryCard({ item, onPress }: DiaryCardProps) {
  const theme = useTheme();
  const completedDate = formatCompletedDate(item.completedAt);

  return (
    <Pressable
      testID="diary-card"
      onPress={() => onPress(item.bookId)}
      accessibilityRole="button"
      accessibilityLabel={`완독 다이어리 ${item.title}`}
      accessibilityHint="완독 다이어리 상세로 이동합니다."
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: radius.lg,
        },
      ]}
    >
      {/* Cover — coverUrl null 시 brand-200 플레이스홀더 */}
      {item.coverUrl ? (
        <Image
          testID="diary-card-cover-image"
          source={{ uri: item.coverUrl }}
          style={[
            styles.cover,
            {
              borderRadius: radius.sm,
              backgroundColor: theme.colors.brand[200],
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          testID="diary-card-cover-placeholder"
          style={[
            styles.cover,
            {
              borderRadius: radius.sm,
              backgroundColor: theme.colors.brand[200],
            },
          ]}
        />
      )}

      {/* Info column */}
      <View style={styles.info}>
        <Text
          style={[
            typography.alarmTitle,
            { color: theme.colors.text.primary },
            styles.title,
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Meta row: 완독일 + 기록 N개. F08 Meta(gap 8) */}
        <View style={styles.meta}>
          {completedDate ? (
            <Text style={[typography.label, { color: theme.colors.text.tertiary }]}>
              {`완독 ${completedDate}`}
            </Text>
          ) : null}
          <Text style={[typography.label, { color: theme.colors.text.tertiary }]}>
            {`기록 ${item.totalRecords}개`}
          </Text>
        </View>

        {/* Highlight 미리보기 — recentHighlight null 시 생략 (F08 정합) */}
        {item.recentHighlight ? (
          <Text
            style={[typography.bodySm, { color: theme.colors.text.secondary }]}
            numberOfLines={2}
          >
            {item.recentHighlight}
          </Text>
        ) : null}
      </View>

      {/* Chevron-right (.pen F08: 20×20, text-tertiary) */}
      <ChevronRight size={20} color={theme.colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
  },
  cover: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
  },
  info: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing[1] + spacing[1], // F08 Info gap=6 → spacing 6 (없으므로 4+2 합산)
  },
  title: {
    flexShrink: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
