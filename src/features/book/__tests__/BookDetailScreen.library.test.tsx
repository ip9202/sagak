/**
 * BookDetailScreen 서재 확장 테스트 (SPEC-LIBRARY-001 TASK-010)
 *
 * 기존 책 메타데이터 표시(SPEC-BOOK-001 M4-3) 위에 서재(user_books) 데이터를 통합:
 * - 진행률 입력 + ProgressBar (calcProgressRate)
 * - status 탭 chips (reading/completed/shelved) + Alert.alert 확인 다이얼로그
 * - visibility 토글
 * - 삭제 버튼 + 확인 다이얼로그
 * - 페이지 검증 (음수/초과 거부 + 메시지)
 * - 공개 기본값 안내 (REQ-LIB-032)
 *
 * 엣지 케이스 메시지:
 * - 409 duplicate (UNIQUE 위반) — getUserFriendlyMessage
 * - FK RESTRICT 삭제 차단 — 보관함 이동 제안
 * - 역전환(completed→reading) Alert 메시지 "다시 읽는중" 안내 (정책 5.1-A)
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../theme/theme';
import { BookDetailScreen } from '../BookDetailScreen';
import type { LibraryItem } from '../../../features/library/types';
import { AppError } from '../../../errors';

// 네이티브 모듈 mock
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('expo-linear-gradient', () => {
  const R = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: { children?: React.ReactNode }) =>
      R.createElement(View, props),
  };
});

// expo-router mock — SPEC-COMPLETION-001 P1-C: completed 탭 확인 시 router.push 호출.
// @MX:NOTE: [AUTO] push/replace/back 을 외부 고정 jest.fn 으로 노출해 호출 검증 가능.
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: mockRouterBack,
  })),
}));

// useSession mock
jest.mock('../../../auth/useSession', () => ({
  useSession: jest.fn(),
}));

// bookDetailApi mock
jest.mock('../bookDetailApi', () => ({
  getBookDetail: jest.fn(),
}));

// libraryApi 전체 mock (getLibraryItem 포함)
jest.mock('../../../features/library/libraryApi', () => ({
  __esModule: true,
  getLibrary: jest.fn(),
  getLibraryItem: jest.fn(),
  addBook: jest.fn(),
  deleteBook: jest.fn(),
  updateProgress: jest.fn(),
  updateStatus: jest.fn(),
  updateVisibility: jest.fn(),
}));

// useLibraryItem mock (단일 항목 조회 훅)
jest.mock('../../../features/library/useLibraryItem', () => ({
  useLibraryItem: jest.fn(),
}));

import { useSession } from '../../../auth/useSession';
import { getBookDetail } from '../bookDetailApi';
import {
  updateStatus,
  addBook,
} from '../../../features/library/libraryApi';
import { useLibraryItem } from '../../../features/library/useLibraryItem';
import type { BookRow } from '../../../types/book';

const mockedUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockedGetBookDetail = getBookDetail as jest.MockedFunction<typeof getBookDetail>;
const mockedUseLibraryItem = useLibraryItem as jest.MockedFunction<typeof useLibraryItem>;
const updateStatusMock = updateStatus as jest.MockedFunction<typeof updateStatus>;
const addBookMock = addBook as jest.MockedFunction<typeof addBook>;

const authenticatedSession = {
  session: { access_token: 'tok', user: { id: 'u-1' } },
  user: { id: 'u-1' },
  profile: { id: 'u-1', nickname: '독자' },
  loading: false,
  isAuthenticated: true,
  isOnboarded: true,
  signInWithProvider: jest.fn(),
  signOut: jest.fn(),
  refreshProfile: jest.fn(),
};

const sampleBook: BookRow = {
  id: 'b-1',
  isbn: '9788937477029',
  title: '미드나잇 라이브러리',
  author: '매트 헤이그',
  publisher: '다산책방',
  published_at: '2021-06-15',
  cover_url: 'https://example.com/cover.jpg',
  total_pages: 400,
  kakao_id: 'kakao-1',
  created_at: '2024-01-01T00:00:00Z',
};

const sampleLibraryItem: LibraryItem = {
  id: 'ub-1',
  book_id: 'b-1',
  user_id: 'u-1',
  status: 'reading',
  current_page: 120,
  is_public: false,
  last_progress_at: '2026-06-15T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  books: {
    id: 'b-1',
    title: '미드나잇 라이브러리',
    author: '매트 헤이그',
    cover_url: 'https://example.com/cover.jpg',
    total_pages: 400,
  },
} as LibraryItem;

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderScreen(props: { bookId: string; onRequireAuth?: () => void }) {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BookDetailScreen
          bookId={props.bookId}
          onRequireAuth={props.onRequireAuth ?? jest.fn()}
        />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockRouterBack.mockClear();
  mockedUseSession.mockReturnValue(authenticatedSession as any);
  mockedGetBookDetail.mockResolvedValue(sampleBook);
  // useLibraryItem 기본: 로딩 아님, 데이터 있음
  mockedUseLibraryItem.mockReturnValue({
    data: sampleLibraryItem,
    isLoading: false,
    isError: false,
    error: null,
  } as any);
  // addBook 기본: 성공
  addBookMock.mockResolvedValue({ ...sampleLibraryItem, id: 'ub-new' } as any);
});

/**
 * @MX:NOTE: [AUTO] Alert.alert 확인 흐름 헬퍼 — status chip 클릭 후 Alert 의 "확인" 버튼 onPress 를 호출.
 *           Alert.alert spy 에서 버튼 콜백을 획득해 수동 트리거한다 (RN Alert 이 jsdom 에서 자동 실행되지 않음).
 */
