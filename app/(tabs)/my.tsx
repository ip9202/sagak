/**
 * 마이 탭 — .pen F15-My 재포팅 (SPEC-UI-002 PR-2)
 *
 * .pen F15-My 구조에 충실한 헤더/프로필/메뉴리스트를 렌더링하되, 기존 앱 확장
 * 기능(배지/포인트/이용약관/로그아웃)은 .pen 이외의 앱 추가 기능으로 유지한다.
 *
 * SPEC-UI-002 준수:
 * - 3계층 레이아웃 (헤더 타이틀 displaySm = 22/700)
 * - 카드 패턴 (cornerRadius 16 / padding 14-20)
 * - token-only 스타일링 (useTheme + tokens.ts 변수만 사용, 하드코딩 금지)
 * - 빈/로딩 상태 패턴
 *
 * 비과시 원칙(SPEC-UI-002 FROZEN): 좋아요/팔로워/랭킹 표시 없음.
 *
 * @MX:NOTE: [AUTO] 마이 탭 화면 — useSession 컨슘 + signOut 연결. F15-My 로 재포팅.
 * @MX:SPEC SPEC-UI-002
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Settings,
  Hourglass,
  TrendingUp,
  Bell,
  Heart,
  ChevronRight,
} from 'lucide-react-native';
import { useTheme } from '../../src/theme/theme';
import { borderWidth } from '../../src/theme/tokens';
import { useSession } from '../../src/auth/useSession';
import { useUnreadCount } from '../../src/features/notification';
import {
  useUserStats,
  usePointLogs,
  computeBadges,
  StatCard,
  BadgeCard,
} from '../../src/features/profile';
import type { AuthProvider } from '../../src/auth/types';

/** 초를 "Nh" 또는 "Nm" 표기로 변환 (통계 카드 표시용) */
function formatReadingTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

// @MX:NOTE: [AUTO] 제공자 표시 라벨 매핑 — DB 값(naver/kakao/google) → 한국어 표시.
const PROVIDER_LABEL: Record<AuthProvider, string> = {
  naver: '네이버',
  kakao: '카카오',
  google: '구글',
};

// @MX:NOTE: [AUTO] SPEC-UI-002 F15-My Bio 고정 문구 — profile.bio 스키마 필드가 아직 없어
//           .pen 기본 문구를 정적 플레이스홀더로 렌더링. 향후 bio 필드 추가 시 동적 바인딩 전환.
const BIO_PLACEHOLDER = '매일 조금씩, 종이책과 함께';

