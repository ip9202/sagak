/**
 * SPEC-CLUB-001 T-011 JoinRequestSheet (M4 — 요청 작성 UI)
 *
 * 독자에게 "같이 읽어요" 합류 요청을 작성하는 모달/바텀시트.
 *
 * club_id 분기 (REQ-CLUBA-006):
 * - reader.club_id !== null → useCreateJoinRequest({clubId, requesterId, message})
 * - reader.club_id === null → useCreateJoinRequest({targetUserId, bookId, requesterId, message})
 *   (Edge Function 이 lazy 그룹 생성을 담당)
 *
 * SPEC-UI-002 (FROZEN) 준수:
 * - 카드 밀도 (cornerRadius 16, padding 16-20)
 * - 빈/에러 상태 (message 입력 에러, mutation 에러 노출)
 * - token-only 스타일링
 *
 * 에러 상태 (getUserFriendlyMessage 가 한국어 매핑):
 * - VALIDATION + 23505 → "이미 등록된 항목입니다"
 * - VALIDATION + terminal → "이미 처리된 요청입니다"
 * - VALIDATION + MESSAGE_TOO_LONG → "메시지는 500자 이하여야 합니다"
 * - RLS_DENIED → "접근 권한이 없습니다"
 *
 * @MX:NOTE: [AUTO] 합류 요청 작성 시트 — club_id 분기 + message 500자 제한 + mutation 에러 노출.
 * @MX:SPEC SPEC-CLUB-001
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../../../theme/theme';
import { typography, borderWidth, minHeight } from '../../../../theme/tokens';
import { useSession } from '../../../../auth/useSession';
import { useCreateJoinRequest, type CreateJoinRequestVariables } from '../hooks';
import { getUserFriendlyMessage } from '../../../../lib/api/errors';
import { AppError } from '../../../../errors';
import { MESSAGE_MAX_LENGTH, validateMessageLength } from '../types';
import type { ActiveReader } from '../types';

export interface JoinRequestSheetProps {
  /** 책 컨텍스트 (Edge Function lazy 생성 시 사용) */
  bookId: string;
  /** 합류 대상 독자 */
  reader: ActiveReader;
  /** 닫기 요청 (부모가 모달 언마운트) */
  onClose: () => void;
}

/**
 * @MX:ANCHOR: [AUTO] JoinRequestSheet — 합류 요청 작성 공개 컴포넌트
 * @MX:REASON: ReadersScreen(readers.tsx) 이 마운트하며, club_id 분기 계약과 onClose 호출 계약이 깨지면 요청이 잘못된 경로로 전송되거나 시트가 닫히지 않는다.
 */
export const JoinRequestSheet: React.FC<JoinRequestSheetProps> = ({
  bookId,
  reader,
  onClose,
}) => {
  const theme = useTheme();
  const session = useSession();
  const requesterId = session?.user?.id ?? '';
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = useCreateJoinRequest();

  const lengthError = validateMessageLength(message || null);
  const isOverLimit = lengthError !== null;
  const canSubmit = !isOverLimit && !mutation.isPending && requesterId.length > 0;

  const handleSubmit = async () => {
    setLocalError(null);
    const vars: CreateJoinRequestVariables =
      reader.club_id != null
        ? {
            clubId: reader.club_id,
            requesterId,
            message: message.trim() || null,
          }
        : {
            targetUserId: reader.user_id,
            bookId,
            requesterId,
            message: message.trim() || null,
          };
    try {
      await mutation.mutateAsync(vars);
      onClose();
    } catch (e) {
      setLocalError(getUserFriendlyMessage(e as AppError));
    }
  };

  const mutationError =
    mutation.isError && mutation.error
      ? getUserFriendlyMessage(mutation.error as AppError)
      : null;
  const displayedError = mutationError ?? localError;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="join-sheet-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: theme.colors.bg.overlay }]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              padding: theme.spacing[5],
            },
          ]}
        >
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              같이 읽어요
            </Text>
            <Pressable
              testID="join-sheet-close"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeButton, { backgroundColor: theme.colors.bg.muted, borderRadius: theme.radius.full }]}
            >
              <Text style={[styles.closeText, { color: theme.colors.text.secondary }]}>{'✕'}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body}>
            <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
              메시지 (선택)
            </Text>
            <TextInput
              testID="join-sheet-message-input"
              value={message}
              onChangeText={setMessage}
              placeholder="같이 읽고 싶은 이유를 적어보세요"
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              maxLength={MESSAGE_MAX_LENGTH + 1}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.bg.muted,
                  borderRadius: theme.radius.md,
                  color: theme.colors.text.primary,
                  borderColor: isOverLimit ? theme.colors.semantic.error : theme.colors.border.default,
                },
              ]}
            />
            <Text
              testID="join-sheet-counter"
              style={[
                styles.counter,
                {
                  color: isOverLimit
                    ? theme.colors.semantic.error
                    : theme.colors.text.tertiary,
                },
              ]}
            >
              {isOverLimit
                ? `메시지는 ${MESSAGE_MAX_LENGTH}자 이하여야 합니다`
                : `${message.length}/${MESSAGE_MAX_LENGTH}`}
            </Text>

            {displayedError && (
              <View testID="join-sheet-error" style={[styles.errorBox, { backgroundColor: theme.colors.brand[50], borderRadius: theme.radius.md }]}>
                <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
                  {displayedError}
                </Text>
              </View>
            )}
          </ScrollView>

          <Pressable
            testID="join-sheet-submit"
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="요청 보내기"
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
            <Text style={[styles.submitText, { color: theme.colors.text.inverse }]}>
              {mutation.isPending ? '보내는 중…' : '요청 보내기'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { gap: 12, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — displayXs(18/700/24) 토큰 적용. 요청 시트 타이틀.
  title: { ...typography.displayXs },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — bodyMd(14/400/22) 토큰 적용. 원본 weight 누락(400)과 일치.
  closeText: { ...typography.bodyMd },
  body: { flexGrow: 0 },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — sectionLabel(13/600/18) 토큰 적용.
  label: { ...typography.sectionLabel },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — bodyMd(14/400/22) + minHeight.input + borderWidth.hairline 토큰 적용.
  //           minHeight 96 → minHeight.input(100) 토큰 매핑(token-only FROZEN 우선, 4pt 차이 허용 범위).
  input: { ...typography.bodyMd, minHeight: minHeight.input, padding: 12, borderWidth: borderWidth.hairline, textAlignVertical: 'top' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — caption(12/400/17) 토큰 적용.
  counter: { ...typography.caption, alignSelf: 'flex-end' },
  errorBox: { padding: 12 },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — sectionLabel(13/600/18) 토큰 적용.
  errorText: { ...typography.sectionLabel },
  submitButton: { paddingVertical: 14, alignItems: 'center' },
  // @MX:NOTE: [AUTO] SPEC-UI-002 PR-3 trackB — ctaStrong(15/700/21) 토큰 적용. primary submit 강조 라벨.
  submitText: { ...typography.ctaStrong },
});
