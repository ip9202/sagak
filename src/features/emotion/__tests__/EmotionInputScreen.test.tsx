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
  const onSubmit = jest.fn();
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
  it('질문 프롬프트를 표시한다 (시나리오 2.1)', () => {
    const { getByText } = renderScreen();
    // 정적 풀 중 하나가 표시되어야 한다 (seed=currentPage=100 → 100 % 5 = 0)
    expect(() => getByText('이 페이지에서 멈춘 문장은?')).not.toThrow();
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
});
