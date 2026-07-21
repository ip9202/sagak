/**
 * ClubFeedScreen 컴포넌트 단위 테스트 (SPEC-FEED-001 T-B1)
 *
 * 검증 대상:
 * - F9: currentPage prop 변경 시 동일 캐시 아이템에 spoilerFilter 만 재평가 (queryFn 재호출 없음)
 * - F10: 블러 카드 탭 → revealed 전환 (블러 해제)
 * - F11: 언마운트 시 revealed 상태 초기화 (컴포넌트 로컬 state 이므로 자동 소멸)
 * - 로딩 상태: ActivityIndicator 렌더
 * - 빈 상태: 다정한 메시지 렌더
 * - 에러 상태: semantic-error 메시지 + 재시도 버튼 (refetch 호출)
 */
import React from 'react';
import { FlatList } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../../theme/theme';

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

// EmotionRecordCard 는 expo-blur 등 네이티브 의존성을 가지므로 얕게 stub.
// 자식 렌더 대신 testID/props 만으로 상호작용을 검증한다.
jest.mock('../../../components/EmotionRecordCard', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    __esModule: true,
    EmotionRecordCard: (props: {
      nickname: string;
      content: string;
      isSpoiler?: boolean;
      testID?: string;
    }) => (
      <Pressable
        testID={props.testID ?? 'emotion-record-card'}
        accessibilityRole="button"
      >
        <View>
          <Text>{props.nickname}</Text>
          <Text>{props.content}</Text>
          {props.isSpoiler ? <Text>SPOILER</Text> : null}
        </View>
      </Pressable>
    ),
  };
});

jest.mock('../queries', () => ({
  __esModule: true,
  fetchClubFeedPage: jest.fn(),
}));

// T-C2: useClubFeedRealtime 을 stub 하여 연결 상태를 주입한다.
// 기본값은 connected 로 둔다. 각 테스트에서 mockImplementation 으로 덮어쓴다.
type RealtimeArgs = { clubId: string; userId: string };
type RealtimeResult = { status: 'connecting' | 'connected' | 'error'; lastError?: string };
const mockUseClubFeedRealtime = jest.fn<RealtimeResult, RealtimeArgs[]>(
  () => ({ status: 'connected' }),
);
jest.mock('../useClubFeedRealtime', () => ({
  __esModule: true,
  useClubFeedRealtime: (args: RealtimeArgs) => mockUseClubFeedRealtime(args),
}));

import { ClubFeedScreen } from '../components/ClubFeedScreen';
import { fetchClubFeedPage } from '../queries';
import type { FeedPageResult } from '../types';

