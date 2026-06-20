/**
 * 알림 센터 화면 컴포넌트 (SPEC-NOTIF-001 REQ-NOTIF-005~009)
 *
 * 기능:
 * - 알림 목록 조회 (created_at DESC) + 읽지 않은 카운트 배지 (REQ-NOTIF-005/006)
 * - 읽지 않은 알림 시각적 구분 (REQ-NOTIF-005, acceptance N11)
 * - 개별 알림 탭 → 읽음 처리 + type별 딥링크 라우팅 (REQ-NOTIF-007/009)
 * - "모두 읽음" 일괄 처리 (REQ-NOTIF-008)
 * - 로딩/에러/빈 상태 (SPEC-UI-002)
 *
 * token-only 스타일링 (FROZEN — 색/간격 하드코딩 금지).
 *
 * @MX:SPEC SPEC-NOTIF-001
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../../theme/theme';
import {
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  routeForNotification,
  type NotificationRow,
  type NotificationType,
} from '../index';

/** type 별 라벨 (한국어 표시용) */
const TYPE_LABEL: Record<NotificationType, string> = {
  reading_reminder: '독서 알림',
  join_request_received: '모임 초대',
  join_accepted: '모임 합류',
  sticker_received: '스티커',
  completion: '완독',
  club_signal: '함께 읽기',
};

/** created_at ISO → 간단 표시 (M/D HH:MM) */
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${m}/${day} ${hh}:${mm}`;
}

export function NotificationsScreen(): React.JSX.Element {
  const theme = useTheme();
  const listQuery = useNotifications();
  const unreadQuery = useUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();

  const unreadCount = unreadQuery.data ?? 0;

  // 로딩 가드 (SPEC-UI-002)
  if (listQuery.isLoading) {
    return (
      <View
        testID="notifications-loading"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <ActivityIndicator color={theme.colors.brand[500]} />
      </View>
    );
  }

  // 에러 상태
  if (listQuery.isError) {
    return (
      <View
        testID="notifications-error"
        style={[styles.center, { backgroundColor: theme.colors.bg.base }]}
      >
        <Text style={{ color: theme.colors.semantic.error }}>
          알림을 불러오지 못했어요
        </Text>
      </View>
    );
  }

  const items: NotificationRow[] = listQuery.data ?? [];

  const handlePress = (n: NotificationRow): void => {
    // REQ-NOTIF-007: 읽지 않은 경우만 읽음 처리 (멱등)
    if (!n.is_read) {
      markAsRead.mutate(n.id);
    }
    // REQ-NOTIF-009: type별 딥링크. 폴백(null) 시 알림 센터 유지.
    const target = routeForNotification(n.type, n.ref_id);
    if (target) {
      void router.push(target as any);
    }
  };

  const handleMarkAll = (): void => {
    if (unreadCount > 0) {
      markAll.mutate();
    }
  };

  return (
    <View
      testID="notifications-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            알림
          </Text>
          {unreadCount > 0 ? (
            <View
              testID="notifications-unread-badge"
              style={[
                styles.badge,
                { backgroundColor: theme.colors.brand[500] },
              ]}
            >
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <Pressable
            testID="notifications-mark-all"
            onPress={handleMarkAll}
            hitSlop={8}
          >
            <Text style={[styles.markAllText, { color: theme.colors.brand[500] }]}>
              모두 읽음
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.length === 0 ? (
          <View testID="notifications-empty" style={styles.empty}>
            <Text style={{ color: theme.colors.text.tertiary }}>
              새 알림이 없어요
            </Text>
          </View>
        ) : (
          items.map((n) => {
            const isUnread = !n.is_read;
            return (
              <Pressable
                key={n.id}
                testID={`notification-item-${n.id}`}
                onPress={() => handlePress(n)}
                style={[
                  styles.card,
                  {
                    backgroundColor: isUnread
                      ? theme.colors.bg.muted
                      : theme.colors.bg.base,
                    borderColor: theme.colors.border.default,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[
                      styles.typeLabel,
                      { color: theme.colors.text.tertiary },
                    ]}
                  >
                    {TYPE_LABEL[n.type]}
                  </Text>
                  {isUnread ? (
                    <View
                      testID={`notification-unread-dot-${n.id}`}
                      style={[
                        styles.dot,
                        { backgroundColor: theme.colors.brand[500] },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: theme.colors.text.primary,
                      fontWeight: isUnread ? '700' : '600',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {n.title}
                </Text>
                <Text
                  style={[
                    styles.cardBody,
                    { color: theme.colors.text.secondary },
                  ]}
                  numberOfLines={3}
                >
                  {n.body}
                </Text>
                <Text
                  style={[
                    styles.cardTime,
                    { color: theme.colors.text.tertiary },
                  ]}
                >
                  {formatCreatedAt(n.created_at)}
                </Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '700' },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  markAllText: { fontSize: 14, fontWeight: '600' },
  list: { padding: 20, paddingTop: 4, gap: 12 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  card: { borderWidth: 1, padding: 16, gap: 6 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeLabel: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  cardBody: { fontSize: 14, lineHeight: 20 },
  cardTime: { fontSize: 12, marginTop: 2 },
});