function confirmStatusAlert(alertSpy: jest.SpyInstance) {
  expect(alertSpy).toHaveBeenCalled();
  const callArgs = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
  const buttons = callArgs[2] as Array<{ text: string; onPress?: () => void; style?: string }>;
  const confirmBtn = buttons.find((b) => b.text === '확인');
  expect(confirmBtn).toBeTruthy();
  confirmBtn!.onPress?.();
}

describe('SPEC-LIBRARY-001 TASK-010: 진행률 섹션', () => {
  it('현재 페이지와 ProgressBar 를 렌더링한다', async () => {
    const { getByText, getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByText('미드나잇 라이브러리')).toBeTruthy();
    });
    // ProgressBar 존재
    expect(getByTestId('progress-bar')).toBeTruthy();
    // 진행률 캡션(120 / 400p) 표시
    expect(getByText(/120/)).toBeTruthy();
  });

  it('현재 페이지 입력란을 렌더링한다', async () => {
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('progress-input')).toBeTruthy();
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-010: status 섹션', () => {
  it('status 드롭다운(읽는중/완독/보관함)을 렌더링한다', async () => {
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-select')).toBeTruthy();
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-010: 상태 탭 Alert 확인 다이얼로그', () => {
  // @MX:NOTE: [AUTO] "완독 처리" 버튼은 제거됨. completed 탭(status-chip-completed) 클릭 → Alert 확인 →
  //           updateStatus(completed) 호출 + router.push completion 이동 흐름으로 재작성.
  //           세 상태 탭이 동일한 Alert.alert 확인 패턴을 공유한다.

  it('completed 탭 클릭 시 완독 처리 Alert 질문을 표시한다', async () => {
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-completed')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-completed'));
    expect(alertSpy).toHaveBeenCalledWith(
      '완독 처리',
      '완독 처리하고 완독 다이어리로 이동할까요?',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it('completed 탭 → Alert 확인 시 status=completed 로 업데이트 + 완독 다이어리 이동', async () => {
    updateStatusMock.mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-completed')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-completed'));
    confirmStatusAlert(alertSpy);
    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith({
        pathname: '/completion/[bookId]',
        params: { bookId: 'b-1' },
      });
    });
    alertSpy.mockRestore();
  });

  it('reading 탭 → Alert 확인 시 status=reading 으로 업데이트 (router.push 미발생)', async () => {
    // 현재 상태를 shelved 로 설정 — reading 탭은 비활성 상태이므로 Alert 트리거됨
    mockedUseLibraryItem.mockReturnValue({
      data: { ...sampleLibraryItem, status: 'shelved' },
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    updateStatusMock.mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-reading')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-reading'));
    // 정책 5.5 (reading 단일): reading 전환 시 기존 읽던 책의 보관함 자동 이동 안내 포함
    expect(alertSpy).toHaveBeenCalledWith(
      '읽는중으로 변경',
      expect.stringContaining('보관함으로 이동'),
      expect.any(Array),
    );
    confirmStatusAlert(alertSpy);
    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'reading' }),
      );
    });
    // reading 변경 시 완독 다이어리 이동 미발생
    expect(mockRouterPush).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shelved 탭 → Alert 확인 시 status=shelved 로 업데이트', async () => {
    updateStatusMock.mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-shelved')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-shelved'));
    expect(alertSpy).toHaveBeenCalledWith(
      '보관함으로 이동',
      '이 책을 보관함으로 이동할까요?',
      expect.any(Array),
    );
    confirmStatusAlert(alertSpy);
    await waitFor(() => {
      expect(updateStatusMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'shelved' }),
      );
    });
    alertSpy.mockRestore();
  });

  it('이미 활성 상태인 탭 클릭 시 Alert 미발생 + updateStatus 미호출', async () => {
    // 현재 reading — reading 탭은 활성 상태
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-reading')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-reading'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(updateStatusMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('Alert 취소 버튼 선택 시 updateStatus 미호출', async () => {
    updateStatusMock.mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-chip-completed')).toBeTruthy();
    });
    fireEvent.press(getByTestId('status-chip-completed'));
    // 취소 버튼 onPress 트리거 (onPress 미정의여도 안전)
    expect(alertSpy).toHaveBeenCalled();
    const callArgs = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = callArgs[2] as Array<{ text: string; onPress?: () => void }>;
    const cancelBtn = buttons.find((b) => b.text === '취소');
    expect(cancelBtn).toBeTruthy();
    cancelBtn!.onPress?.();
    expect(updateStatusMock).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('SPEC-LIBRARY-001 TASK-010: 삭제', () => {
  it('삭제 버튼을 렌더링한다', async () => {
    const { getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByText('삭제')).toBeTruthy();
    });
  });

  it('삭제 버튼 누르면 확인 다이얼로그를 표시한다', async () => {
    const { getByText, getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByText('삭제')).toBeTruthy();
    });
    fireEvent.press(getByText('삭제'));
    await waitFor(() => {
      expect(getByTestId('delete-confirm')).toBeTruthy();
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-010: 공개 여부', () => {
  it('공개 토글을 렌더링한다', async () => {
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('visibility-toggle')).toBeTruthy();
    });
  });

  it('공개 기본값 안내(REQ-LIB-032)를 렌더링한다', async () => {
    const { getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      // 기본 비공개 안내 문구
      expect(getByText(/기본.*비공개|비공개.*기본/)).toBeTruthy();
    });
  });
});

