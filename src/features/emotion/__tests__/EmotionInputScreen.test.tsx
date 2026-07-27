/**
 * EmotionInputScreen 컴포넌트 테스트 (SPEC-EMOTION-001 T-009)
 *
 * 검증 대상 (REQ-EMO-001, 005, 010, 시나리오 2.1, EC-2, EC-12):
 * - 질문 프롬프트 표시
 * - content 입력 (maxLength 120)
 * - 빈 content 제출 차단 (내부 검증 + PostgREST 미호출)
 * - visibility 토글 (public/club)
 * - club 선택 시 clubId 전달
 * - 성공 시 onSubmit 콜백 호출
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { EmotionInputScreen } from '../EmotionInputScreen';
import { QUESTION_PROMPTS } from '../questionPrompts';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

type ScreenOverrides = Partial<React.ComponentProps<typeof EmotionInputScreen>>;

function renderScreen(overrides: ScreenOverrides = {}) {
  const onSubmit = jest.fn().mockResolvedValue(undefined);
  const utils = render(
    <ThemeProvider>
      <EmotionInputScreen
        bookId="b1"
        userId="u1"
        currentPage={100}
        totalPages={300}
        onSubmit={onSubmit}
        {...overrides}
      />
    </ThemeProvider>,
  );
  return { ...utils, onSubmit };
}

describe('SPEC-EMOTION-001 T-009: EmotionInputScreen', () => {
  it('질문 프롬프트를 표시한다 (시나리오 2.1) — 무작위 풀 중 하나', () => {
    const { getByText } = renderScreen();
    // 마운트 시 무작위 선택되므로, 풀 중 하나가 표시되어야 한다 (REQ-EMO-005)
    const rendered = QUESTION_PROMPTS.find((p) => {
      try {
        getByText(p);
        return true;
      } catch {
        return false;
      }
    });
    expect(rendered).toBeDefined();
  });

  it('content 입력 필드가 있다', () => {
    const { getByPlaceholderText } = renderScreen();
    expect(getByPlaceholderText(/감정|내용|기록/)).toBeTruthy();
  });

  it('EC-12: content 입력은 maxLength 120 으로 제한한다', () => {
    const { getByPlaceholderText } = renderScreen();
    const input = getByPlaceholderText(/감정|내용|기록/);
    // TextInput maxLength prop 검증
    expect((input.props as { maxLength?: number }).maxLength).toBe(120);
  });

  it('빈 content 제출 시 onSubmit 을 호출하지 않는다 (시나리오 1.3)', async () => {
    const { getByText, onSubmit, queryByText } = renderScreen();
    const submit = getByText('기록 저장');

    fireEvent.press(submit);

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    // 검증 메시지 표시
    expect(queryByText(/내용을 입력/)).not.toBeNull();
  });

  it('content 입력 후 제출 시 onSubmit 이 public 기본값으로 호출된다', async () => {
    const { getByPlaceholderText, getByText, onSubmit } = renderScreen();
    const input = getByPlaceholderText(/감정|내용|기록/);

    fireEvent.changeText(input, '이 문장에서 멈췄다');
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '이 문장에서 멈췄다',
          visibility: 'public',
        }),
      );
    });
  });

  it('visibility=club 선택 시 clubId 를 함께 전달한다', async () => {
    const { getByPlaceholderText, getByText, onSubmit } = renderScreen({
      clubs: [{ id: 'C1', name: '독서모임' }],
    });
    fireEvent.changeText(getByPlaceholderText(/감정|내용|기록/), '감동');

    // club visibility 토글 후 모임 선택
    fireEvent.press(getByText('모임 공개'));
    fireEvent.press(getByText('독서모임'));
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'club',
          clubId: 'C1',
        }),
      );
    });
  });

  it('페이지 번호 선택기가 currentPage 를 기본값으로 표시한다', () => {
    const { getByDisplayValue } = renderScreen({ currentPage: 77 });
    expect(getByDisplayValue('77')).toBeTruthy();
  });

  it('음수 페이지 번호 제출 시 onSubmit 을 호출하지 않는다 (리뷰 UX-002)', async () => {
    const {
      getByDisplayValue,
      getByPlaceholderText,
      getByText,
      onSubmit,
      queryByText,
    } = renderScreen({
      currentPage: 100,
    });
    // 페이지 입력을 음수로 변경
    fireEvent.changeText(getByDisplayValue('100'), '-5');
    fireEvent.changeText(
      getByPlaceholderText(/감정|내용|기록/),
      '내용 있음',
    );
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
    expect(queryByText(/올바른 페이지 번호/)).not.toBeNull();
  });

  it('소수 페이지 번호 제출 시 onSubmit 을 호출하지 않는다 (리뷰 UX-002)', async () => {
    const { getByDisplayValue, getByPlaceholderText, getByText, onSubmit } =
      renderScreen({ currentPage: 100 });
    fireEvent.changeText(getByDisplayValue('100'), '12.7');
    fireEvent.changeText(getByPlaceholderText(/감정|내용|기록/), '내용 있음');
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it('0 페이지(독서 전)는 허용한다 — 음수가 아닌 정수', async () => {
    const { getByDisplayValue, getByPlaceholderText, getByText, onSubmit } =
      renderScreen({ currentPage: 100 });
    fireEvent.changeText(getByDisplayValue('100'), '0');
    fireEvent.changeText(getByPlaceholderText(/감정|내용|기록/), '시작 전 감상');
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 0 }),
      );
    });
  });

  it('비공개(visibility=private) 버튼이 있다 (REQ-EMO-010 확장)', () => {
    const { getByText } = renderScreen();
    expect(getByText('비공개')).toBeTruthy();
  });

  it('비공개 선택 제출 시 clubId 없이 private 으로 호출된다', async () => {
    const { getByText, getByPlaceholderText, onSubmit } = renderScreen();
    fireEvent.press(getByText('비공개'));
    fireEvent.changeText(getByPlaceholderText(/감정|내용|기록/), '비공개 메모');
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'private',
          clubId: null,
        }),
      );
    });
  });

  it('defaultVisibility=private 전달 시 초기 비공개 상태로 제출된다', async () => {
    const { getByPlaceholderText, getByText, onSubmit } = renderScreen({
      defaultVisibility: 'private',
    });
    fireEvent.changeText(getByPlaceholderText(/감정|내용|기록/), '비공개 시작');
    fireEvent.press(getByText('기록 저장'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          visibility: 'private',
        }),
      );
    });
  });

  it('저장 성공 후 폼이 초기화된다 (content blank + 페이지 기본값 복귀)', async () => {
    const { getByPlaceholderText, getByDisplayValue, getByText } = renderScreen({
      currentPage: 50,
    });
    const input = getByPlaceholderText(/감정|내용|기록/);
    fireEvent.changeText(input, '저장 후 초기화');
    fireEvent.press(getByText('기록 저장'));

    // content 가 빈 문자열로 리셋되는지 확인
    await waitFor(() => {
      expect((input.props as { value?: string }).value).toBe('');
    });
    // 페이지 번호도 currentPage 기본값으로 리셋
    expect(getByDisplayValue('50')).toBeTruthy();
  });

  // ---------------------------------------------------------------------
  // SPEC-LIBRARY-002 regression: currentPage prop 동기화 결함
  // 시나리오: reading→shelved→reading 사이클 후 stale 캐시(current_page=0)로
  // 마운트 → 백그라운드 refetch 가 currentPage=10 으로 갱신해도 useState 가
  // 최초 마운트 값("0")에 고정되어 감정 기록 저장 시 페이지가 0 으로 리셋.
  // ---------------------------------------------------------------------

  it('currentPage prop 변경 시 pageNumber 가 갱신된다 (stale 캐시 → refetch 보정)', () => {
    // 결함 재현: 마운트 시 currentPage=0 (stale) → refetch 로 prop 이 10 으로 변화
    // useState 만으로는 추적 불가 → useEffect 동기화 필요.
    const { rerender, getByDisplayValue } = renderScreen({ currentPage: 0 });
    expect(getByDisplayValue('0')).toBeTruthy();

    rerender(
      <ThemeProvider>
        <EmotionInputScreen
          bookId="b1"
          userId="u1"
          currentPage={10}
          totalPages={300}
          onSubmit={jest.fn().mockResolvedValue(undefined)}
        />
      </ThemeProvider>,
    );
    // prop 변화 반영 — "0" 에 고정되지 않고 "10" 으로 갱신되어야 함
    expect(getByDisplayValue('10')).toBeTruthy();
  });

  it('사용자가 직접 페이지 수정 중일 때 currentPage prop 변화로 덮어쓰지 않는다', () => {
    // 가드 계약: 사용자가 페이지를 15 로 수정한 직후 prop 이 변해도 15 는 보존.
    // 입력 중인 값을 prop 동기화가 덮어쓰면 사용자 신뢰 훼손.
    const { rerender, getByDisplayValue } = renderScreen({ currentPage: 10 });
    fireEvent.changeText(getByDisplayValue('10'), '15');
    expect(getByDisplayValue('15')).toBeTruthy();

    // prop 변화 (백그라운드 refetch 시뮬레이션) — 사용자 입력 보존
    rerender(
      <ThemeProvider>
        <EmotionInputScreen
          bookId="b1"
          userId="u1"
          currentPage={12}
          totalPages={300}
          onSubmit={jest.fn().mockResolvedValue(undefined)}
        />
      </ThemeProvider>,
    );
    expect(getByDisplayValue('15')).toBeTruthy();
  });
});
