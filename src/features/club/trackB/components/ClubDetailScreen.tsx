/**
 * SPEC-CLUB-002 M4 ClubDetailScreen (모임 상세 + host 관리)
 *
 * 모임 정보, 참가자 목록, host 진도 동기화 UI(daily_pages/trigger_page 업데이트),
 * close/reactivate/leave 액션을 제공한다.
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 3계층 레이아웃 (Header / Content)
 * - 헤더 타이틀 균일성: fontSize 22 / weight 700 (REQ-SCREEN-010)
 * - 카드 밀도: cornerRadius 16 / padding 16-20 (REQ-SCREEN-020)
 * - 빈/로딩/에러 상태 (REQ-SCREEN-030/031/032)
 * - token-only 스타일링 (REQ-SCREEN-005)
 *
 * 비과시 원칙: 멤버 수·좋아요 표시 없음. 진도 컨텍스트와 역할(role)만 표시.
 *
 * @MX:NOTE: [AUTO] 모임 상세/관리 화면 — useClubDetail/useClubMembers + host 진도 동기화 + 상태 전환 액션.
 * @MX:SPEC SPEC-CLUB-002
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../theme/theme';
import {
  useClubDetail,
  useClubMembers,
  useCloseClub,
  useLeaveClub,
  useReactivateClub,
  useUpdateProgress,
} from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';

export interface ClubDetailScreenProps {
  /** clubs.id */
  clubId: string;
  /** auth.uid() — host 여부 판별 및 leaveClub 용 */
  userId: string;
}

/**
 * @MX:ANCHOR: [AUTO] ClubDetailScreen — 모임 상세/관리 화면. 라우팅(app/(tabs)/clubs/[clubId])이 마운트한다.
 * @MX:REASON: ClubsScreen 의 카드가 이 화면으로 진입하며, host 진도 동기화와 상태 전환(close/reactivate/leave) 계약이 host/멤버 UX 에 직결된다.
 */