describe('SPEC-LIBRARY-001 TASK-010: 엣지 케이스 메시지', () => {
  it('진행률 음수 입력 시 검증 메시지를 표시한다', async () => {
    const { getByTestId, getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('progress-input')).toBeTruthy();
    });
    const input = getByTestId('progress-input');
    fireEvent.changeText(input, '-5');
    fireEvent(getByTestId('progress-input'), 'submitEditing');
    await waitFor(() => {
      expect(getByText(/0 이상|음수/)).toBeTruthy();
    });
  });

  it('진행률 초과 입력 시 검증 메시지를 표시한다', async () => {
    const { getByTestId, getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('progress-input')).toBeTruthy();
    });
    const input = getByTestId('progress-input');
    fireEvent.changeText(input, '9999');
    fireEvent(getByTestId('progress-input'), 'submitEditing');
    await waitFor(() => {
      expect(getByText(/초과|총 페이지/)).toBeTruthy();
    });
  });

  it('역전환(completed→reading) 시 Alert 메시지에 "다시 읽는중" 안내 (정책 5.1-A)', async () => {
    // 이미 완독 상태
    mockedUseLibraryItem.mockReturnValue({
      data: { ...sampleLibraryItem, status: 'completed' },
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    updateStatusMock.mockResolvedValue(undefined);
    const alertSpy = jest
      .spyOn(require('react-native').Alert, 'alert')
      .mockImplementation(() => {});
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('status-select')).toBeTruthy();
    });
    // status chip "읽는중" 을 눌러 reading 로 변경 시도 — 역전환 Alert 메시지 검증
    fireEvent.press(getByTestId('status-chip-reading'));
    expect(alertSpy).toHaveBeenCalledWith(
      '읽는중으로 변경',
      expect.stringContaining('다시 읽는중'),
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });
});

describe('SPEC-LIBRARY-001: 서재에 추가 진입점 (미등록 책)', () => {
  it('libraryItem null 시 "서재에 추가" 버튼을 렌더링한다', async () => {
    // 미등록 책 — useLibraryItem 이 null 반환
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId, queryByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('add-to-library-button')).toBeTruthy();
    });
    // 기존 서재 섹션(진행률/status/삭제) 은 미노출
    expect(queryByTestId('book-detail-library-section')).toBeNull();
  });

  it('REQ-LIB-032: 공개 설정 기본값 안내를 렌더링한다', async () => {
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByText(/기본 공개/)).toBeTruthy();
    });
  });

  it('버튼 press 시 addBook 을 호출한다 (기본 shelved, 정책 5.5)', async () => {
    addBookMock.mockResolvedValue({ ...sampleLibraryItem, id: 'ub-new' } as any);
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('add-to-library-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-to-library-button'));
    await waitFor(() => {
      // useAddBook 은 status 생략 시 undefined 전달, addBook 내부 ?? 'shelved' 기본값 적용 (정책 5.5)
      expect(addBookMock).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: 'b-1',
          userId: 'u-1',
        }),
      );
    });
  });

  it('409 중복(UNIQUE 위반) 시 "이미 등록된 항목입니다" 안내 (REQ-LIB-002)', async () => {
    // normalizeError 가 분류한 AppError 시뮬레이션:
    // category='VALIDATION', code='23505' (errors.ts line 331 매핑 대상)
    const conflictError = new AppError(
      'duplicate key value violates unique constraint',
      '23505',
      400,
    );
    conflictError.category = 'VALIDATION';
    addBookMock.mockRejectedValue(conflictError);

    // Alert.alert spy
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('add-to-library-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-to-library-button'));
    await waitFor(() => {
      expect(addBookMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        '서재에 추가할 수 없어요',
        '이미 등록된 항목입니다',
      );
    });
    alertSpy.mockRestore();
  });

  it('mutation pending 중 버튼 비활성화 + "추가 중..." 텍스트', async () => {
    // 결코 resolve 하지 않는 promise 로 pending 상태 유지
    addBookMock.mockReturnValue(new Promise(() => {}));
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    const { getByTestId, getByText } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByTestId('add-to-library-button')).toBeTruthy();
    });
    fireEvent.press(getByTestId('add-to-library-button'));
    await waitFor(() => {
      expect(getByText('추가 중...')).toBeTruthy();
    });
  });
});

