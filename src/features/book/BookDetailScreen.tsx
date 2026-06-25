/**
 * BookDetailScreen 컴포넌트 (SPEC-BOOK-001 M4-3, REQ-BOOK-015)
 *
 * 도서 상세 화면. getBookDetail(bookId) 로 단일 books 행을 조회해 표시.
 *
 * 시나리오:
 * - S19: 성공 → 표지/제목/저자/출판사/출판일 렌더링
 * - S20: NOT_FOUND 에러 메시지
 * - S22: useSession() loading(null) 시 ActivityIndicator, 미인증 시 onRequireAuth
 *
 * useSession 인터페이스(src/auth/useSession.ts 검증):
 * - loading 시 null 반환 → 본 화면도 null 가드 후 ActivityIndicator 표시
 * - 반환값이 있으면 isAuthenticated/isOnboarded 파생값 사용
 *
 * token-only 스타일링 (SPEC-UI-002 FROZEN). useTheme() 사용, 하드코딩 금지.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/theme';
import { useRouter } from 'expo-router';
import { useSession } from '../../auth/useSession';
import { getBookDetail } from './bookDetailApi';
import { formatPublishedMonth } from './format';
import type { BookRow } from '../../types/book';
import { useLibraryItem } from '../library/useLibraryItem';
import {
  useUpdateProgress,
  useUpdateStatus,
  useUpdateVisibility,
  useDeleteBook,
  useAddBook,
} from '../library/useLibrary';
import { ProgressBar } from '../../components/ProgressBar';
import { calcProgressRate } from '../library/progressRate';
import { validatePage } from '../library/progressValidation';
import { getUserFriendlyMessage } from '../../lib/api/errors';
import type { ReadingStatus } from '../library/types';

export interface BookDetailScreenProps {
  /** books.id (UUID) — 라우팅 param */
  bookId: string;
  /** 미인증 시 호출 (인증 플로우로 이동) */
  onRequireAuth: () => void;
  /** 삭제 성공 후 호출 (호출부에서 뒤로 가기 등 처리). 미전달 시 무시. */
  onDeleted?: () => void;
}

type DetailStatus = 'idle' | 'loading' | 'success' | 'error';

interface DetailState {
  status: DetailStatus;
  book: BookRow | null;
  errorMessage: string | null;
}

const initialState: DetailState = {
  status: 'idle',
  book: null,
  errorMessage: null,
};

// @MX:NOTE: [AUTO] formatPublishedMonth 는 공유 유틸로 추출 (DRY, src/features/book/format.ts)
//           SearchResultCard(M4-1) 과 동일 포맷 공유 — REQ-BOOK-014/REQ-BOOK-015

/**
 * 에러 카테고리별 사용자 메시지 매핑 (S20: NOT_FOUND, S22: RLS_DENIED).
 */
function mapErrorMessage(category: string | undefined, fallback: string): string {
  switch (category) {
    case 'NOT_FOUND':
      return '책을 찾을 수 없습니다.';
    case 'RLS_DENIED':
      return '접근 권한이 없습니다.';
    case 'AUTH':
      return '로그인이 필요합니다.';
    default:
      return fallback;
  }
}

/**
 * 통일된 사용자 피드백 메시지 모델 (SPEC-UI-002).
 * 진행률 검증 메시지가 동일한 박스 UI 로 렌더된다.
 * 상태 변경 피드백은 Alert.alert 확인 다이얼로그로 대체되었다.
 */
interface Feedback {
  text: string;
  kind: 'success' | 'info' | 'warning';
}

/**
 * @MX:NOTE: [AUTO] ReadingStatus 라벨 매핑 — status chip 라벨과 피드백 메시지가 동일 라벨을 공유.
 *           chip 렌더 블록과 handleStatusChange 양쪽에서 참조하므로 단일 소스로 통합.
 */
function statusLabel(s: ReadingStatus): string {
  switch (s) {
    case 'reading':
      return '읽는중';
    case 'completed':
      return '완독';
    case 'shelved':
      return '보관함';
  }
}

/**
 * @MX:NOTE: [AUTO] 상태 탭 클릭 시 Alert.alert 의 title/message 를 반환 (세 탭 동일 패턴).
 *           completed → reading 역전환 시 메시지를 다르게 제안 (정책 5.1-A).
 */