export const ClubDetailScreen: React.FC<ClubDetailScreenProps> = ({
  clubId,
  userId,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const detail = useClubDetail(clubId);
  const members = useClubMembers(clubId);
  const updateProgress = useUpdateProgress();
  const closeClub = useCloseClub();
  const reactivateClub = useReactivateClub();
  const leaveClub = useLeaveClub();

  const club = detail.data;
  const isHost = club?.host_id === userId;
  const isClosed = club?.status === 'closed';

  const [dailyPages, setDailyPages] = useState('');
  const [triggerPage, setTriggerPage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // detail 데이터 도착 시 입력 필드 초기값 세팅 (1회성)
  React.useEffect(() => {
    if (club) {
      setDailyPages(
        club.daily_pages != null ? String(club.daily_pages) : '',
      );
      setTriggerPage(
        club.trigger_page != null ? String(club.trigger_page) : '',
      );
    }
  }, [club?.id, club?.daily_pages, club?.trigger_page]);

  const handleSaveProgress = () => {
    setValidationError(null);
    const parsedDaily =
      dailyPages.trim().length > 0 ? Number(dailyPages) : null;
    const parsedTrigger =
      triggerPage.trim().length > 0 ? Number(triggerPage) : null;

    if (
      parsedDaily !== null &&
      (!Number.isInteger(parsedDaily) || parsedDaily < 0)
    ) {
      setValidationError('하루 페이지는 0 이상의 정수여야 합니다.');
      return;
    }
    if (
      parsedTrigger !== null &&
      (!Number.isInteger(parsedTrigger) || parsedTrigger < 0)
    ) {
      setValidationError('트리거 페이지는 0 이상의 정수여야 합니다.');
      return;
    }

    updateProgress.mutate({
      clubId,
      dailyPages: parsedDaily,
      triggerPage: parsedTrigger,
      status: club?.status,
    });
  };

  const handleClose = () => {
    closeClub.mutate(clubId);
  };
  const handleReactivate = () => {
    reactivateClub.mutate(clubId);
  };
  const handleLeave = () => {
    leaveClub.mutate(
      { clubId, userId },
      {
        onSuccess: () => router.back(),
      },
    );
  };

  if (detail.isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.bg.base },
        ]}
      >
        <View testID="club-detail-loading" style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      </View>
    );
  }

  if (detail.isError || !club) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.colors.bg.base },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            testID="club-detail-back"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.backButton,
              {
                backgroundColor: theme.colors.brand[50],
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text style={styles.backText}>{'‹'}</Text>
          </Pressable>
          <Text
            style={[styles.title, { color: theme.colors.text.primary }]}
          >
            모임
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View testID="club-detail-error" style={styles.bodyCenter}>
          <Text
            style={[
              styles.errorText,
              { color: theme.colors.semantic.error },
            ]}
          >
            {detail.error
              ? getUserFriendlyMessage(detail.error as AppError)
              : '모임을 불러올 수 없습니다.'}
          </Text>
        </View>
      </View>
    );
  }

  const memberList = members.data ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {/* 헤더 (REQ-SCREEN-010 타이틀 균일성) */}
      <View style={styles.header}>
        <Pressable
          testID="club-detail-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.backButton,
            {
              backgroundColor: theme.colors.brand[50],
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          모임
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingHorizontal: theme.spacing[5] },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* 모임 정보 카드 */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing[5],
            },
          ]}
        >
          <Text
            style={[
              styles.clubTitle,
              { color: theme.colors.text.primary },
            ]}
          >
            {club.name}
          </Text>
          {club.description ? (
            <Text
              style={[
                styles.description,
                { color: theme.colors.text.secondary },
              ]}
            >
              {club.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.meta,
                { color: theme.colors.text.tertiary },
              ]}
            >
              {isHost ? '호스트' : '멤버'}
            </Text>
            <Text
              style={[
                styles.meta,
                {
                  color: isClosed
                    ? theme.colors.text.tertiary
                    : theme.colors.text.brand,
                },
              ]}
            >
              {isClosed ? '종료됨' : '진행 중'}
            </Text>
          </View>
        </View>

        {/* host 진도 동기화 UI (host 만, closed 아니어야 함) */}
        {isHost && !isClosed && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.lg,
                padding: theme.spacing[5],
                marginTop: theme.spacing[4],
              },
            ]}
          >
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text.primary },
              ]}
            >
              진도 계획
            </Text>
            <View style={styles.row}>
              <View style={styles.fieldHalf}>
                <Text
                  style={[
                    styles.subLabel,
                    { color: theme.colors.text.tertiary },
                  ]}
                >
                  하루 페이지
                </Text>
                <TextInput
                  testID="club-detail-daily-pages"
                  value={dailyPages}
                  onChangeText={setDailyPages}
                  placeholder="예) 20"
                  placeholderTextColor={theme.colors.text.tertiary}
                  accessibilityLabel="하루 권장 페이지"
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.bg.muted,
                      borderColor: theme.colors.border.default,
                      borderRadius: theme.radius.md,
                      color: theme.colors.text.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text
                  style={[
                    styles.subLabel,
                    { color: theme.colors.text.tertiary },
                  ]}
                >
                  트리거 페이지
                </Text>
                <TextInput
                  testID="club-detail-trigger-page"
                  value={triggerPage}
                  onChangeText={setTriggerPage}
                  placeholder="예) 100"
                  placeholderTextColor={theme.colors.text.tertiary}
                  accessibilityLabel="트리거 페이지"
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.colors.bg.muted,
                      borderColor: theme.colors.border.default,
                      borderRadius: theme.radius.md,
                      color: theme.colors.text.primary,
                    },
                  ]}
                />
              </View>
            </View>

            {validationError && (
              <Text
                testID="club-detail-validation-error"
                style={[
                  styles.errorText,
                  { color: theme.colors.semantic.error, marginTop: 8 },
                ]}
              >
                {validationError}
              </Text>
            )}
            {updateProgress.isError && (
              <Text
                style={[
                  styles.errorText,
                  { color: theme.colors.semantic.error, marginTop: 8 },
                ]}
              >
                {getUserFriendlyMessage(updateProgress.error as AppError)}
              </Text>
            )}

            <Pressable
              testID="club-detail-save-progress"
              onPress={handleSaveProgress}
              disabled={updateProgress.isPending}
              accessibilityRole="button"
              accessibilityLabel="진도 저장"
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: theme.colors.brand[50],
                  borderRadius: theme.radius.md,
                  marginTop: 12,
                  opacity: updateProgress.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  { color: theme.colors.text.brand },
                ]}
              >
                {updateProgress.isPending ? '저장 중…' : '진도 저장'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* 참가자 목록 */}
        <Text
          style={[
            styles.sectionLabel,
            { color: theme.colors.text.tertiary, marginTop: theme.spacing[5] },
          ]}
        >
          참가자
        </Text>
        {members.isLoading ? (
          <ActivityIndicator color={theme.colors.brand[500]} />
        ) : members.isError ? (
          <Text
            style={[
              styles.errorText,
              { color: theme.colors.semantic.error },
            ]}
          >
            {getUserFriendlyMessage(members.error as AppError)}
          </Text>
        ) : memberList.length === 0 ? (
          <Text
            style={[
              styles.emptyText,
              { color: theme.colors.text.secondary },
            ]}
          >
            아직 참가자가 없어요.
          </Text>
        ) : (
          memberList.map((m) => (
            <View
              key={m.id}
              testID={`club-member-${m.user_id}`}
              style={[
                styles.memberRow,
                {
                  backgroundColor: theme.colors.bg.surface,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing[4],
                  marginTop: theme.spacing[2],
                },
              ]}
            >
              <Text
                style={[
                  styles.memberName,
                  { color: theme.colors.text.primary },
                ]}
                numberOfLines={1}
              >
                {m.user_id === userId ? '나' : `독자 ${m.user_id.slice(0, 6)}`}
              </Text>
              <Text
                style={[
                  styles.roleBadge,
                  {
                    color:
                      m.role === 'host'
                        ? theme.colors.text.brand
                        : theme.colors.text.tertiary,
                  },
                ]}
              >
                {m.role === 'host' ? '호스트' : '멤버'}
              </Text>
            </View>
          ))
        )}

        {/* 액션 */}
        <View style={{ marginTop: theme.spacing[6], gap: theme.spacing[2] }}>
          {isHost ? (
            isClosed ? (
              <Pressable
                testID="club-detail-reactivate"
                onPress={handleReactivate}
                disabled={reactivateClub.isPending}
                accessibilityRole="button"
                accessibilityLabel="모임 재활성화"
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: theme.colors.brand[50],
                    borderRadius: theme.radius.md,
                    opacity: reactivateClub.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: theme.colors.text.brand },
                  ]}
                >
                  {reactivateClub.isPending ? '처리 중…' : '모임 다시 열기'}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                testID="club-detail-close"
                onPress={handleClose}
                disabled={closeClub.isPending}
                accessibilityRole="button"
                accessibilityLabel="모임 종료"
                style={[
                  styles.dangerButton,
                  {
                    borderColor: theme.colors.semantic.error,
                    borderRadius: theme.radius.md,
                    opacity: closeClub.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dangerButtonText,
                    { color: theme.colors.semantic.error },
                  ]}
                >
                  {closeClub.isPending ? '처리 중…' : '모임 종료'}
                </Text>
              </Pressable>
            )
          ) : (
            <Pressable
              testID="club-detail-leave"
              onPress={handleLeave}
              disabled={leaveClub.isPending}
              accessibilityRole="button"
              accessibilityLabel="모임 나가기"
              style={[
                styles.dangerButton,
                {
                  borderColor: theme.colors.semantic.error,
                  borderRadius: theme.radius.md,
                  opacity: leaveClub.isPending ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.dangerButtonText,
                  { color: theme.colors.semantic.error },
                ]}
              >
                {leaveClub.isPending ? '처리 중…' : '모임 나가기'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
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
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 22, fontWeight: '700' },
  headerSpacer: { width: 36 },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700)
  title: { fontSize: 22, fontWeight: '700' },
  bodyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 32 },
  card: { gap: 8 },
  clubTitle: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 14 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  meta: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  subLabel: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 14, marginTop: 8 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  roleBadge: { fontSize: 12, fontWeight: '600' },
  secondaryButton: { paddingVertical: 12, alignItems: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '700' },
  dangerButton: { paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  dangerButtonText: { fontSize: 14, fontWeight: '700' },
});
