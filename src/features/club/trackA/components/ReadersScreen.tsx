/**
 * SPEC-CLUB-001 T-010 ReadersScreen (M3 — 독자 목록 UI)
 *
 * 특정 책의 공개 독자 목록을 표시한다. useActiveReaders(bookId) 로 ActiveReader[] 조회.
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 3계층 레이아웃 (Header / Content)
 * - 헤더 타이틀 균일성: fontSize 22 / weight 700 (REQ-SCREEN-010)
 * - 카드 밀도: cornerRadius 16 / padding 16-20 (REQ-SCREEN-020)
 * - 빈/로딩/에러 상태 (REQ-SCREEN-030/031/032)
 * - token-only 스타일링 (REQ-SCREEN-005, src/theme/tokens.ts 변수만 사용)
 *
 * 비과시 원칙 (constitution FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 * 독자 카드는 독서 컨텍스트(현재 페이지, 시작일, 그룹 유무)만 표시한다.
 *
 * club_id 분기 (REQ-CLUBA-006): 본 화면은 선택된 ActiveReader 를 onJoinRequest 로
 * 상위에 전달하기만 하고, 실제 분기(create vs Edge Function)는 JoinRequestSheet/훅이 담당.
 *
 * @MX:NOTE: [AUTO] 독자 목록 화면 — useActiveReaders(bookId) + 독자 카드 리스트 + 상태 패턴. 비과시 원칙 준수.
 * @MX:SPEC SPEC-CLUB-001
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../theme/theme';
import { useSession } from '../../../../auth/useSession';
import { useActiveReaders } from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';
import type { ActiveReader } from '../types';
import { spacing, typography } from '../../../../theme/tokens';

export interface ReadersScreenProps {
  /** books.id (UUID) — 독자 목록 필터 기준 */
  bookId: string;
  /** 독자의 "같이 읽어요" 버튼 누름 시 호출. 상위가 JoinRequestSheet 를 연다. */
  onJoinRequest: (reader: ActiveReader) => void;
}

/**
 * @MX:ANCHOR: [AUTO] ReadersScreen — 독자 목록 화면 공개 컴포넌트
 * @MX:REASON: 라우팅(숨겨진 탭 스택)이 마운트하며, onJoinRequest 계약을 위반하면 요청 작성 플로우(JoinRequestSheet)가 끊긴다.
 */
export const ReadersScreen: React.FC<ReadersScreenProps> = ({
  bookId,
  onJoinRequest,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const userId = session?.user?.id ?? '';
  const { data, isLoading, isError, error } = useActiveReaders(bookId);

  const readers = data ?? [];
  const isEmpty = !isLoading && !isError && readers.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {/* 헤더 (REQ-SCREEN-010 타이틀 균일성) */}
      <View style={styles.header}>
        <Pressable
          testID="readers-back-button"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backButton, { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md }]}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          같이 읽는 독자
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 본문: 상태 패턴 (REQ-SCREEN-STATE) */}
      {isLoading ? (
        <View testID="readers-loading" style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      ) : isError ? (
        <View testID="readers-error" style={styles.bodyCenter}>
          <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
            {error
              ? getUserFriendlyMessage(error as AppError)
              : '독자 목록을 불러오는 중 오류가 발생했습니다.'}
          </Text>
        </View>
      ) : isEmpty ? (
        <View testID="readers-empty" style={styles.bodyCenter}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            아직 같이 읽는 독자가 없어요
          </Text>
          <Text style={[styles.emptyHint, { color: theme.colors.text.secondary }]}>
            이 책을 공개로 읽는 독자가 여기에 나타나요.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: theme.spacing[5] }]}
        >
          {readers.map((r) => (
            <View
              key={r.user_id}
              testID={`reader-card-${r.user_id}`}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing[5],
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.readerId, { color: theme.colors.text.primary }]}
                  numberOfLines={1}
                >
                  {r.user_id === userId ? '나' : `독자 ${r.user_id.slice(0, 6)}`}
                </Text>
                <View
                  testID={`reader-badge-${r.user_id}`}
                  style={[
                    styles.badge,
                    {
                      backgroundColor: r.club_id
                        ? theme.colors.brand[50]
                        : theme.colors.bg.muted,
                      borderRadius: theme.radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: r.club_id
                          ? theme.colors.text.brand
                          : theme.colors.text.tertiary,
                      },
                    ]}
                  >
                    {r.club_id ? '그룹 있음' : '그룹 없음'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: theme.colors.text.secondary }]}>
                  {r.current_page != null ? `${r.current_page}p` : '진도 미공개'}
                </Text>
                <Text style={[styles.metaText, { color: theme.colors.text.tertiary }]}>
                  {r.started_reading_at
                    ? `${r.started_reading_at.slice(0, 10)} 시작`
                    : '시작일 미공개'}
                </Text>
              </View>

              <Pressable
                testID={`reader-join-${r.user_id}`}
                onPress={() => onJoinRequest(r)}
                accessibilityRole="button"
                accessibilityLabel="같이 읽어요 요청"
                style={[
                  styles.joinButton,
                  {
                    backgroundColor: theme.colors.brand[500],
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <Text style={[styles.joinText, { color: theme.colors.text.inverse }]}>
                  같이 읽어요
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: 4,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: typography.displaySm.fontSize, fontWeight: typography.displaySm.fontWeight },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700)
  title: { fontSize: typography.displaySm.fontSize, fontWeight: typography.displaySm.fontWeight },
  headerSpacer: { width: 36 },
  bodyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing[3], padding: spacing[5] },
  errorText: { fontSize: typography.ctaLabel.fontSize, fontWeight: typography.ctaLabel.fontWeight, textAlign: 'center', paddingHorizontal: spacing[8] },
  emptyTitle: { fontSize: typography.headingMd.fontSize, fontWeight: typography.headingMd.fontWeight },
  emptyHint: { fontSize: typography.bodyMd.fontSize, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: spacing[4], paddingTop: 4, paddingBottom: spacing[6] },
  card: { gap: spacing[3] },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readerId: { fontSize: typography.headingSm.fontSize, fontWeight: typography.headingSm.fontWeight, flexShrink: 1 },
  badge: { paddingVertical: 4, paddingHorizontal: 10 },
  badgeText: { fontSize: typography.caption.fontSize, fontWeight: typography.ctaLabel.fontWeight },
  metaRow: { flexDirection: 'row', gap: spacing[3] },
  metaText: { fontSize: typography.sectionLabel.fontSize },
  joinButton: { paddingVertical: 10, alignItems: 'center' },
  joinText: { fontSize: typography.ctaLabel.fontSize, fontWeight: typography.ctaLabel.fontWeight },
});