const fetchMock = fetchClubFeedPage as jest.MockedFunction<typeof fetchClubFeedPage>;

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Wrapper({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

/** 타인의 page 80 기록 — currentPage < 80 이면 spoiler */
function otherPageEightyRecord(id = 'r1') {
  return {
    id,
    book_id: 'b1',
    user_id: 'u-other',
    page_number: 80,
    content: '뒷부분 감상',
    visibility: 'club' as const,
    club_id: 'c1',
    created_at: '2026-06-19T00:00:00Z',
    updated_at: null,
    users: { nickname: '독자A', avatar_url: null },
    sticker_reactions: [],
  };
}

const SCREEN_PROPS = {
  clubId: 'c1',
  bookId: 'b1',
  currentPage: 50,
  userId: 'u1',
  bookTitle: '데미안',
};

describe('SPEC-FEED-001 T-B1: ClubFeedScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 기본: realtime 연결 정상
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });
  });

  it('로딩 상태 — ActivityIndicator 렌더', async () => {
    // 결코 resolve 되지 않는 pending
    fetchMock.mockImplementation(
      () => new Promise<FeedPageResult>(() => {}),
    );

    const client = createClient();
    const { findByTestId } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);
    });

    expect(await findByTestId('club-feed-loading')).toBeTruthy();
  });

  it('빈 상태 — 다정한 메시지 렌더', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });

    const client = createClient();
    const { findByTestId } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    const empty = await findByTestId('club-feed-empty');
    expect(empty).toBeTruthy();
  });

  it('에러 상태 — semantic-error 메시지 + 재시도 버튼 (refetch 호출)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const client = createClient();
    const { findByTestId } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    const errorBox = await findByTestId('club-feed-error');
    expect(errorBox).toBeTruthy();

    const retry = await findByTestId('club-feed-retry');
    expect(retry).toBeTruthy();

    // 에러 후 재시도 버튼 탭 → fetch 재호출
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });
    const callsBefore = fetchMock.mock.calls.length;
    fireEvent(retry, 'press');
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('F9: currentPage 50 → 100 변경 시 queryFn 재호출 없이 블러 해제', async () => {
    fetchMock.mockResolvedValue({
      items: [otherPageEightyRecord()],
      nextCursor: null,
    });

    const client = createClient();
    const { rerender, findByTestId, queryByText } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} currentPage={50} />
      </Wrapper>,
    );

    // 첫 렌더: page 80 > currentPage 50 → spoiler 블러
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queryByText('SPOILER')).toBeTruthy());

    // currentPage 100 으로 변경 (rerender)
    const callsBefore = fetchMock.mock.calls.length;
    rerender(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} currentPage={100} />
      </Wrapper>,
    );

    // queryFn 추가 호출 없음 (F9)
    await waitFor(() => {
      expect(queryByText('SPOILER')).toBeNull();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    // 카드는 여전히 렌더됨 (데이터 동일)
    expect(await findByTestId('club-feed-card-r1')).toBeTruthy();
  });

  it('F10: 블러 카드 탭 → revealed 전환 (블러 해제)', async () => {
    fetchMock.mockResolvedValue({
      items: [otherPageEightyRecord()],
      nextCursor: null,
    });

    const client = createClient();
    const { findByTestId, queryByText } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} currentPage={50} />
      </Wrapper>,
    );

    await waitFor(() => expect(queryByText('SPOILER')).toBeTruthy());

    const card = await findByTestId('club-feed-card-r1');
    fireEvent(card, 'press');

    // 탭 후 블러 해제
    await waitFor(() => {
      expect(queryByText('SPOILER')).toBeNull();
    });
  });

  it('F11: 언마운트 시 revealed 상태 소멸 — 재마운트 시 다시 블러', async () => {
    fetchMock.mockResolvedValue({
      items: [otherPageEightyRecord()],
      nextCursor: null,
    });

    const client = createClient();
    const { findByTestId, queryByText, unmount } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} currentPage={50} />
      </Wrapper>,
    );

    await waitFor(() => expect(queryByText('SPOILER')).toBeTruthy());

    // 탭 → revealed
    const card = await findByTestId('club-feed-card-r1');
    fireEvent(card, 'press');
    await waitFor(() => expect(queryByText('SPOILER')).toBeNull());

    // 언마운트 → 컴포넌트 로컬 state 소멸 (F11). 에러 없이 정상 소멸해야 한다.
    expect(() => unmount()).not.toThrow();

    // 재마운트 (별도 render 호출로 새 인스턴스) → revealed 가 초기화되어 다시 블러
    const { findByText: findAgain } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} currentPage={50} />
      </Wrapper>,
    );
    await waitFor(async () => {
      expect(await findAgain('SPOILER')).toBeTruthy();
    });
  });
});

describe('SPEC-FEED-001 T-C2: ClubFeedScreen Realtime 통합', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('realtime status="error" 시 연결 끊김 메시지가 렌더된다 (F16)', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });
    mockUseClubFeedRealtime.mockReturnValue({
      status: 'error',
      lastError: 'socket closed',
    });

    const client = createClient();
    const { findByTestId } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    const indicator = await findByTestId('club-feed-realtime-error');
    expect(indicator).toBeTruthy();
  });

  it('realtime status="connected" 시 연결 메시지가 렌더되지 않는다', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });

    const client = createClient();
    const { queryByTestId, findByTestId } = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    await findByTestId('club-feed-empty');
    expect(queryByTestId('club-feed-realtime-error')).toBeNull();
  });

  it('useClubFeedRealtime 에 clubId/userId 가 전달된다', async () => {
    fetchMock.mockResolvedValue({ items: [], nextCursor: null });
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });

    const client = createClient();
    render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    expect(mockUseClubFeedRealtime).toHaveBeenCalledWith({
      clubId: 'c1',
      userId: 'u1',
    });
  });
});

