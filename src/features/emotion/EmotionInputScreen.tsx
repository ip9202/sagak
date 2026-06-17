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
  ScrollView,
} from 'react-native';
import { useTheme } from '../../theme/theme';
import { Button } from '../../components/Button';
import { selectPrompt } from './questionPrompts';
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
  /** 제출 콜백 — 부모가 useCreateEmotionRecord.mutate 와 연결 */
  onSubmit: (input: CreateEmotionInput) => void;
}

/** content 상한 (EC-12 — 입력 필드 maxLength) */
const CONTENT_MAX_LENGTH = 120;

/**
 * @MX:NOTE: [AUTO] 감정 기록 입력 화면. 페이지 선택 + content + 질문 프롬프트 + visibility 토글. 부모가 뮤테이션을 소유해 테스트 격리가 쉽다.
 */
export const EmotionInputScreen: React.FC<EmotionInputScreenProps> = ({
  bookId,
  currentPage,
  totalPages,
  clubs = [],
  onSubmit,
}) => {
  const theme = useTheme();
  const [pageNumber, setPageNumber] = useState<string>(String(currentPage));
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [clubId, setClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prompt = selectPrompt({
    currentPage,
    totalPages,
    seed: currentPage,
  });

  const handleSubmit = () => {
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
    onSubmit({
      bookId,
      pageNumber: parsedPage,
      content: trimmed,
      visibility,
      clubId: visibility === 'club' ? clubId : null,
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg.base }]}
      testID="emotion-input-screen"
    >
      {/* 질문 프롬프트 (REQ-EMO-005) */}
      <View
        style={[
          styles.promptBox,
          { backgroundColor: theme.colors.bg.surface },
        ]}
      >
        <Text
          style={[
            styles.promptText,
            { color: theme.colors.text.secondary },
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

      <Button variant="primary" onPress={handleSubmit}>
        기록 저장
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  promptBox: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 15,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  visibilityBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  clubList: {
    marginTop: 12,
    gap: 8,
  },
  clubBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  error: {
    fontSize: 13,
    marginTop: 12,
  },
});
