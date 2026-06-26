/**
 * SPEC-CLUB-002 M4 ClubsScreen (모임 목록 UI)
 *
 * 사용자가 host 인 모임 목록을 표시한다. useHostClubs(userId) 로 ClubRow[] 조회.
 * F11-Clubs Pencil 디자인(.pen ELyXX) 기반:
 * - Header: Title "모임"(fontSize 22/weight 700) + plus 아이콘 (모임 생성入口)
 * - Content: Section label "함께 읽는 모임"(text-tertiary) + ClubCard 리스트 + NewClubCTA
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 3계층 레이아웃 (Header / Content)
 * - 헤더 타이틀 균일성: fontSize 22 / weight 700 (REQ-SCREEN-010)
 * - 카드 밀도: cornerRadius 16 / padding 16-20 (REQ-SCREEN-020)
 * - 빈/로딩/에러 상태 (REQ-SCREEN-030/031/032)
 * - token-only 스타일링 (REQ-SCREEN-005)
 *
 * 비과시 원칙 (constitution FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 * 모임 카드는 독서 컨텍스트(이름, 진도 메타, 상태)만 표시한다.
 *
 * @MX:NOTE: [AUTO] 모임 목록 화면 — useHostClubs + ClubCard 리스트 + NewClubCTA + 상태 패턴. 비과시 원칙 준수.
 * @MX:SPEC SPEC-CLUB-002
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
import { typography } from '../../../../theme/tokens';
import { useHostClubs } from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';
import type { ClubRow } from '../types';

export interface ClubsScreenProps {
  /** auth.uid() — host 필터 기준 */
  userId: string;
  /** plus 아이콘 / NewClubCTA 누름 시 호출. 상위가 생성 폼을 연다. */
  onCreateClub: () => void;
}

/**
 * @MX:ANCHOR: [AUTO] ClubsScreen — 모임 탭 메인 화면. 라우팅(app/(tabs)/clubs)이 마운트하며, onCreateClub 계약을 위반하면 생성 플로우(ClubCreateScreen)가 끊긴다.
 * @MX:REASON: (tabs) 클럽 탭이 이 컴포넌트를 렌더링하며, clubId 라우팅(clubs/[clubId])과 생성 라우팅이 onClubPress/onCreateClub 콜백에 의존한다.
 */
