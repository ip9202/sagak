/**
 * SPEC-CLUB-001 T-012 HostRequestsScreen (M5 — host 응답 UI)
 *
 * host 가 수신한 pending 합류 요청을 승인/거절하는 화면.
 *
 * - fetchIncomingJoinRequests(hostId) 로 수신 요청 조회
 * - useRespondToJoinRequest 로 accepted/declined 전환
 * - terminal 에러(REQ-CLUBA-008): 이미 처리된 요청 시 "이미 처리된 요청입니다" 노출
 * - 빈/로딩/에러 상태 (SPEC-UI-002 REQ-SCREEN-STATE)
 * - token-only 스타일링, 비과시 원칙
 *
 * accepted 후 멤버십 확인(useConfirmMembership)은 요청 카드별 state 로 관측 가능하나,
 * MVP에서는 승인 버튼 비활성화로 충분히 사용자에게 피드백을 준다.
 *
 * @MX:NOTE: [AUTO] host 응답 화면 — 수신 요청 목록 + 승인/거절 + terminal 에러 처리. 비과시 원칙 준수.
 * @MX:SPEC SPEC-CLUB-001
 */
import React, { useEffect, useState } from 'react';
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
import { useRespondToJoinRequest } from '../hooks';
import { fetchIncomingJoinRequests } from '../joinRequestApi';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';
import type { JoinRequestRow, JoinResponseAction } from '../types';

// @MX:ANCHOR: [AUTO] HostRequestsScreen — host 응답 화면 공개 컴포넌트
// @MX:REASON: 라우팅(숨겨진 스택 host-requests.tsx)이 마운트하며, accept/decline 계약과 terminal 에러 매핑이 깨지면 host 가 "승인" 반복 시 의미없는 에러를 보게 된다.
export const HostRequestsScreen: React.FC = () => {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const hostId = session?.user?.id ?? '';
  const respondMutation = useRespondToJoinRequest();

  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 요청별 에러 메시지 (terminal 처리)
  const [perRequestError, setPerRequestError] = useState<Record<string, string>>({});
  // 이미 응답한 요청 id (버튼 비활성화)
  const [responded, setResponded] = useState<Record<string, JoinResponseAction>>({});

  useEffect(() => {
    if (hostId.length === 0) return;
    let active = true;
    setStatus('loading');
    fetchIncomingJoinRequests(hostId)
      .then((rows) => {
        if (!active) return;
        setRequests(rows);
        setStatus('success');
      })
      .catch((e) => {
        if (!active) return;
        setErrorMessage(getUserFriendlyMessage(e as AppError));
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [hostId]);

  const handleRespond = async (requestId: string, action: JoinResponseAction) => {
    setPerRequestError((prev) => {
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
    try {
      await respondMutation.mutateAsync({ requestId, status: action });
      setResponded((prev) => ({ ...prev, [requestId]: action }));
    } catch (e) {
      setPerRequestError((prev) => ({
        ...prev,
        [requestId]: getUserFriendlyMessage(e as AppError),
      }));
    }
  };

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isEmpty = status === 'success' && requests.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          testID="host-requests-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.backButton, { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md }]}
        >
          <Text style={styles.backText}>{'‹'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          받은 요청
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 본문 */}
      {isLoading ? (
        <View testID="host-requests-loading" style={styles.bodyCenter}>
          <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        </View>
      ) : isError ? (
        <View testID="host-requests-error" style={styles.bodyCenter}>
          <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
            {errorMessage ?? '요청을 불러오는 중 오류가 발생했습니다.'}
          </Text>
        </View>
      ) : isEmpty ? (
        <View testID="host-requests-empty" style={styles.bodyCenter}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            받은 요청이 없어요
          </Text>
          <Text style={[styles.emptyHint, { color: theme.colors.text.secondary }]}>
            누군가 같이 읽자고 요청하면 여기에 나타나요.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingHorizontal: theme.spacing[5] }]}
        >
          {requests.map((req) => {
            const done = responded[req.id];
            const reqError = perRequestError[req.id];
            return (
              <View
                key={req.id}
                testID={`host-request-${req.id}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing[5],
                  },
                ]}
              >
                <Text style={[styles.requester, { color: theme.colors.text.primary }]} numberOfLines={1}>
                  {`독자 ${req.requester_id.slice(0, 6)}`}
                </Text>
                {req.message ? (
                  <Text style={[styles.message, { color: theme.colors.text.secondary }]} numberOfLines={3}>
                    {req.message}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: theme.colors.text.tertiary }]}>
                  {req.created_at ? req.created_at.slice(0, 10) : ''}
                </Text>

                {done ? (
                  <View
                    testID={`host-request-done-${req.id}`}
                    style={[styles.doneBox, { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md }]}
                  >
                    <Text style={[styles.doneText, { color: theme.colors.text.brand }]}>
                      {done === 'accepted' ? '승인했어요' : '거절했어요'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Pressable
                      testID={`host-request-decline-${req.id}`}
                      onPress={() => handleRespond(req.id, 'declined')}
                      accessibilityRole="button"
                      accessibilityLabel="거절"
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: theme.colors.bg.muted,
                          borderRadius: theme.radius.md,
                        },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: theme.colors.text.secondary }]}>
                        거절
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`host-request-accept-${req.id}`}
                      onPress={() => handleRespond(req.id, 'accepted')}
                      accessibilityRole="button"
                      accessibilityLabel="승인"
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: theme.colors.brand[500],
                          borderRadius: theme.radius.md,
                          flex: 2,
                        },
                      ]}
                    >
                      <Text style={[styles.actionText, { color: theme.colors.text.inverse }]}>
                        승인
                      </Text>
                    </Pressable>
                  </View>
                )}

                {reqError ? (
                  <View
                    testID={`host-request-error-${req.id}`}
                    style={[styles.errorBox, { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md }]}
                  >
                    <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
                      {reqError}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, fontWeight: '700' },
  // SPEC-UI-002 FROZEN: title uniformity (fontSize 22 / weight 700)
  title: { fontSize: 22, fontWeight: '700' },
  headerSpacer: { width: 36 },
  bodyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 20 },
  errorText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyHint: { fontSize: 14, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: 16, paddingTop: 4, paddingBottom: 24 },
  card: { gap: 8 },
  requester: { fontSize: 16, fontWeight: '600' },
  message: { fontSize: 14 },
  meta: { fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionButton: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: 14, fontWeight: '600' },
  doneBox: { padding: 10, alignItems: 'center' },
  doneText: { fontSize: 13, fontWeight: '600' },
  errorBox: { padding: 10 },
});
