/**
 * SPEC-CLUB-002 M4 ClubsScreen (모임 목록 UI)
 *
 * 사용자가 host 인 모임 목록을 표시한다. useHostClubs(userId) 로 HostClubWithCount[] 조회.
 * F11-Clubs Pencil 디자인(.pen ELyXX) 기반:
 * - Header: Title "모임"(fontSize 22/weight 700) + Icons(search 22 + plus 24, gap 12)
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
 * 모임 카드는 독서 컨텍스트(이름, 진도 메타, 멤버 수, 상태)만 표시한다.
 * 멤버 수 표시는 과시(랭킹/좋아요)가 아닌 모임 운영 컨텍스트(참여 인원)이므로 허용된다.
 *
 * @MX:NOTE: [AUTO] 모임 목록 화면 — useHostClubs(멤버 수 집계 포함) + ClubCard + NewClubCTA + 상태 패턴. 비과시 원칙 준수.
 * @MX:SPEC SPEC-CLUB-002
 * @MX:SPEC SPEC-UI-002
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
// @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 — 헤더 아이콘을 lucide-react-native 로 이관 (Feather text "+" → lucide Search/Plus). 빈 상태 Users 아이콘 추가.
import { Search, Plus, Users } from 'lucide-react-native';
import { useTheme } from '../../../../theme/theme';
import { typography, spacing } from '../../../../theme/tokens';
import { useHostClubs } from '../hooks';
import type { HostClubWithCount } from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';

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
        {/* .pen k32Fv Header Icons(gap 12): search(22, text.primary) + plus(24, brand-500). */}
        <View style={styles.headerIcons}>
          <Pressable
            testID="clubs-search-button"
            onPress={() => router.push('/search')}
            accessibilityRole="button"
            accessibilityLabel="모임 검색"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {/* .pen ocxFV — search 아이콘. /search 라우트(검색 탭)로 이동. */}
            <Search size={22} color={theme.colors.text.primary} />
          </Pressable>
          <Pressable
            testID="clubs-create-button"
            onPress={onCreateClub}
            accessibilityRole="button"
            accessibilityLabel="새 모임 만들기"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {/* .pen K54AFO — plus 아이콘 (모임 생성 入口). lucide Plus 24×24 brand-500. */}
            <Plus size={24} color={theme.colors.brand[500]} />
          </Pressable>
        </View>
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
              {/* .pen F11-Clubs-Empty / EmptyState: Icon(48, text.tertiary). EmptyState 기본은 book-open 이나 clubs 컨텍스트에서는 users 오버라이드. */}
              <Users size={48} color={theme.colors.text.tertiary} />
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
 * 모임 카드 메타 라인 포맷 (.pen TI83b Meta — "2주 코스 · 하루 20p").
 * duration_days 가 14일 이상이면 주 단위, 미만이면 일 단위로 코스 기간을 표시.
 * duration_days 가 null 이면 코스 기간은 생략. daily_pages 가 null 이면 "하루 Np" 생략.
 * 둘 다 없으면 "진도 미설정".
 */
function formatClubMeta(club: HostClubWithCount): string {
  const parts: string[] = [];
  const duration = club.duration_days;
  if (duration != null) {
    if (duration >= 14) {
      const weeks = Math.round(duration / 7);
      parts.push(`${weeks}주 코스`);
    } else {
      parts.push(`${duration}일 코스`);
    }
  }
  if (club.daily_pages != null) {
    parts.push(`하루 ${club.daily_pages}p`);
  }
  return parts.length > 0 ? parts.join(' · ') : '진도 미설정';
}

/**
 * 모임 카드 (.pen zlR3h/g0Y6M — Cover 60×84 brand-200 cornerRadius 6 + Info vertical).
 * 비과시 원칙: 좋아요/팔로워/랭킹 표시 없음. 이름/코스 메타/멤버 수/진도/상태만.
 * 멤버 수는 useHostClubs 의 embedded count 집계 결과(member_count) 사용.
 * 진도는 get_host_clubs_progress RPC 의 median 집계 결과 (SPEC-CLUB-003).
 */