export const ClubsScreen: React.FC<ClubsScreenProps> = ({
  userId,
  onCreateClub,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useHostClubs(userId);

  const clubs = data ?? [];
  const isEmpty = !isLoading && !isError && clubs.length === 0;

  const openClub = (clubId: string) => {
    router.push(`/clubs/${clubId}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {/* 헤더 (REQ-SCREEN-010 타이틀 균일성, REQ-SCREEN-011 우측 액션 아이콘) */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          모임
        </Text>
        <Pressable
          testID="clubs-create-button"
          onPress={onCreateClub}
          accessibilityRole="button"
          accessibilityLabel="새 모임 만들기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.createIcon,
            {
              width: theme.iconSizes.lg,
              height: theme.iconSizes.lg,
            },
          ]}
        >
          {/* .pen K54AFO — plus 아이콘 (모임 생성入口). 토큰 색상 brand-500. */}
          <Text
            style={[
              styles.createIconText,
              { color: theme.colors.brand[500] },
            ]}
          >
            +
          </Text>
        </Pressable>
      </View>

      {/* 본문: 상태 패턴 (REQ-SCREEN-STATE) */}
      {isLoading ? (
        <View testID="clubs-loading" style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      ) : isError ? (
        <View testID="clubs-error" style={styles.bodyCenter}>
          <Text
            style={[styles.errorText, { color: theme.colors.semantic.error }]}
          >
            {error
              ? getUserFriendlyMessage(error as AppError)
              : '모임 목록을 불러오는 중 오류가 발생했습니다.'}
          </Text>
          <Pressable
            testID="clubs-retry"
            onPress={() => refetch()}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            style={[
              styles.retryButton,
              {
                backgroundColor: theme.colors.brand[500],
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={[styles.retryText, { color: theme.colors.text.inverse }]}
            >
              다시 시도
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: theme.spacing[5],
              paddingBottom: theme.spacing[6],
            },
          ]}
        >
          {/* 섹션 라벨 (REQ-SCREEN-012) */}
          <Text
            style={[styles.section, { color: theme.colors.text.tertiary }]}
          >
            함께 읽는 모임
          </Text>

          {isEmpty ? (
            <View
              testID="clubs-empty"
              style={[
                styles.emptyCard,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing[5],
                },
              ]}
            >
              <Text
                style={[
                  styles.emptyTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                아직 만든 모임이 없어요
              </Text>
              <Text
                style={[
                  styles.emptyHint,
                  { color: theme.colors.text.secondary },
                ]}
              >
                혼자 읽는 책에 모임을 열어 함께 읽는 즐거움을 시작해보세요.
              </Text>
            </View>
          ) : (
            clubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onPress={() => openClub(club.id)}
              />
            ))
          )}

          {/* NewClubCTA (.pen gSbVI — PrimaryButton "새 모임 만들기 (0명도 OK)") */}
          <Pressable
            testID="clubs-new-cta"
            onPress={onCreateClub}
            accessibilityRole="button"
            accessibilityLabel="새 모임 만들기 (0명도 OK)"
            style={[
              styles.ctaButton,
              {
                backgroundColor: theme.colors.brand[500],
                borderRadius: theme.radius.md,
                marginTop: theme.spacing[5],
              },
            ]}
          >
            <Text
              style={[styles.ctaText, { color: theme.colors.text.inverse }]}
            >
              새 모임 만들기 (0명도 OK)
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
};

/**
 * 모임 카드 (.pen zlR3h/g0Y6M — Cover 60×84 brand-200 cornerRadius 6 + Info vertical).
 * 비과시 원칙: 멤버 수·좋아요 표시 없음. 이름/진도 메타/상태만.
 */
const ClubCard: React.FC<{ club: ClubRow; onPress: () => void }> = ({
  club,
  onPress,
}) => {
  const theme = useTheme();
  const isClosed = club.status === 'closed';
  const meta = club.daily_pages
    ? `하루 ${club.daily_pages}p`
    : '진도 미설정';

  return (
    <Pressable
      testID={`club-card-${club.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`모임 ${club.name}`}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing[4],
        },
      ]}
    >
      {/* Cover (.pen MPJTS — brand-200 placeholder) */}
      <View
        style={[
          styles.cover,
          {
            backgroundColor: theme.colors.brand[200],
            borderRadius: theme.radius.sm,
          },
        ]}
      />

      {/* Info vertical frame */}
      <View style={styles.info}>
        <Text
          style={[
            styles.clubTitle,
            { color: theme.colors.text.primary },
          ]}
          numberOfLines={1}
        >
          {club.name}
        </Text>
        <Text
          style={[styles.meta, { color: theme.colors.text.secondary }]}
          numberOfLines={1}
        >
          {meta}
        </Text>
        {isClosed && (
          <Text
            style={[
              styles.status,
              { color: theme.colors.text.tertiary },
            ]}
          >
            종료됨
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — displaySm(22/700/30) 토큰 적용. title uniformity FROZEN.
  title: { ...typography.displaySm },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — ctaLabel(14/600/22) 토큰 적용.
  errorText: {
    ...typography.ctaLabel,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20 },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — ctaLabel(14/600/22) 토큰 적용.
  retryText: { ...typography.ctaLabel },
  list: { flex: 1 },
  listContent: { gap: 16, paddingTop: 4 },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — sectionLabel(13/600/18) 토큰 적용.
  section: { ...typography.sectionLabel },
  emptyCard: { gap: 8 },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — headingMd(18/600/26) 토큰 적용.
  emptyTitle: { ...typography.headingMd },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — bodyMd(14/400/22) 토큰 적용. 원본 weight 누락(400)과 일치.
  emptyHint: { ...typography.bodyMd },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  cover: { width: 60, height: 84 },
  info: { flex: 1, gap: 6, flexDirection: 'column' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — alarmTitle(15/600/21) 토큰 적용.
  clubTitle: { ...typography.alarmTitle },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — caption(12/400/17) 토큰 적용. 원본 weight 누락(400)과 일치.
  meta: { ...typography.caption },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — caption(12/400/17) + fontWeight 600 override. 종료 상태 뱃지 강조.
  status: { ...typography.caption, fontWeight: '600' as const },
  ctaButton: { paddingVertical: 14, alignItems: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — ctaStrong(15/700/21) 토큰 적용. primary CTA 강조 라벨.
  ctaText: { ...typography.ctaStrong },
  createIcon: { alignItems: 'center', justifyContent: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — plusGlyph(26/400/28) 토큰 적용. 헤더 "+" 글리프 전용.
  createIconText: { ...typography.plusGlyph },
});
