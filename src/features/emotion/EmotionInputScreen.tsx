/**
 * 감정 기록 입력 화면 (SPEC-EMOTION-001 T-009)
 *
 * REQ-EMO-001 (생성), REQ-EMO-005 (질문 프롬프트), REQ-EMO-010 (공개 범위 제어).
 *
 * 기능:
 * - 페이지 번호 선택기 (기본값: currentPage)
 * - content 입력 (maxLength 120, 빈 값 제출 차단)
 * - questionPrompts 정적 풀에서 1개 제안 표시 (자유 입력 허용)
 * - visibility 토글 (public 기본 / club 선택 시 clubId 전달)
 * - 제출 시 onSubmit(input) 콜백 호출 — 부모가 useCreateEmotionRecord 연동
 *
 * FROZEN 규칙: tokens.ts 변수만 사용 (token-only styling). useTheme() 로 접근.
 *
 * @MX:SPEC SPEC-EMOTION-001
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/theme';
import { spacing, radius, borderWidth, minHeight, typography } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { getRandomPrompt } from './questionPrompts';
import type { CreateEmotionInput, Visibility } from './types';

/** 모임 선택 옵션 (외부에서 주입) */
export interface ClubOption {
  id: string;
  name: string;
}

export interface EmotionInputScreenProps {
  bookId: string;
  userId: string;
  currentPage: number;
  totalPages: number;
  /** 선택 가능한 모임 목록 (미제공 시 club 토글 숨김) */
  clubs?: ClubOption[];
  /** 초기 공개 범위 (미제공 시 'public'). 서재 비공개 책 → 'private' 권장. */
  defaultVisibility?: Visibility;
  /** 제출 콜백 — 부모가 useCreateEmotionRecord.mutateAsync 와 연결.
   *  Promise 해결(저장 성공) 시 폼이 초기화되고, reject 시 에러를 표시하고 폼을 유지한다. */
  onSubmit: (input: CreateEmotionInput) => Promise<void>;
}

/** content 상한 (EC-12 — 입력 필드 maxLength) */
const CONTENT_MAX_LENGTH = 120;

/**
 * @MX:NOTE: [AUTO] 감정 기록 입력 화면. 페이지 선택 + content + 질문 프롬프트 + visibility 토글. 부모가 뮤테이션을 소유해 테스트 격리가 쉽다.
 */