function statusAlertContent(
  next: ReadingStatus,
  isReverseFromCompleted: boolean,
): { title: string; message: string } {
  switch (next) {
    case 'reading':
      return {
        title: '읽는중으로 변경',
        message: isReverseFromCompleted
          ? '완독한 책을 다시 읽는중으로 변경할까요?'
          : '이 책을 읽는중으로 변경할까요?',
      };
    case 'completed':
      return {
        title: '완독 처리',
        message: '완독 처리하고 완독 다이어리로 이동할까요?',
      };
    case 'shelved':
      return {
        title: '보관함으로 이동',
        message: '이 책을 보관함으로 이동할까요?',
      };
  }
}

// @MX:NOTE: [AUTO] SPEC-UI-002 — 피드백 박스 kind 별 Feather 아이콘 이름 매핑.
const FEEDBACK_ICON: Record<Feedback['kind'], 'check-circle' | 'alert-triangle' | 'info'> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  info: 'info',
};

/**
 * @MX:ANCHOR: [AUTO] FeedbackBox — 통일된 피드백 메시지 박스 (SPEC-UI-002)
 * @MX:REASON: 진행률 검증·상태 변경·완독 처리 세 곳에서 동일 박스 UI 로 렌더되어야 한다.
 *            스타일/아이콘/색상 매핑이 한 곳에서 변경되지 않으면 메시지 UI 가 분산되어 사용자 경험이 깨진다.
 */
function FeedbackBox({
  feedback,
  theme,
  testID,
}: {
  feedback: Feedback;
  theme: ReturnType<typeof useTheme>;
  testID: string;
}) {
  const tc = theme.colors;
  const color =
    feedback.kind === 'success'
      ? tc.semantic.success
      : feedback.kind === 'warning'
        ? tc.semantic.warning
        : tc.semantic.info;
  return (
    <View
      testID={testID}
      style={[
        styles.feedbackBox,
        {
          backgroundColor: tc.bg.muted,
          borderRadius: theme.radius.md,
          borderLeftColor: color,
        },
      ]}
    >
      <Feather name={FEEDBACK_ICON[feedback.kind]} size={16} color={color} />
      <Text style={[styles.feedbackText, { color }]}>{feedback.text}</Text>
    </View>
  );
}

/**
 * @MX:ANCHOR: [AUTO] BookDetailScreen — 도서 상세 화면 공개 컴포넌트
 * @MX:REASON: 라우팅([bookId].tsx)이 직접 마운트하며, 세션 가드·NOT_FOUND/RLS 에러 처리·bookId 전달 계약을 위반하면 상세 플로우가 고장난다.
 */
