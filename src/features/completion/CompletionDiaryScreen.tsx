/**
 * 완독 다이어리 메인 화면 (SPEC-COMPLETION-001, REQ-COMP-001~010)
 *
 * useCompletionReport 훅 + 4개 하위 컴포넌트를 조합하여 상태별 조건부 렌더링.
 *
 * 상태 분기:
 * - loading: 로딩 표시
 * - success: CelebrationHeader + EmotionCurveChart + HighlightList + 총 기록 수 헤더
 * - empty: CelebrationHeader + "기록된 감정이 없어요" + 헤더(0개)
 * - data-error(VALIDATION): "데이터 오류" 메시지 (빈 상태와 구분)
 * - auth(401): "로그인이 필요합니다"
 * - error(NETWORK/retriesExhausted): "완독 리포트를 불러올 수 없어요" + 재시도 버튼 (축하 미표시)
 *
 * 엣지:
 * - 14(멱등성): DB UNIQUE 에 위임, 클라이언트 로직 없음
 * - 16(오프라인): NETWORK 에러 분기로 처리
 * - 17(세션만료): AUTH 분기로 처리
 *
 * @MX:SPEC SPEC-COMPLETION-001
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme/theme';
import { useCompletionReport } from './useCompletionReport';
import { CelebrationHeader } from './CelebrationHeader';
import { EmotionCurveChart } from './EmotionCurveChart';
import { HighlightList } from './HighlightList';

export interface CompletionDiaryScreenProps {
  userBookId: string;
}

/**
 * 완독 다이어리 화면을 렌더링한다 (REQ-COMP-001~010).
 */
export function CompletionDiaryScreen({
  userBookId,
}: CompletionDiaryScreenProps): React.ReactElement {
  const theme = useTheme();
  const { status, data, refetch } = useCompletionReport(userBookId);

  if (status === 'loading') {
    return (
      <View
        testID="completion-loading"
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>
          완독 리포트를 불러오는 중…
        </Text>
      </View>
    );
  }

  if (status === 'data-error') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
        <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
          데이터 오류가 발생했어요
        </Text>
      </View>
    );
  }

  if (status === 'auth') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
        <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
          로그인이 필요합니다
        </Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
        <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
          완독 리포트를 불러올 수 없어요
        </Text>
        <Pressable
          testID="completion-retry"
          style={[styles.retryButton, { borderColor: theme.colors.brand[500] }]}
          onPress={() => {
            void refetch();
          }}
        >
          <Text style={[styles.retryText, { color: theme.colors.brand[500] }]}>
            다시 시도
          </Text>
        </Pressable>
      </View>
    );
  }

  // status === 'success' | 'empty'
  const isEmpty = status === 'empty';
  const total = data?.total_records ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.base }]}>
      <CelebrationHeader />
      <Text style={[styles.totalHeader, { color: theme.colors.text.secondary }]}>
        이 책에서 남긴 감정 {total}개
      </Text>
      {isEmpty ? (
        <Text style={[styles.emptyText, { color: theme.colors.text.tertiary }]}>
          기록된 감정이 없어요
        </Text>
      ) : (
        <>
          <EmotionCurveChart points={data?.emotion_curve ?? []} />
          <HighlightList highlights={data?.highlights ?? []} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalHeader: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