const ClubCard: React.FC<{
  club: HostClubWithCount;
  onPress: () => void;
}> = ({ club, onPress }) => {
  const theme = useTheme();
  const isClosed = club.status === 'closed';
  const meta = formatClubMeta(club);
  const memberCount = club.member_count ?? 0;
  const medianPage = club.median_page ?? 0;
  const progressTotalPages = club.progress_total_pages ?? null;
  const memberCountWithProgress = club.member_count_with_progress ?? 0;

  return (
    <Pressable
      testID={`club-card-${club.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`모임 ${club.name}, 멤버 ${memberCount}명`}
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
        {/* 멤버 수 (.pen RmILS Progress 의 Pct 일부 — "멤버 N명"). 단일 라인 표시. */}
        <Text
          style={[styles.memberCount, { color: theme.colors.text.tertiary }]}
          numberOfLines={1}
        >
          멤버 {memberCount}명
        </Text>
        {/* 진도 표시 (.pen RmILS Progress — Track/Fill + Pct "p.X · 진도 N명").
         * SPEC-CLUB-003 REQ-CLUBC-010~013. median 집계만 (비과시: 개인 비교 금지). */}
        <ClubProgress
          clubId={club.id}
          medianPage={medianPage}
          memberCountWithProgress={memberCountWithProgress}
          progressTotalPages={progressTotalPages}
        />
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

/**
 * 모임 진도 표시 (.pen RmILS/ZT8jr Progress — vertical frame, gap 4, padding-top 4).
 *
 * 분기 (SPEC-CLUB-003 REQ-CLUBC-010~013):
 * - median_page > 0 + total_pages > 0 → Track(bg-muted) + Fill(brand-500, width=median/total clamp 100%) + Pct 텍스트
 * - median_page > 0 + total_pages null/0 → Pct 텍스트만 (바 생략)
 * - median_page == 0 (진도 입력 멤버 없음 / RPC degradation) → "아직 진도가 없어요" 대체, 바 없음
 *
 * 비과시 원칙 (REQ-CLUBC-016): median 페이지 + 진도 입력 멤버 수만 표시.
 * 개인 진도/랭킹/순위 표시 없음.
 *
 * @MX:SPEC SPEC-CLUB-003
 * @MX:SPEC SPEC-UI-002
 */
const ClubProgress: React.FC<{
  clubId: string;
  medianPage: number;
  memberCountWithProgress: number;
  progressTotalPages: number | null;
}> = ({ clubId, medianPage, memberCountWithProgress, progressTotalPages }) => {
  const theme = useTheme();
  const hasProgress = medianPage > 0;
  const hasBar =
    hasProgress &&
    typeof progressTotalPages === 'number' &&
    progressTotalPages > 0;
  // @MX:NOTE: [AUTO] .pen h9CTb Track height=4/cornerRadius=2 — 4px 높이 바에서
  //           radius.full(9999) 은 시각적으로 cornerRadius 2 와 동일(알약형). token-only 준수.
  const fillPct =
    hasBar && progressTotalPages
      ? Math.min((medianPage / progressTotalPages) * 100, 100)
      : 0;

  return (
    <View style={styles.progress}>
      {hasBar && (
        <View
          testID={`club-progress-track-${clubId}`}
          style={[
            styles.progressTrack,
            {
              backgroundColor: theme.colors.bg.muted,
              borderRadius: theme.radius.full,
            },
          ]}
        >
          <View
            testID={`club-progress-fill-${clubId}`}
            style={{
              width: `${fillPct}%`,
              height: theme.spacing[1],
              backgroundColor: theme.colors.brand[500],
              borderRadius: theme.radius.full,
            }}
          />
        </View>
      )}
      <Text
        style={[styles.progressPct, { color: theme.colors.text.tertiary }]}
        numberOfLines={1}
      >
        {hasProgress
          ? `p.${medianPage} · 진도 ${memberCountWithProgress}명`
          : '아직 진도가 없어요'}
      </Text>
    </View>
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
  // .pen k32Fv Header Icons: gap 12
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyCard: { gap: 8, alignItems: 'center' },
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
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — .pen Pct(11/500) 멤버 수 라인. label 토큰(11/500/14) 적용.
  memberCount: { ...typography.label },
  // @MX:NOTE: [AUTO] SPEC-CLUB-003 — .pen RmILS Progress (vertical, gap 4, padding-top 4).
  progress: { gap: spacing[1], paddingTop: spacing[1] },
  // @MX:NOTE: [AUTO] SPEC-CLUB-003 — .pen h9CTb Track (height 4, fill bg-muted).
  progressTrack: { width: '100%', height: spacing[1] },
  // @MX:NOTE: [AUTO] SPEC-CLUB-003 — .pen Joxxl/K0dmFA Pct (11/500) 텍스트. label 토큰 적용.
  progressPct: { ...typography.label },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — caption(12/400/17) + fontWeight 600 override. 종료 상태 뱃지 강조.
  status: { ...typography.caption, fontWeight: '600' as const },
  ctaButton: { paddingVertical: 14, alignItems: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — ctaStrong(15/700/21) 토큰 적용. primary CTA 강조 라벨.
  ctaText: { ...typography.ctaStrong },
});