export const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  bookId,
  onRequireAuth,
  onDeleted,
}) => {
  const theme = useTheme();
  const tc = theme.colors;
  const router = useRouter();
  const session = useSession();
  const [state, setState] = useState<DetailState>(initialState);

  // S22: 세션 로딩(useSession null) 또는 미인증 가드
  const isAuthenticated = session?.isAuthenticated ?? false;
  // @MX:NOTE: [AUTO] sessionLoading 스칼라 분해 — useSession 이 매 렌더 신규 객체를 반환해도
  // 의존성 배열에서 객체 참조 변경으로 인한 불필요한 getBookDetail 재호출을 방지
  const sessionLoading = session === null;
  const userId = session?.user?.id ?? '';

  // --- SPEC-LIBRARY-001 TASK-010: 서재 데이터 + mutation hooks ---
  const libraryItemQuery = useLibraryItem({ bookId, userId });
  const libraryItem = libraryItemQuery.data ?? null;
  const updateProgressMutation = useUpdateProgress({ userId });
  const updateStatusMutation = useUpdateStatus({ userId });
  const updateVisibilityMutation = useUpdateVisibility({ userId });
  const deleteBookMutation = useDeleteBook({ userId });
  // SPEC-LIBRARY-001: 서재에 추가 — 미등록 책(libraryItem null) 진입점 (REQ-LIB-001/002/032)
  const addBookMutation = useAddBook({ userId });

  // 진행률 입력 로컬 상태 (검증 메시지 표시용)
  const [progressDraft, setProgressDraft] = useState<string>('');
  // @MX:NOTE: [AUTO] SPEC-UI-002 — 진행률 검증 메시지는 인라인 FeedbackBox 로 렌더.
  //           상태 변경 피드백은 Alert.alert 확인 다이얼로그로 대체하여 statusMessage state 는 제거됨.
  const [progressMessage, setProgressMessage] = useState<Feedback | null>(null);
  // @MX:NOTE: [AUTO] book 참조를 상위로 끌어올려 mutation 핸들러가 total_pages 에 접근.
  const book = state.book;
  // libraryItem 이 로드되면 입력란 초기값 세팅
  useEffect(() => {
    if (libraryItem) {
      setProgressDraft(String(libraryItem.current_page ?? 0));
    }
  }, [libraryItem?.id, libraryItem?.current_page]);

  // 진행률 제출: 검증 후 mutation
  const handleSubmitProgress = () => {
    if (!libraryItem) return;
    const parsed = Number(progressDraft);
    if (Number.isNaN(parsed)) {
      setProgressMessage({ text: '숫자를 입력해 주세요.', kind: 'warning' });
      return;
    }
    const totalPages = book?.total_pages ?? null;
    const validationError = validatePage(parsed, totalPages);
    if (validationError) {
      // @MX:NOTE: [AUTO] validatePage 메시지(한국어) 를 그대로 노출 — 음수/초과 케이스
      setProgressMessage({ text: validationError.message, kind: 'warning' });
      return;
    }
    setProgressMessage(null);
    updateProgressMutation.mutate({
      id: libraryItem.id,
      currentPage: parsed,
      totalPages: totalPages ?? undefined,
    });
  };

  /**
   * @MX:ANCHOR: [AUTO] handleStatusChange — 상태 탭 클릭 시 Alert.alert 확인 후 상태 변경
   * @MX:REASON: 세 상태 탭(reading/completed/shelved) 이 동일한 Alert 확인 패턴으로 동작해야 한다.
   *            이미 활성 상태면 Alert 없이 무시하고, completed 확인 시 완독 다이어리로 이동한다.
   *            패턴이 분산되면 사용자 경험 일관성이 깨지고 completed 이동 로직이 누락될 수 있다.
   */
  const handleStatusChange = (next: ReadingStatus) => {
    if (!libraryItem) return;
    // @MX:NOTE: [AUTO] 이미 활성 상태면 Alert 없이 무시 — 사용자가 실수로 같은 탭을 누른 경우.
    if (libraryItem.status === next) return;

    // 탭별 Alert title/message 구성 (세 탭 동일 패턴, 메시지만 다름)
    const isReverseFromCompleted = libraryItem.status === 'completed' && next === 'reading';
    const { title, message } = statusAlertContent(next, isReverseFromCompleted);

    Alert.alert(title, message, [
      { text: '취소', style: 'cancel' },
      {
        text: '확인',
        onPress: () => {
          // @MX:NOTE: [AUTO] completed 확인 시 status='completed' 만 UPDATE.
          //           completed_at/completion_reports 는 DB 트리거가 관리(AC-TRIG-002/003).
          // @MX:NOTE: [AUTO] SPEC-COMPLETION-001 P1-C — 완독 확인 시 완독 다이어리(completion/[bookId]) 로 이동.
          //           bookId(books.id) param 전달. 라우트가 bookId → userBookId 매핑 수행.
          const onSuccess =
            next === 'completed'
              ? () => {
                  router.push({
                    pathname: '/completion/[bookId]',
                    params: { bookId },
                  });
                }
              : undefined;
          updateStatusMutation.mutate(
            { id: libraryItem.id, status: next },
            onSuccess ? { onSuccess } : undefined,
          );
        },
      },
    ]);
  };

  // 공개 토글
  const handleVisibilityToggle = () => {
    if (!libraryItem) return;
    updateVisibilityMutation.mutate({
      id: libraryItem.id,
      isPublic: !libraryItem.is_public,
    });
  };

  // 서재에 추가 (미등록 책 진입점)
  // @MX:NOTE: [AUTO] 409 정규화 경로 — addBook → normalizeError → classifyError 가
  //           UNIQUE 위반(23505) 을 category='VALIDATION', code='23505' 로 분류.
  //           HTTP 409 가 아니라 AppError.category 로 식별해야 함 (errors.ts line 174-182).
  //           getUserFriendlyMessage 가 "이미 등록된 항목입니다" 반환 (errors.ts line 331).
  const handleAddToLibrary = () => {
    // 인증 가드: 미인증(useEffect 가 onRequireAuth 호출 전 사용자 누름 가능) 시 가드
    if (!isAuthenticated || !userId) {
      onRequireAuth();
      return;
    }
    addBookMutation.mutate(
      { bookId },
      {
        onError: (err) => {
          const friendly = getUserFriendlyMessage(err as never);
          Alert.alert('서재에 추가할 수 없어요', friendly);
        },
      },
    );
  };

  // 삭제: 확인 다이얼로그
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDeletePress = () => setConfirmDelete(true);
  const handleDeleteConfirm = () => {
    if (!libraryItem) return;
    setConfirmDelete(false);
    deleteBookMutation.mutate(
      { id: libraryItem.id },
      {
        onSuccess: () => {
          onDeleted?.();
        },
        onError: (err) => {
          // @MX:NOTE: [AUTO] FK RESTRICT 차단 시 보관함 이동 제안 (정책 5.3).
          //           사용자 친화적 메시지로 안내.
          const friendly = getUserFriendlyMessage(err as never);
          Alert.alert(
            '삭제할 수 없어요',
            `${friendly}\n기록이 있는 책은 보관함(shelved)으로 이동해 보세요.`,
          );
        },
      },
    );
  };

  useEffect(() => {
    // useSession 이 null(loading) 인 경우 — 대기 (API 호출 없음)
    if (sessionLoading) return;

    // 미인증 — onRequireAuth 호출, API 호출 없음
    if (!isAuthenticated) {
      onRequireAuth();
      return;
    }

    // 인증됨 — 상세 조회
    let cancelled = false;
    setState({ status: 'loading', book: null, errorMessage: null });

    (async () => {
      try {
        const book = await getBookDetail(bookId);
        if (!cancelled) {
          setState({ status: 'success', book, errorMessage: null });
        }
      } catch (err) {
        if (cancelled) return;
        const fallback =
          err instanceof Error ? err.message : '상세 조회 중 오류가 발생했습니다.';
        // @MX:NOTE: [AUTO] AppError.category 로 NOT_FOUND/RLS_DENIED 분류 — normalizeError 가 설정
        const category = (err as { category?: string }).category;
        const message = mapErrorMessage(category, fallback);
        setState({ status: 'error', book: null, errorMessage: message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, isAuthenticated, bookId, onRequireAuth]);

  // S22: 세션 로딩 또는 상세 로딩 — ActivityIndicator
  if (sessionLoading || state.status === 'loading' || state.status === 'idle') {
    return (
      <View
        testID="book-detail-loading"
        style={[styles.centerContainer, { backgroundColor: tc.bg.base }]}
      >
        <ActivityIndicator size="large" color={tc.brand[500]} />
      </View>
    );
  }

  // 에러 상태 (NOT_FOUND / RLS_DENIED / 네트워크)
  if (state.status === 'error' && state.errorMessage) {
    return (
      <View
        testID="book-detail-error"
        style={[styles.centerContainer, { backgroundColor: tc.bg.base }]}
      >
        <Text
          style={[styles.errorTitle, { color: tc.semantic.error }]}
        >
          {state.errorMessage}
        </Text>
      </View>
    );
  }

  // 성공 — 상세 렌더링
  if (!book) return null;

  const formattedDate = formatPublishedMonth(book.published_at);
  let metaText: string | null = null;
  if (book.publisher && formattedDate) {
    metaText = `${book.publisher} · ${formattedDate}`;
  } else if (book.publisher) {
    metaText = book.publisher;
  } else if (formattedDate) {
    metaText = formattedDate;
  }

  // 진행률 계산 — calcProgressRate(null 처리 포함)
  const totalPages = book.total_pages ?? null;
  const currentPage = libraryItem?.current_page ?? null;
  const progressRate = calcProgressRate(currentPage, totalPages);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: tc.bg.base }]}
      contentContainerStyle={styles.content}
    >
      {/* 표지 */}
      {book.cover_url ? (
        <Image
          testID="book-detail-cover"
          source={{ uri: book.cover_url }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View
          testID="book-detail-cover-placeholder"
          style={[styles.cover, { backgroundColor: tc.brand[200] }]}
        />
      )}

      {/* 제목 */}
      <Text style={[styles.title, { color: tc.text.primary }]}>
        {book.title}
      </Text>

      {/* 저자 */}
      <Text style={[styles.author, { color: tc.text.secondary }]}>
        {book.author}
      </Text>

      {/* 출판사·출판일 메타 */}
      {metaText && (
        <Text style={[styles.meta, { color: tc.text.tertiary }]}>
          {metaText}
        </Text>
      )}

      {/* --- SPEC-LIBRARY-001: 서재에 추가 진입점 (미등록 책) --- */}
      {libraryItem === null && !libraryItemQuery.isLoading && (
        <View
          testID="book-detail-add-to-library"
          style={[
            styles.addToLibrarySection,
            {
              backgroundColor: tc.bg.surface,
              borderRadius: theme.radius.lg,
              marginTop: theme.spacing[5],
            },
          ]}
        >
          <Pressable
            testID="add-to-library-button"
            onPress={handleAddToLibrary}
            disabled={addBookMutation.isPending}
            style={[
              styles.completeButton,
              {
                backgroundColor: tc.brand[500],
                borderRadius: theme.radius.md,
                opacity: addBookMutation.isPending ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="서재에 추가"
            accessibilityState={{ disabled: addBookMutation.isPending }}
          >
            <Text style={[styles.completeButtonText, { color: tc.text.inverse }]}>
              {addBookMutation.isPending ? '추가 중...' : '서재에 추가'}
            </Text>
          </Pressable>
          {/* REQ-LIB-032: 공개 설정 기본값 안내 */}
          <Text
            style={[styles.visibilityHint, { color: tc.text.tertiary }]}
          >
            서재에 추가하면 다른 사람이 내 감정 기록을 볼 수 있어요 (기본 공개)
          </Text>
        </View>
      )}

      {/* --- SPEC-LIBRARY-001 TASK-010: 서재 섹션 (등록된 책) --- */}
      {libraryItem && (
        <View
          testID="book-detail-library-section"
          style={[
            styles.librarySection,
            {
              backgroundColor: tc.bg.surface,
              borderRadius: theme.radius.lg,
              marginTop: theme.spacing[5],
            },
          ]}
        >
          {/* 진행률 표시 (ProgressBar) */}
          {progressRate !== null && totalPages !== null && (
            <ProgressBar
              testID="progress-bar"
              current={currentPage ?? 0}
              total={totalPages}
            />
          )}

          {/* 진행률 입력 */}
          <View style={styles.progressInputRow}>
            <TextInput
              testID="progress-input"
              value={progressDraft}
              onChangeText={setProgressDraft}
              onSubmitEditing={handleSubmitProgress}
              keyboardType="numeric"
              accessibilityLabel="현재 페이지"
              style={[
                styles.progressInput,
                {
                  color: tc.text.primary,
                  borderColor: tc.border.default,
                  borderRadius: theme.radius.md,
                },
              ]}
            />
            <Pressable
              testID="progress-submit"
              onPress={handleSubmitProgress}
              style={[
                styles.progressSubmitBtn,
                {
                  backgroundColor: tc.brand[500],
                  borderRadius: theme.radius.md,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="진행률 저장"
            >
              <Text style={[styles.progressSubmitText, { color: tc.text.inverse }]}>
                저장
              </Text>
            </Pressable>
          </View>
          {progressMessage && (
            <FeedbackBox
              feedback={progressMessage}
              theme={theme}
              testID="progress-message"
            />
          )}

          {/* status 선택 */}
          <View style={styles.statusRow}>
            <Text style={[styles.sectionLabel, { color: tc.text.secondary }]}>
              상태
            </Text>
            <View
              testID="status-select"
              style={[
                styles.statusChips,
                {
                  backgroundColor: tc.bg.muted,
                  borderRadius: theme.radius.full,
                },
              ]}
            >
              {(['reading', 'completed', 'shelved'] as ReadingStatus[]).map(
                (s) => {
                  const active = libraryItem.status === s;
                  const label = statusLabel(s);
                  return (
                    <Pressable
                      key={s}
                      testID={`status-chip-${s}`}
                      onPress={() => handleStatusChange(s)}
                      style={[
                        styles.statusChip,
                        active && {
                          backgroundColor: tc.brand[500],
                          borderRadius: theme.radius.full,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`상태: ${label}`}
                    >
                      <Text
                        style={[
                          styles.statusChipText,
                          {
                            color: active
                              ? tc.text.inverse
                              : tc.text.secondary,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          </View>
          {/* 공개 토글 + 기본값 안내 (REQ-LIB-032) */}
          <View style={styles.visibilityRow}>
            <Pressable
              testID="visibility-toggle"
              onPress={handleVisibilityToggle}
              accessibilityRole="switch"
              accessibilityLabel={
                libraryItem.is_public ? '공개 중' : '비공개'
              }
              style={[
                styles.toggle,
                {
                  backgroundColor: libraryItem.is_public
                    ? tc.brand[500]
                    : tc.bg.muted,
                  borderRadius: theme.radius.full,
                },
              ]}
            >
              <Text
                style={{ color: libraryItem.is_public ? tc.text.inverse : tc.text.tertiary }}
              >
                {libraryItem.is_public ? 'ON' : 'OFF'}
              </Text>
            </Pressable>
            <View style={styles.visibilityMeta}>
              <Text style={[styles.visibilityLabel, { color: tc.text.primary }]}>
                {libraryItem.is_public ? '공개' : '비공개'}
              </Text>
              <Text
                style={[styles.visibilityHint, { color: tc.text.tertiary }]}
              >
                {libraryItem.is_public
                  ? '누구나 볼 수 있어요'
                  : '기본 비공개 — 나만 볼 수 있어요'}
              </Text>
            </View>
          </View>

          {/* 삭제 */}
          <Pressable
            testID="delete-button"
            onPress={handleDeletePress}
            style={[
              styles.deleteButton,
              {
                borderColor: tc.semantic.error,
                borderRadius: theme.radius.md,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="삭제"
          >
            <Text style={[styles.deleteButtonText, { color: tc.semantic.error }]}>
              삭제
            </Text>
          </Pressable>

          {/* 삭제 확인 다이얼로그 (인라인) */}
          {confirmDelete && (
            <View
              testID="delete-confirm"
              style={[
                styles.confirmBox,
                {
                  backgroundColor: tc.bg.muted,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Text style={[styles.confirmText, { color: tc.text.primary }]}>
                정말 삭제하시겠어요?
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  testID="delete-cancel"
                  onPress={() => setConfirmDelete(false)}
                  style={styles.confirmBtn}
                  accessibilityRole="button"
                  accessibilityLabel="삭제 취소"
                >
                  <Text style={{ color: tc.text.secondary }}>취소</Text>
                </Pressable>
                <Pressable
                  testID="delete-confirm-action"
                  onPress={handleDeleteConfirm}
                  style={styles.confirmBtn}
                  accessibilityRole="button"
                  accessibilityLabel="삭제 확인"
                >
                  <Text style={{ color: tc.semantic.error }}>삭제</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    width: 160,
    height: 220,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  author: {
    fontSize: 14,
    textAlign: 'center',
  },
  meta: {
    fontSize: 12,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  // --- SPEC-LIBRARY-001 TASK-010: 서재 섹션 스타일 ---
  librarySection: {
    width: '100%',
    padding: 16,
    gap: 16,
    alignItems: 'stretch',
  },
  // --- SPEC-LIBRARY-001: 서재에 추가 섹션 (미등록 책) ---
  addToLibrarySection: {
    width: '100%',
    padding: 16,
    gap: 12,
    alignItems: 'stretch',
  },
  progressInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  progressSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressSubmitText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // @MX:NOTE: [AUTO] SPEC-UI-002 — 통일 피드백 박스 스타일 (진행률/상태/완독 메시지 공유).
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderLeftWidth: 3,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
  },
  statusRow: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusChips: {
    flexDirection: 'row',
    padding: 4,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  completeButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggle: {
    width: 48,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityMeta: {
    flex: 1,
    gap: 2,
  },
  visibilityLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  visibilityHint: {
    fontSize: 12,
  },
  deleteButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBox: {
    padding: 16,
    gap: 12,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