describe('SPEC-LIBRARY-001: 서재에 추가 end-to-end gap 보강', () => {
  it('AC-LIB-001: 추가 성공 후 미등록 섹션이 등록 섹션으로 전환된다 (즉시 표시)', async () => {
    // 초기: 미등록 (libraryItem null)
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    addBookMock.mockResolvedValue({ ...sampleLibraryItem, id: 'ub-new' } as any);

    // rerender 시 동일 QueryClient 를 유지하기 위해 자체 트리 구성.
    // onRequireAuth 참조를 고정해 rerender 시 useEffect 재실행을 막는다.
    const onRequireAuth = jest.fn();
    const client = createTestQueryClient();
    const tree = (children: React.ReactNode) => (
      <QueryClientProvider client={client}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    );
    const { getByTestId, queryByTestId, rerender } = render(
      tree(<BookDetailScreen bookId="b-1" onRequireAuth={onRequireAuth} />),
    );

    // 1) 미등록 — "서재에 추가" 버튼 노출, 등록 섹션 미노출
    await waitFor(() => {
      expect(getByTestId('add-to-library-button')).toBeTruthy();
    });
    expect(queryByTestId('book-detail-library-section')).toBeNull();

    // 2) 추가 버튼 press → addBook 호출
    fireEvent.press(getByTestId('add-to-library-button'));
    await waitFor(() => {
      expect(addBookMock).toHaveBeenCalledWith(
        expect.objectContaining({ bookId: 'b-1', userId: 'u-1' }),
      );
    });

    // 3) useAddBook.onSuccess 가 ['library-item'] 캐시를 무효화 →
    //    useLibraryItem 재조회로 data 가 채워진 상태를 시뮬레이션
    mockedUseLibraryItem.mockReturnValue({
      data: sampleLibraryItem,
      isLoading: false,
      isError: false,
      error: null,
    } as any);
    rerender(tree(<BookDetailScreen bookId="b-1" onRequireAuth={onRequireAuth} />));

    // 4) 미등록 섹션 소멸 + 등록 섹션(ProgressBar/status/삭제) 등장
    await waitFor(() => {
      expect(queryByTestId('add-to-library-button')).toBeNull();
      expect(getByTestId('book-detail-library-section')).toBeTruthy();
      expect(getByTestId('progress-bar')).toBeTruthy();
    });
  });

  it('AC-LIB-003: 미인증 사용자에게 서재 추가 UI가 노출되지 않는다', async () => {
    mockedUseSession.mockReturnValue({
      ...authenticatedSession,
      isAuthenticated: false,
      user: { id: '' },
    } as any);
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    const { queryByTestId, getByTestId } = renderScreen({ bookId: 'b-1' });

    // 미인증 → useEffect 가 onRequireAuth 호출 → state idle → ActivityIndicator
    await waitFor(() => {
      expect(getByTestId('book-detail-loading')).toBeTruthy();
    });
    // 서재 추가 버튼 미노출 + addBook 결코 호출 안 함
    expect(queryByTestId('add-to-library-button')).toBeNull();
    expect(addBookMock).not.toHaveBeenCalled();
  });

  it('libraryItem 조회 로딩 중에는 서재 추가 버튼을 노출하지 않는다 (깜빡임 방지)', async () => {
    // book 메타는 로드됐으나 서재 등록 여부는 아직 미확정(loading)
    mockedUseLibraryItem.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    const { getByText, queryByTestId } = renderScreen({ bookId: 'b-1' });
    await waitFor(() => {
      expect(getByText('미드나잇 라이브러리')).toBeTruthy();
    });
    // libraryItem 로딩 중 → "서재에 추가" 버튼 미노출 (잘못된 빈 상태 점멠 방지)
    expect(queryByTestId('add-to-library-button')).toBeNull();
  });
});
