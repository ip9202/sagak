/**
 * SPEC-CLUB-002 M4 ClubCreateScreen (모임 생성 폼)
 *
 * 모임 생성 폼: 모임 이름, 책 ID, 설명, max_members, 진도 계획(daily_pages/trigger_page).
 * 0명 출발 정책 (REQ-CLUBB-003) — max_members 미입력 시 미전달.
 * useCreateClub 은 createClub → verifyHostMembership → updateProgress 2단계 시퀀스.
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 3계층 레이아웃 (Header / Content)
 * - 헤더 타이틀 균일성: fontSize 22 / weight 700 (REQ-SCREEN-010)
 * - 카드/입력 밀도: cornerRadius 16 / padding 16-20 (REQ-SCREEN-020)
 * - 빈/로딩/에러 상태 (REQ-SCREEN-031/032)
 * - token-only 스타일링 (REQ-SCREEN-005)
 *
 * 비과시 원칙: 멤버 수·좋아요 표시 없음.
 *
 * @MX:NOTE: [AUTO] 모임 생성 폼 — useCreateClub 2단계 시퀀스 호출. 필수 필드 검증(name, bookId).
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../../theme/theme';
import { useCreateClub, type ClubFormInput } from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';

export interface ClubCreateScreenProps {
  /** auth.uid() — host_id 주입용 */
  userId: string;
  /** 모임과 연결할 책 ID. 상위 라우트가 선택된 책을 전달한다. */
  bookId: string;
  /** 생성 성공 시 호출. 기본 동작은 상세 화면으로 이동. */
  onCreated?: (clubId: string) => void;
}

/**
 * @MX:ANCHOR: [AUTO] ClubCreateScreen — 모임 생성 폼 화면. 라우팅(app/(tabs)/clubs/new)이 마운트한다.
 * @MX:REASON: ClubsScreen 의 plus/CTA 가 이 화면으로 진입하며, onCreated 계약이 상세 화면 라우팅(clubs/[clubId])으로 이어진다.
 */
