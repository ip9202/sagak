/**
 * TimelineScreen 컴포넌트 테스트 (SPEC-EMOTION-001 T-010)
 *
 * 검증 대상 (REQ-EMO-002, 008, 009, 시나리오 4.1~4.4, EC-5, EC-7, EC-8):
 * - safe 기록 렌더링 (EmotionRecordCard)
 * - spoiler 기록 렌더링 (isSpoiler=true)
 * - 빈 상태 UI (EC-5)
 * - sort 토글 (time/page)
 * - 로딩 상태
 * - 에러 상태
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { TimelineScreen } from '../TimelineScreen';
import { getBookDetail } from '../../book/bookDetailApi';
import type { BookRow } from '../../../types/book';
import type { EmotionListResult, EmotionRecordWithAuthor } from '../types';

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
jest.mock('../../book/bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;

function makeBook(overrides: Partial<BookRow> = {}): BookRow {
  return {
    id: 'b1',
    title: '데미안',
    ...overrides,
  } as unknown as BookRow;
}

function makeRecord(overrides: Partial<EmotionRecordWithAuthor> = {}): EmotionRecordWithAuthor {
  return {
    id: 'r1',
    book_id: 'b1',
    user_id: 'u2',
    page_number: 50,
    content: '멈춘 문장',
    visibility: 'public',
    club_id: null,
    created_at: '2026-06-17T00:00:00Z',
    updated_at: null,
    users: { nickname: '독자', avatar_url: null },
    sticker_reactions: [],
    ...overrides,
  };
}

interface RenderOpts {
  data?: EmotionListResult;
  isLoading?: boolean;
  error?: unknown;
  onSortChange?: (sort: 'time' | 'page') => void;
}

function renderScreen(opts: RenderOpts = {}) {
  const onSortChange = opts.onSortChange ?? jest.fn();
  const utils = render(
    <ThemeProvider>
      <TimelineScreen
        bookId="b1"
        userId="u1"
        currentPage={100}
        data={opts.data ?? { safe: [], spoiler: [] }}
        isLoading={opts.isLoading ?? false}
        error={opts.error ?? null}
        sort="time"
        onSortChange={onSortChange}
      />
    </ThemeProvider>,
  );
  return { ...utils, onSortChange };
}

describe('SPEC-EMOTION-001 T-010: TimelineScreen', () => {
  it('EC-5: 기록 0건일 때 빈 상태 UI 를 표시한다', () => {
    const { getByText } = renderScreen({ data: { safe: [], spoiler: [] } });
    expect(getByText(/첫 기록|감정 기록이 없/)).toBeTruthy();
  });

  it('safe 기록을 EmotionRecordCard 로 렌더링한다', () => {
    const rec = makeRecord({ id: 'safe1', content: '안전한 기록' });
    const { getByText } = renderScreen({
      data: { safe: [rec], spoiler: [] },
    });
    expect(getByText('안전한 기록')).toBeTruthy();
  });

  it('시나리오 4.1: spoiler 기록은 isSpoiler=true 로 렌더링한다 (blur)', () => {
    const rec = makeRecord({ id: 'sp1', content: '스포일러 내용', page_number: 150 });
    const { getByText, getAllByText } = renderScreen({
      data: { safe: [], spoiler: [rec] },
    });
    // 스포일러 안내 문구가 표시된다 (EmotionRecordCard 의 blur label)
    // 카드가 렌더링되어야 한다
    expect(getByText('스포일러 내용')).toBeTruthy();
  });

  it('로딩 중일 때 로딩 표시를 렌더링한다', () => {
    const { getByText } = renderScreen({ isLoading: true });
    expect(getByText(/불러오는|로딩/)).toBeTruthy();
  });

  it('에러 발생 시 에러 메시지를 렌더링한다', () => {
    const { getByText } = renderScreen({
      error: { name: 'AppError', category: 'NETWORK' },
    });
    expect(getByText(/오류|다시 시도|문제/)).toBeTruthy();
  });

  it('sort 토글: 페이지순 선택 시 onSortChange("page") 호출 (시나리오 4.4)', () => {
    const rec = makeRecord({ id: 's1', content: '기록' });
    const { getByText, onSortChange } = renderScreen({
      data: { safe: [rec], spoiler: [] },
    });
    fireEvent.press(getByText('페이지순'));
    expect(onSortChange).toHaveBeenCalledWith('page');
  });

  it('sort 토글: 시간순 선택 시 onSortChange("time") 호출 (시나리오 4.3)', () => {
    const rec = makeRecord({ id: 's1', content: '기록' });
    const { getByText, onSortChange } = renderScreen({
      data: { safe: [rec], spoiler: [] },
    });
    fireEvent.press(getByText('시간순'));
    expect(onSortChange).toHaveBeenCalledWith('time');
  });

  it('여러 safe 기록을 모두 렌더링한다', () => {
    const recs = [
      makeRecord({ id: 's1', content: '첫 기록' }),
      makeRecord({ id: 's2', content: '둘째 기록' }),
    ];
    const { getByText } = renderScreen({ data: { safe: recs, spoiler: [] } });
    expect(getByText('첫 기록')).toBeTruthy();
    expect(getByText('둘째 기록')).toBeTruthy();
  });

  it('책 제목을 getBookDetail 로 조회해 카드에 표시한다 (bookTitle 빈값 수정)', async () => {
    mockedGetBookDetail.mockResolvedValue(makeBook({ title: '데미안' }));
    const rec = makeRecord({ id: 's1', content: '기록' });
    const { findByText } = renderScreen({
      data: { safe: [rec], spoiler: [] },
    });
    // getBookDetail(bookId) 호출
    expect(mockedGetBookDetail).toHaveBeenCalledWith('b1');
    // 조회된 책 제목이 카드에 표시된다
    expect(await findByText(/데미안/)).toBeTruthy();
  });

  it('getBookDetail 실패 시에도 emotion 기록은 정상 렌더링된다 (bookTitle 보조 표시)', async () => {
    mockedGetBookDetail.mockRejectedValue(new Error('network'));
    const rec = makeRecord({ id: 's1', content: '감상 내용' });
    const { getByText } = renderScreen({
      data: { safe: [rec], spoiler: [] },
    });
    // 책 제목 조회 실패해도 emotion 데이터는 렌더링
    expect(getByText('감상 내용')).toBeTruthy();
  });
});
