/**
 * 프로필 수정 화면 (SPEC-PROFILE-001 REQ-PROF-002/003)
 *
 * nickname / avatar_url 만 수정 가능 (미결정 5.3 임시 방침).
 * email/provider/role 은 수정 UI 에 미노출 (REQ-PROF-002 비고, P6).
 *
 * SPEC-UI-002 준수: 3계층 레이아웃, 카드 패턴, token-only 스타일링.
 *
 * @MX:SPEC SPEC-PROFILE-001
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../src/theme/theme';
import { useSession } from '../../../src/auth/useSession';
import {
  useProfile,
  useUpdateProfile,
  validateProfileInput,
  NICKNAME_MAX_LENGTH,
} from '../../../src/features/profile';

export default function EditScreen(): React.JSX.Element {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const userId = session?.user?.id ?? '';
  const profileQuery = useProfile(userId);
  const updateMutation = useUpdateProfile(userId);

  const [nickname, setNickname] = useState(profileQuery.data?.nickname ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profileQuery.data?.avatar_url ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = (): void => {
    const validation = validateProfileInput({
      nickname,
      avatar_url: avatarUrl || null,
    });
    if (!validation.valid) {
      setError(validation.message ?? '입력값을 확인해 주세요');
      return;
    }
    setError(null);
    updateMutation
      .mutateAsync({ nickname: nickname.trim(), avatar_url: avatarUrl || null })
      .then(() => {
        router.back();
      })
      .catch((e: unknown) => {
        // updateProfile 은 VALIDATION/RLS 등 AppError throw — 사용자에게 메시지 노출
        const message =
          e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.';
        setError(message);
      });
  };

  return (
    <View
      testID="edit-screen"
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
    >
      <View style={styles.header}>
        <Pressable
          testID="edit-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          hitSlop={8}
        >
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            프로필 수정
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing[5],
              borderWidth: 1,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text
            style={[styles.fieldLabel, { color: theme.colors.text.tertiary }]}
          >
            닉네임
          </Text>
          <TextInput
            testID="edit-nickname"
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임"
            placeholderTextColor={theme.colors.text.tertiary}
            maxLength={NICKNAME_MAX_LENGTH}
            style={[
              styles.input,
              {
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.bg.muted,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border.default,
              },
            ]}
            accessibilityLabel="닉네임 입력"
          />

          <Text
            style={[
              styles.fieldLabel,
              { color: theme.colors.text.tertiary, marginTop: 16 },
            ]}
          >
            아바타 URL
          </Text>
          <TextInput
            testID="edit-avatar"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://..."
            placeholderTextColor={theme.colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.bg.muted,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border.default,
              },
            ]}
            accessibilityLabel="아바타 URL 입력"
          />

          {error ? (
            <Text
              testID="edit-error"
              style={[
                styles.errorText,
                { color: theme.colors.semantic.error },
              ]}
            >
              {error}
            </Text>
          ) : null}
        </View>

        <Pressable
          testID="edit-save"
          onPress={handleSave}
          disabled={updateMutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="저장"
          style={[
            styles.saveButton,
            {
              backgroundColor: theme.colors.brand[500],
              borderRadius: theme.radius.md,
              opacity: updateMutation.isPending ? 0.6 : 1,
            },
          ]}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator size="small" color={theme.colors.text.inverse} />
          ) : (
            <Text
              style={[styles.saveText, { color: theme.colors.text.inverse }]}
            >
              저장
            </Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 22, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  card: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  errorText: { fontSize: 13, marginTop: 8 },
  saveButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 15, fontWeight: '700' },
});