export const ClubCreateScreen: React.FC<ClubCreateScreenProps> = ({
  userId,
  bookId,
  onCreated,
}) => {
  const theme = useTheme();
  const router = useRouter();
  const createClub = useCreateClub();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dailyPages, setDailyPages] = useState('');
  const [triggerPage, setTriggerPage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // REQ-CLUBB-003 + REQ-SCREEN-030: 빈 이름도 submit 시도 가능 — 친절한 검증 에러로 안내.
  // bookId 가 없으면 폼 자체가 진입 불가(new.tsx 게이트)이므로 여기서는 isPending 만 비활성화.
  const canSubmit = bookId.length > 0 && !createClub.isPending;

  const handleSubmit = () => {
    setValidationError(null);

    if (name.trim().length === 0) {
      setValidationError('모임 이름을 입력해주세요.');
      return;
    }
    if (bookId.length === 0) {
      setValidationError('책 정보가 없습니다.');
      return;
    }

    const parsedDaily =
      dailyPages.trim().length > 0 ? Number(dailyPages) : undefined;
    const parsedTrigger =
      triggerPage.trim().length > 0 ? Number(triggerPage) : undefined;

    if (
      parsedDaily !== undefined &&
      (!Number.isInteger(parsedDaily) || parsedDaily < 0)
    ) {
      setValidationError('하루 페이지는 0 이상의 정수여야 합니다.');
      return;
    }
    if (
      parsedTrigger !== undefined &&
      (!Number.isInteger(parsedTrigger) || parsedTrigger < 0)
    ) {
      setValidationError('트리거 페이지는 0 이상의 정수여야 합니다.');
      return;
    }

    const input: ClubFormInput = {
      bookId,
      hostId: userId,
      name: name.trim(),
      description: description.trim().length > 0 ? description.trim() : null,
      dailyPages: parsedDaily ?? null,
      triggerPage: parsedTrigger ?? null,
    };

    createClub.mutate(input, {
      onSuccess: (newClub) => {
        if (onCreated) {
          onCreated(newClub.id);
        } else {
          router.replace(`/clubs/${newClub.id}`);
        }
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      >
        {/* 헤더 (REQ-SCREEN-010 타이틀 균일성) */}
        <View style={styles.header}>
          <Pressable
            testID="club-create-back"
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
            새 모임 만들기
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.form}
          contentContainerStyle={[
            styles.formContent,
            { paddingHorizontal: theme.spacing[5] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* 모임 이름 (필수) */}
          <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
            모임 이름
          </Text>
          <TextInput
            testID="club-create-name"
            value={name}
            onChangeText={setName}
            placeholder="예) 함께 읽는 『데미안』"
            placeholderTextColor={theme.colors.text.tertiary}
            accessibilityLabel="모임 이름"
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.md,
                color: theme.colors.text.primary,
              },
            ]}
          />

          {/* 설명 (선택) */}
          <Text
            style={[
              styles.label,
              { color: theme.colors.text.secondary, marginTop: 16 },
            ]}
          >
            설명 (선택)
          </Text>
          <TextInput
            testID="club-create-description"
            value={description}
            onChangeText={setDescription}
            placeholder="모임 소개를 적어보세요"
            placeholderTextColor={theme.colors.text.tertiary}
            accessibilityLabel="모임 설명"
            multiline
            style={[
              styles.input,
              styles.textarea,
              {
                backgroundColor: theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
                borderRadius: theme.radius.md,
                color: theme.colors.text.primary,
              },
            ]}
          />

          {/* 진도 계획 (선택) */}
          <Text
            style={[
              styles.label,
              { color: theme.colors.text.secondary, marginTop: 16 },
            ]}
          >
            진도 계획 (선택)
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
                testID="club-create-daily-pages"
                value={dailyPages}
                onChangeText={setDailyPages}
                placeholder="예) 20"
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="하루 권장 페이지"
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bg.surface,
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
                testID="club-create-trigger-page"
                value={triggerPage}
                onChangeText={setTriggerPage}
                placeholder="예) 100"
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="트리거 페이지"
                keyboardType="number-pad"
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.colors.bg.surface,
                    borderColor: theme.colors.border.default,
                    borderRadius: theme.radius.md,
                    color: theme.colors.text.primary,
                  },
                ]}
              />
            </View>
          </View>

          <Text
            style={[
              styles.hint,
              { color: theme.colors.text.tertiary, marginTop: 8 },
            ]}
          >
            0명 출발도 OK. 나중에 진도를 바꿀 수 있어요.
          </Text>

          {validationError && (
            <Text
              testID="club-create-validation-error"
              style={[
                styles.errorText,
                { color: theme.colors.semantic.error, marginTop: 12 },
              ]}
            >
              {validationError}
            </Text>
          )}

          {createClub.isError && (
            <Text
              testID="club-create-error"
              style={[
                styles.errorText,
                { color: theme.colors.semantic.error, marginTop: 12 },
              ]}
            >
              {getUserFriendlyMessage(createClub.error as AppError)}
            </Text>
          )}
        </ScrollView>

        {/* 생성 버튼 */}
        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: theme.spacing[5],
              paddingBottom: theme.spacing[5],
              borderTopColor: theme.colors.border.default,
            },
          ]}
        >
          <Pressable
            testID="club-create-submit"
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="모임 만들기"
            style={[
              styles.submitButton,
              {
                backgroundColor: canSubmit
                  ? theme.colors.brand[500]
                  : theme.colors.text.disabled,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            {createClub.isPending ? (
              <ActivityIndicator color={theme.colors.text.inverse} />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  { color: theme.colors.text.inverse },
                ]}
              >
                모임 만들기
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  form: { flex: 1 },
  formContent: { paddingTop: 12, paddingBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  subLabel: { fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  hint: { fontSize: 12 },
  errorText: { fontSize: 13, fontWeight: '600' },
  footer: { paddingTop: 12, borderTopWidth: 1 },
  submitButton: { paddingVertical: 14, alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '700' },
});
