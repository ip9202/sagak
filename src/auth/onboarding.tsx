/**
 * Onboarding Screen
 * SPEC-AUTH-001 — REQ-AUTH-020~024
 *
 * M3 구현 상태:
 * - M3-1 AC-O3/O4/O5: nickname 검증 — 빈 문자열/20자 초과 제출 방지
 * - M3-2 AC-O6: UPDATE nickname만 (avatar null)
 * - M3-3 AC-O7: UPDATE nickname + avatar (placeholder URL)
 * - M3-4 AC-O8/O9: UPDATE 실패 — 에러 표시, 세션 유지, 재시도 가능
 *
 * REQ-AUTH-004: 클라이언트 INSERT 금지 — UPDATE만 수행 (handle_new_user 트리거가 행 생성)
 */
import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from './AuthContext';
import { getSupabaseClient } from '../lib/supabase/client';
import { colors, spacing, typography, radius } from '../theme/tokens';

const NICKNAME_MAX_LENGTH = 20;
const AVATAR_PLACEHOLDER_URL = 'https://example.com/avatar-default.png';
const ERROR_MESSAGE = '저장 중 오류가 발생했습니다. 다시 시도해주세요.';

/**
 * 온보딩 화면 컴포넌트
 *
 * 신규 사용자가 nickname을 입력하고 (선택) avatar를 선택한다.
 * "완료" 탭 시 public.users UPDATE를 수행한 후 refreshProfile()로 AuthContext를 갱신한다.
 *
 * @MX:ANCHOR: [AUTO] 온보딩 프로필 완성 진입점 — useSession, supabase UPDATE, refreshProfile 통합
 * @MX:REASON: fan_in >= 3 예상 (app/(auth)/onboarding, 향후 가드 리다이렉트, 프로필 편집). RLS 통과 UPDATE + refreshProfile 동기화가 여기에 집중되어 있으며 누락 시 isOnboarded 전환이 고장난다.
 */
export function OnboardingScreen(): React.JSX.Element {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('OnboardingScreen must be used within AuthProvider');
  }

  const { user, refreshProfile } = context;
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AC-O3/O4/O5: nickname 유효성 검증 — 1~20자
  const trimmed = nickname.trim();
  const isNicknameValid = trimmed.length >= 1 && trimmed.length <= NICKNAME_MAX_LENGTH;
  const canSubmit = isNicknameValid && !submitting;

  /**
   * AC-O6/O7: 완료 핸들러 — users UPDATE 후 refreshProfile
   *
   * REQ-AUTH-004: INSERT 금지. handle_new_user 트리거가 행을 생성했으므로
   * 클라이언트는 UPDATE만 수행한다.
   */
  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit || !user) return;

    setError(null);
    setSubmitting(true);
    try {
      // @MX:NOTE: [AUTO] Database 제네릭 미적용 상태 — update 인수 타입 단언 필요
      // gen-types 도입 전까지 클라이언트가 기본 타입이라 update() 인수가 never로 추론된다.
      // update query builder를 타입 완화된 형태로 캐스팅하여 런타임 페이로드를 그대로 전달한다.
      const updatePayload = {
        nickname: trimmed,
        avatar_url: avatarUrl,
      };
      const usersTable = getSupabaseClient().from('users') as unknown as {
        update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ data: unknown; error: { message: string } | null }> };
      };
      const { error: updateError } = await usersTable
        .update(updatePayload)
        .eq('id', user.id);

      if (updateError) {
        // AC-O8: RLS 거부 등 서버 에러
        setError(ERROR_MESSAGE);
        return;
      }

      await refreshProfile();
    } catch (err) {
      // AC-O9: 네트워크 에러 등 reject
      // @MX:WARN: [AUTO] 에러 객체 원문 노출 금지 — 친화적 메시지만 UI 표시
      // @MX:REASON: 원시 에러에 RLS 정책 메시지나 토큰 정보가 포함될 수 있어 사용자에게 노출하면 보안/UX 모두 악화된다.
      if (__DEV__) {
        console.error('Onboarding UPDATE 실패:', err);
      } else {
        console.error('Onboarding UPDATE 실패:', err instanceof Error ? err.message : 'Unknown error');
      }
      setError(ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>프로필 설정</Text>

      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder="닉네임을 입력하세요"
        maxLength={NICKNAME_MAX_LENGTH}
        accessibilityLabel="닉네임 입력"
        accessibilityHint="1자에서 20자까지 입력 가능합니다"
      />

      <Text style={styles.helperText}>{trimmed.length}/{NICKNAME_MAX_LENGTH}자</Text>

      <TouchableOpacity
        style={[styles.avatarButton, avatarUrl && styles.avatarButtonSelected]}
        onPress={() => setAvatarUrl(AVATAR_PLACEHOLDER_URL)}
        accessibilityLabel="아바타 선택"
        accessibilityHint="선택하지 않으면 기본 아바타가 사용됩니다"
      >
        <Text style={styles.avatarButtonText}>
          {avatarUrl ? '아바타 선택됨' : '아바타 선택'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityLabel="완료"
        accessibilityRole="button"
      >
        <Text style={styles.submitButtonText}>
          {submitting ? '저장 중...' : '완료'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
    backgroundColor: colors.bg.base,
  },
  title: {
    ...typography.displayMd,
    color: colors.text.primary,
    marginBottom: spacing[6],
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    ...typography.bodyLg,
    color: colors.text.primary,
    backgroundColor: colors.bg.surface,
    marginBottom: spacing[1],
  },
  helperText: {
    ...typography.caption,
    color: colors.text.tertiary,
    alignSelf: 'flex-end',
    marginBottom: spacing[5],
  },
  avatarButton: {
    width: '100%',
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    marginBottom: spacing[5],
    backgroundColor: colors.bg.surface,
  },
  avatarButtonSelected: {
    borderColor: colors.border.brand,
  },
  avatarButtonText: {
    ...typography.bodyMd,
    color: colors.text.brand,
  },
  submitButton: {
    width: '100%',
    paddingVertical: spacing[4],
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.brand[500],
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    ...typography.headingSm,
    color: colors.text.inverse,
  },
  error: {
    ...typography.bodySm,
    color: colors.semantic.error,
    marginBottom: spacing[4],
  },
});