/**
 * 페이지네이션 컴포넌트 연결 테스트 (SPEC-FEED-001 평가자 이슈 — branch coverage gap)
 *
 * useClubFeed.test.tsx 는 getNextPageParam/hasNextPage 를 훅 수준에서 검증하지만,
 * ClubFeedScreen 의 FlatList onEndReached → fetchNextPage 와이어링은 컴포넌트 수준에서
 * 별도로 단언해야 한다.
 *
 * 검증 대상:
 * - hasNextPage=true 일 때 onEndReached 가 fetchNextPage 를 호출한다 (긍정 경로)
 * - hasNextPage=false 일 때 onEndReached 가 fetchNextPage 를 호출하지 않는다 (가드 false 분기)
 *
 * 접근법: 렌더된 트리에서 FlatList 인스턴스를 직접 찾아 onEndReached 핸들러를 호출한다.
 *
 * 참고: isFetchingNextPage=true 단락 경로는 프로브(단일 테스트 파일)에서는 가드가 동작함을
 * 확인했으나, 다중 테스트 파일 환경에서는 다른 테스트가 생성한 영원히 pending 되는 Promise
 * 들이 이벤트 루프에 간섭하여 isFetchingNextPage 상태 반영 타이밍이 불안정해진다.
 * 해당 동적 가드는 hook 수준(useClubFeed.test.tsx 의 hasNextPage/isFetchingNextPage 검증)에
 * 의존하며, 여기서는 결정론적으로 검증 가능한 두 경로만 단언한다.
 */
describe('SPEC-FEED-001: ClubFeedScreen 페이지네이션 와이어링', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });
  });

  const PAGE_CURSOR = { createdAt: '2026-06-18T00:00:00Z', id: 'r1' };

  /** hasNextPage=true 가 되도록 nextCursor 를 포함한 단일 아이템 페이지 */
  function pageWithCursor(id: string): FeedPageResult {
    return {
      items: [
        {
          id,
          book_id: 'b1',
          user_id: 'u-other',
          page_number: 10,
          content: '감상',
          visibility: 'club' as const,
          club_id: 'c1',
          created_at: '2026-06-18T00:00:00Z',
          updated_at: null,
          users: { nickname: '독자A', avatar_url: null },
          sticker_reactions: [],
        },
      ],
      nextCursor: PAGE_CURSOR,
    };
  }

  /** 렌더된 컴포넌트에서 FlatList 의 onEndReached 핸들러를 추출한다 */
  function getOnEndReached(
    container: ReturnType<typeof render>,
  ): (...args: unknown[]) => void {
    const { UNSAFE_getByType } = container;
    const list = UNSAFE_getByType(FlatList);
    const handler = list.props.onEndReached;
    expect(typeof handler).toBe('function');
    return handler as (...args: unknown[]) => void;
  }

  /** React Query 상태 전파(리렌더)가 반영되도록 짧게 대기 */
  function settle(ms = 100): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it('onEndReached 발생 시 hasNextPage=true 이면 fetchNextPage 가 호출된다', async () => {
    fetchMock.mockResolvedValue(pageWithCursor('r1'));
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });

    const client = createClient();
    const rendered = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    // 첫 페이지 settle — FlatList 자동 트리거는 nextCursor 유무와 무관하게 발생하지 않으므로
    // 호출 수는 1(첫 페이지)로 안정화된다.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await settle();

    const callsBefore = fetchMock.mock.calls.length;
    const onEndReached = getOnEndReached(rendered);

    // 스크롤 끝 도달 시뮬레이션 → fetchNextPage 트리거
    act(() => {
      onEndReached({ distanceFromEnd: 0 });
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('hasNextPage=false 면 onEndReached 가 fetchNextPage 를 호출하지 않는다', async () => {
    // nextCursor=null → getNextPageParam 이 undefined → hasNextPage=false.
    // onEndReached 내 가드(query.hasNextPage && !query.isFetchingNextPage) 의
    // false 분기를 검증한다.
    fetchMock.mockResolvedValue({
      items: [pageWithCursor('r1').items[0]],
      nextCursor: null,
    });
    mockUseClubFeedRealtime.mockReturnValue({ status: 'connected' });

    const client = createClient();
    const rendered = render(
      <Wrapper client={client}>
        <ClubFeedScreen {...SCREEN_PROPS} />
      </Wrapper>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await settle();

    const callsBefore = fetchMock.mock.calls.length;
    const onEndReached = getOnEndReached(rendered);

    act(() => {
      onEndReached({ distanceFromEnd: 0 });
    });
    await settle();
    act(() => {
      onEndReached({ distanceFromEnd: 0 });
    });
    await settle();

    // hasNextPage=false 이므로 fetchNextPage 가 호출되지 않아 호출 수 유지
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });
});