export const EmotionInputScreen: React.FC<EmotionInputScreenProps> = ({
  bookId,
  currentPage,
  clubs = [],
  defaultVisibility = 'public',
  onSubmit,
}) => {
  const theme = useTheme();
  const [pageNumber, setPageNumber] = useState<string>(String(currentPage));
  const [content, setContent] = useState('');
  // 화면 진입(마운트)마다 무작위 질문 — 입력 중에는 유지 (REQ-EMO-005)
  const [prompt] = useState(() => getRandomPrompt());
  // 초기 공개 범위 — 부모가 서재 책 is_public 등으로 'private' 전달 가능 (REQ-EMO-010 확장)
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [clubId, setClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      setError('내용을 입력해주세요');
      return;
    }
    if (visibility === 'club' && !clubId) {
      setError('모임 감정 기록은 모임을 선택해야 합니다');
      return;
    }
    // 페이지 번호 검증: 자연수만 허용 (0 = 독서 전). 음수/소수/과대값은 조기 차단 (리뷰 UX-002).
    const parsedPage = Number(pageNumber);
    if (
      !Number.isFinite(parsedPage) ||
      parsedPage < 0 ||
      !Number.isInteger(parsedPage)
    ) {
      setError('올바른 페이지 번호를 입력해주세요');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        bookId,
        pageNumber: parsedPage,
        content: trimmed,
        visibility,
        clubId: visibility === 'club' ? clubId : null,
      });
      // 저장 성공 — 폼 초기화. 페이지는 방금 저장한 페이지를 유지
      // (currentPage 로 리셋 시 서재 진도가 0이면 매번 0으로 돌아가는 문제 방지).
      setContent('');
      setPageNumber(String(parsedPage));
      setVisibility(defaultVisibility);
      setClubId(null);
      setError(null);
    } catch (err) {
      // 저장 실패 — 에러 메시지 표시, 폼은 유지 (사용자가 재시도 가능)
      setError(err instanceof Error ? err.message : '저장에 실패했습니다');
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      testID="emotion-input-screen"
    >
      {/* 질문 프롬프트 (REQ-EMO-005) — 매 진입마다 무작위 질문, 폰트로 본문과 구분 */}
      <View style={styles.promptBox}>
        <Text
          style={[
            styles.promptText,
            { color: theme.colors.text.primary },
          ]}
        >
          {prompt}
        </Text>
      </View>

      {/* 페이지 번호 선택기 */}
      <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
        페이지
      </Text>
      <TextInput
        testID="page-input"
        style={[
          styles.input,
          {
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
          },
        ]}
        value={pageNumber}
        onChangeText={setPageNumber}
        keyboardType="numeric"
      />

      {/* content 입력 */}
      <Text style={[styles.label, { color: theme.colors.text.secondary }]}>
        감정 기록
      </Text>
      <TextInput
        testID="content-input"
        style={[
          styles.contentInput,
          {
            color: theme.colors.text.primary,
            backgroundColor: theme.colors.bg.surface,
            borderColor: theme.colors.border.default,
          },
        ]}
        placeholder="지금 감정을 기록해보세요"
        placeholderTextColor={theme.colors.text.tertiary}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={CONTENT_MAX_LENGTH}
      />
      <Text style={[styles.counter, { color: theme.colors.text.tertiary }]}>
        {content.length} / {CONTENT_MAX_LENGTH}
      </Text>

      {/* 공개 범위 토글 (REQ-EMO-010) */}
      <View style={styles.visibilityRow}>
        <TouchableOpacity
          testID="visibility-public"
          onPress={() => setVisibility('public')}
          style={[
            styles.visibilityBtn,
            {
              backgroundColor:
                visibility === 'public'
                  ? theme.colors.brand[200]
                  : theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text.primary }}>전체 공개</Text>
        </TouchableOpacity>
        {clubs.length > 0 ? (
          <TouchableOpacity
            testID="visibility-club"
            onPress={() => setVisibility('club')}
            style={[
              styles.visibilityBtn,
              {
                backgroundColor:
                  visibility === 'club'
                    ? theme.colors.brand[200]
                    : theme.colors.bg.surface,
                borderColor: theme.colors.border.default,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text.primary }}>모임 공개</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          testID="visibility-private"
          onPress={() => setVisibility('private')}
          style={[
            styles.visibilityBtn,
            {
              backgroundColor:
                visibility === 'private'
                  ? theme.colors.brand[200]
                  : theme.colors.bg.surface,
              borderColor: theme.colors.border.default,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text.primary }}>비공개</Text>
        </TouchableOpacity>
      </View>

      {/* 모임 선택 (visibility=club 시) */}
      {visibility === 'club' && clubs.length > 0 ? (
        <View style={styles.clubList}>
          {clubs.map((club) => (
            <TouchableOpacity
              key={club.id}
              testID={`club-${club.id}`}
              onPress={() => setClubId(club.id)}
              style={[
                styles.clubBtn,
                {
                  backgroundColor:
                    clubId === club.id
                      ? theme.colors.brand[200]
                      : theme.colors.bg.surface,
                  borderColor: theme.colors.border.default,
                },
              ]}
            >
              <Text style={{ color: theme.colors.text.primary }}>
                {club.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* 검증 에러 메시지 */}
      {error ? (
        <Text
          testID="form-error"
          style={[styles.error, { color: theme.colors.semantic.error }]}
        >
          {error}
        </Text>
      ) : null}

      <Button
        variant="primary"
        onPress={handleSubmit}
        style={{ marginTop: spacing[4] }}
      >
        기록 저장
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex:1 제거 — FlatList ListHeaderComponent 안에서 flex:1 은 헤더 높이를 0/과대로 만듦.
    // View 는 콘텐츠 높이만큼만 차지 (입력 폼이 리스트 위에 정상 표시).
    padding: spacing[4],
  },
  promptBox: {
    marginBottom: spacing[4],
  },
  promptText: {
    ...typography.headingSm,
    textAlign: 'center',
  },
  label: {
    fontSize: typography.bodySm.fontSize,
    marginBottom: spacing[2],
    marginTop: spacing[3],
  },
  input: {
    borderWidth: borderWidth.hairline,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: typography.bodyPrompt.fontSize,
  },
  contentInput: {
    borderWidth: borderWidth.hairline,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: typography.bodyPrompt.fontSize,
    minHeight: minHeight.input,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: typography.caption.fontSize,
    textAlign: 'right',
    marginTop: spacing[1],
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  visibilityBtn: {
    flex: 1,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    alignItems: 'center',
  },
  clubList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  clubBtn: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
  },
  error: {
    fontSize: typography.bodySm.fontSize,
    marginTop: spacing[3],
  },
});