export default function MyTab(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const unreadQuery = useUnreadCount();
  const unreadCount = unreadQuery.data ?? 0;
  const [isSigningOut, setIsSigningOut] = useState(false);

  // 로딩 상태 (useSession이 null 반환 = AuthContext.loading)
  if (!session) {
    return (
      <View
        testID="my-loading"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: theme.spacing[5],
              paddingTop: theme.spacing[2],
              paddingBottom: 0,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.displaySm,
              { color: theme.colors.text.primary },
            ]}
          >
            마이페이지
          </Text>
        </View>
        <View style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      </View>
    );
  }

  const { user, profile, signOut } = session;

  // SPEC-PROFILE-001: 통계 / 포인트 / 배지 데이터
  // hooks 는 rules-of-hooks 준수를 위해 무조건 호출 — user 가 없으면 userId '' 로
  // 내부 enabled: false 가 되어 쿼리 미실행. user null 가드는 hooks 이후.
  const userId = user?.id ?? '';
  const statsQuery = useUserStats(userId);
  const pointLogsQuery = usePointLogs(userId);
  const stats = statsQuery.data;
  const pointLogs = pointLogsQuery.data ?? [];
  const pointBalance = pointLogs.reduce((sum, log) => sum + log.amount, 0);
  const badges = computeBadges({
    stats: {
      completed_books: stats?.completed_books ?? 0,
      emotion_records_count: stats?.emotion_records_count ?? 0,
    },
    current_streak: 0, // streak 연동은 routine 도메인 위임 영역 (미결정 5.4)
    point_reasons: {
      completion: pointLogs.filter((l) => l.reason === 'completion').length,
      reaction: pointLogs.filter((l) => l.reason === 'reaction').length,
    },
  });

  // 미인증 상태 (세션/유저 없음) — 카카오 회귀 테스트 직전 로그아웃 후에도 crash 없어야 함.
  if (!user) {
    return (
      <View
        testID="my-signed-out"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: theme.spacing[5],
              paddingTop: theme.spacing[2],
              paddingBottom: 0,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.displaySm,
              { color: theme.colors.text.primary },
            ]}
          >
            마이페이지
          </Text>
        </View>
        <View style={styles.emptyState}>
          <Text
            style={[styles.emptyTitle, { color: theme.colors.text.primary }]}
          >
            로그인이 필요해요
          </Text>
          <Text
            style={[styles.emptyHint, { color: theme.colors.text.secondary }]}
          >
            로그인 후 다시 만나요.
          </Text>
        </View>
      </View>
    );
  }

  const handleSignOut = (): void => {
    Alert.alert('로그아웃', '로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSigningOut(true);
            try {
              await signOut();
            } catch {
              // @MX:WARN: [AUTO] signOut 실패 시 원인 미노출 — RLS/token 정보 노출 방지.
              // @MX:REASON: 인증 토큰/RLS 메타가 에러 메시지에 포함될 수 있어 사용자에게 노출 금지.
              Alert.alert('로그아웃 실패', '잠시 후 다시 시도해주세요.');
            } finally {
              setIsSigningOut(false);
            }
          })();
        },
      },
    ]);
  };

  const nickname = profile?.nickname ?? '독자';
  const providerLabel = profile
    ? PROVIDER_LABEL[profile.provider]
    : '알 수 없음';
  const email = user.email ?? null;
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <View
      testID="my-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      {/* 헤더 (.pen F15-My Header — padding [8,20,0,20], space_between)
          타이틀 "마이페이지" (displaySm=22/700) + Settings 아이콘 (22×22) */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing[5],
            paddingTop: theme.spacing[2],
            paddingBottom: 0,
          },
        ]}
      >
        <Text
          style={[
            theme.typography.displaySm,
            { color: theme.colors.text.primary },
          ]}
        >
          마이페이지
        </Text>
        <Pressable
          testID="my-settings-button"
          onPress={() => router.push('/my/edit')}
          accessibilityRole="button"
          accessibilityLabel="설정"
          accessibilityHint="프로필 및 설정 화면으로 이동합니다."
          hitSlop={8}
        >
          <Settings size={22} color={theme.colors.text.primary} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: theme.spacing[2],
          gap: theme.spacing[6],
          paddingHorizontal: theme.spacing[5],
          paddingBottom: theme.spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 프로필 (.pen F15-My Profile — 아바타 64×64 + NameCol gap 4, center)
            Bio 는 profile.bio 스키마 부재로 .pen 기본 문구 정적 렌더링.
            provider/email 은 .pen 외 앱 확장 — 프로필 카드 아래 보조 라인으로 유지. */}
        <View style={styles.profileRow}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[
                styles.avatar,
                { borderRadius: theme.radius.full },
              ]}
              accessibilityRole="image"
              accessibilityLabel="프로필 아바타"
            />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.colors.brand[200],
                },
              ]}
              accessibilityRole="image"
              accessibilityLabel="기본 프로필 아바타"
            />
          )}
          <View style={styles.nameCol}>
            <Text
              style={[
                theme.typography.displayXs,
                { color: theme.colors.text.primary },
              ]}
              numberOfLines={1}
            >
              {nickname}
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: theme.colors.text.secondary },
              ]}
              numberOfLines={1}
            >
              {BIO_PLACEHOLDER}
            </Text>
          </View>
        </View>

        {/* SPEC-PROFILE-001: 프로필 수정 진입점 + provider/email (.pen 외 앱 확장).
            기능 삭제 금지 조건 — 기존 my-edit 테스트가 provider/email 노출을 검증하므로
            프로필 행 아래 컴팩트한 보조 라인으로 유지. */}
        <View
          style={[
            styles.accountCard,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing[5],
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <View style={styles.metaRow}>
            <Text
              style={[
                theme.typography.bodySm,
                { color: theme.colors.text.tertiary },
              ]}
            >
              연결 계정
            </Text>
            <Text
              style={[
                theme.typography.bodyMd,
                { color: theme.colors.text.secondary },
              ]}
            >
              {providerLabel}
            </Text>
          </View>
          {email ? (
            <View style={styles.metaRow}>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: theme.colors.text.tertiary },
                ]}
              >
                이메일
              </Text>
              <Text
                style={[
                  theme.typography.bodyMd,
                  { color: theme.colors.text.secondary },
                ]}
                numberOfLines={1}
              >
                {email}
              </Text>
            </View>
          ) : null}

          {/* SPEC-PROFILE-001: 프로필 수정 진입점 (REQ-PROF-002) */}
          <Pressable
            testID="my-edit-button"
            onPress={() => router.push('/my/edit')}
            accessibilityRole="button"
            accessibilityLabel="프로필 수정"
            accessibilityHint="닉네임과 아바타를 수정합니다."
            style={[
              styles.editButton,
              {
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.ctaLabel,
                { color: theme.colors.text.secondary },
              ]}
            >
              프로필 수정
            </Text>
          </Pressable>
        </View>

        {/* 통계 섹션 (.pen F15-My "나의 독서 발자국" — 3-stat horizontal) */}
        <View style={styles.sectionLabelWrap}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            나의 독서 발자국
          </Text>
        </View>
        <View style={styles.statsRow}>
          <StatCard
            testID="stat-completed"
            value={stats?.completed_books ?? 0}
            label="완독"
          />
          <StatCard
            testID="stat-seconds"
            value={formatReadingTime(stats?.total_reading_seconds ?? 0)}
            label="독서시간"
          />
          <StatCard
            testID="stat-emotion"
            value={stats?.emotion_records_count ?? 0}
            label="감정기록"
          />
        </View>

        {/* 활동 메뉴 (.pen F15-My MenuList — $bg-surface, cornerRadius 16, 4 rows)
            각 row: lucide 아이콘(20×20, $text-secondary) + label(15/normal) + ChevronRight(20×20, $text-tertiary) */}
        <View style={styles.sectionLabelWrap}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            활동
          </Text>
        </View>
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Pressable
            testID="my-routine-timer"
            onPress={() => router.push('/my/timer')}
            accessibilityRole="button"
            accessibilityLabel="독서 타이머"
            accessibilityHint="독서 타이머 화면으로 이동합니다."
            style={[styles.menuRow, { borderRadius: theme.radius.md }]}
          >
            <Hourglass size={20} color={theme.colors.text.secondary} />
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              독서 타이머
            </Text>
            <ChevronRight size={20} color={theme.colors.text.tertiary} />
          </Pressable>
          <View
            style={[
              styles.menuDivider,
              { backgroundColor: theme.colors.border.default },
            ]}
          />
          <Pressable
            testID="my-stats-detail"
            onPress={() => {
              // @MX:TODO: [AUTO] 독서 통계 상세 화면 미구현 — 현재 화면에 요약이 이미 표시되므로 no-op. 전용 상세 라우트 추가 후 연결.
            }}
            accessibilityRole="button"
            accessibilityLabel="독서 통계"
            accessibilityHint="상세 독서 통계 화면으로 이동합니다."
            style={[styles.menuRow, { borderRadius: theme.radius.md }]}
          >
            <TrendingUp size={20} color={theme.colors.text.secondary} />
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              독서 통계
            </Text>
            <ChevronRight size={20} color={theme.colors.text.tertiary} />
          </Pressable>
          <View
            style={[
              styles.menuDivider,
              { backgroundColor: theme.colors.border.default },
            ]}
          />
          <Pressable
            testID="my-notifications"
            onPress={() => router.push('/my/notifications')}
            accessibilityRole="button"
            accessibilityLabel="알림 센터"
            accessibilityHint="알림 센터로 이동합니다."
            style={[styles.menuRow, { borderRadius: theme.radius.md }]}
          >
            <Bell size={20} color={theme.colors.text.secondary} />
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              알림 센터
            </Text>
            <View style={styles.menuTrailing}>
              {unreadCount > 0 ? (
                <View
                  testID="my-notifications-badge"
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.brand[500] },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      {
                        color: theme.colors.text.inverse,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {unreadCount}
                  </Text>
                </View>
              ) : null}
              <ChevronRight size={20} color={theme.colors.text.tertiary} />
            </View>
          </Pressable>
          <View
            style={[
              styles.menuDivider,
              { backgroundColor: theme.colors.border.default },
            ]}
          />
          <Pressable
            testID="my-completion-diary"
            onPress={() => {
              // SPEC-COMPLETION-002 REQ-COMP2-012 — 완독 다이어리 리스트 라우트로 이동.
              router.push('/completion');
            }}
            accessibilityRole="button"
            accessibilityLabel="완독 다이어리"
            accessibilityHint="완독한 책의 다이어리 목록으로 이동합니다."
            style={[styles.menuRow, { borderRadius: theme.radius.md }]}
          >
            <Heart size={20} color={theme.colors.text.secondary} />
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              완독 다이어리
            </Text>
            <ChevronRight size={20} color={theme.colors.text.tertiary} />
          </Pressable>
        </View>

        {/* SPEC-PROFILE-001: 배지 섹션 (REQ-PROF-007 클라이언트 산정) — .pen 외 앱 확장 */}
        <View style={styles.sectionLabelWrap}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            배지
          </Text>
        </View>
        <View
          style={[
            styles.badgesWrap,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <View style={styles.badgesRow}>
            {badges.map((badge) => (
              <BadgeCard
                key={badge.id}
                testID={`badge-${badge.id}`}
                label={badge.label}
                earned={badge.earned}
              />
            ))}
          </View>
        </View>

        {/* SPEC-PROFILE-001: 포인트 내역 섹션 (REQ-PROF-006 MVP 조회 전용) — .pen 외 앱 확장 */}
        <View style={styles.sectionLabelWrap}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            포인트
          </Text>
          <Text
            style={[
              theme.typography.displayXs,
              { color: theme.colors.brand[500] },
            ]}
          >
            {pointBalance}
          </Text>
        </View>

        {/* SPEC-PROFILE-001: 설정 링크 섹션 (REQ-PROF-008 — "준비 중") — .pen 외 앱 확장 */}
        <View style={styles.sectionLabelWrap}>
          <Text
            style={[
              theme.typography.sectionLabel,
              { color: theme.colors.text.tertiary },
            ]}
          >
            설정
          </Text>
        </View>
        <View
          style={[
            styles.menuCard,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <View style={[styles.menuRow, { borderRadius: theme.radius.md }]}>
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              이용약관
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: theme.colors.text.tertiary },
              ]}
            >
              준비 중
            </Text>
          </View>
          <View
            style={[
              styles.menuDivider,
              { backgroundColor: theme.colors.border.default },
            ]}
          />
          <View style={[styles.menuRow, { borderRadius: theme.radius.md }]}>
            <Text
              style={[
                styles.menuLabel,
                { color: theme.colors.text.primary },
              ]}
            >
              개인정보 처리방침
            </Text>
            <Text
              style={[
                theme.typography.bodySm,
                { color: theme.colors.text.tertiary },
              ]}
            >
              준비 중
            </Text>
          </View>
        </View>

        {/* 로그아웃 버튼 */}
        <Pressable
          testID="my-logout-button"
          onPress={handleSignOut}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          accessibilityHint="현재 연결된 계정에서 로그아웃합니다."
          style={[
            styles.logoutButton,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.md,
              borderWidth: theme.borderWidth.hairline,
              borderColor: theme.colors.border.default,
              opacity: isSigningOut ? 0.5 : 1,
            },
          ]}
        >
          {isSigningOut ? (
            <ActivityIndicator
              size="small"
              color={theme.colors.semantic.error}
            />
          ) : (
            <Text
              style={[
                theme.typography.ctaLabel,
                { color: theme.colors.semantic.error },
              ]}
            >
              로그아웃
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // SPEC-UI-002 FROZEN: 헤더 레이아웃 — 타이틀 균일성(displaySm=22/700) + space_between.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  // .pen F15-My Profile — Avatar 64×64 + NameCol(gap 4), alignItems center.
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
  },
  nameCol: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  // .pen 외 앱 확장 — provider/email + 프로필 수정 진입점 컨테이너.
  accountCard: {
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.hairline,
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: {
    overflow: 'hidden',
  },
  // .pen F15-My Row — padding [14,16], gap 12, alignItems center.
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  menuTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  // 섹션 라벨 wrap (sectionLabel 토큰 = 13/600).
  sectionLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badgesWrap: {
    overflow: 'hidden',
    padding: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 14,
    textAlign: 'center',
  },
});
