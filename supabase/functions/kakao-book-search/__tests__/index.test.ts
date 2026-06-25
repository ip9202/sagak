/**
 * index.ts 핵심 핸들러 테스트 (REQ-BOOK-001~005, 010~012, 시나리오 S1/S4/S5/S13/S14/S21)
 *
 * handleSearchRequest 핵심 로직을 의존성 주입으로 검증한다.
 * Deno.serve 셸은 본 테스트 범위 밖(배포 시 통합 테스트).
 */
import { handleSearchRequest, type SearchDeps } from '../index';

describe('handleSearchRequest (REQ-BOOK-001~005, 010~012)', () => {
  let deps: jest.Mocked<SearchDeps>;

  beforeEach(() => {
    deps = {
      getEnv: jest.fn((key: string) => {
        if (key === 'KAKAO_REST_API_KEY') return 'test-key';
        if (key === 'SUPABASE_URL') return 'https://supabase.example.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'test-service-role';
        return undefined;
      }),
      createServiceClient: jest.fn().mockResolvedValue({} as unknown as Awaited<
        ReturnType<SearchDeps['createServiceClient']>
      >),
      searchKakao: jest.fn(),
      findCachedBook: jest.fn(),
      upsertBooks: jest.fn(),
    } as unknown as jest.Mocked<SearchDeps>;
  });

  it('빈 쿼리를 차단하고 VALIDATION 에러를 반환한다 (REQ-BOOK-005, 시나리오 S5)', async () => {
    const res = await handleSearchRequest({ query: '', target: 'title' }, deps);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.body.error).toContain('검색어');
      expect(res.body.code).toBe('VALIDATION_ERROR');
    }
    expect(deps.searchKakao).not.toHaveBeenCalled();
    expect(deps.findCachedBook).not.toHaveBeenCalled();
  });

  it('공백만 있는 쿼리를 차단한다 (REQ-BOOK-005)', async () => {
    const res = await handleSearchRequest({ query: '   ', target: 'title' }, deps);

    expect(res.ok).toBe(false);
    expect(deps.searchKakao).not.toHaveBeenCalled();
  });

  it('캐시 히트 시 Kakao API 를 호출하지 않고 캐시 행을 반환한다 (REQ-BOOK-010, 시나리오 S13)', async () => {
    const cachedRow = {
      id: 'uuid-1',
      isbn: '9791186565873',
      title: '호모 데우스',
      author: '유발 하라리',
      publisher: '김영사',
      published_at: '2017-01-20',
      cover_url: 'https://example.com/cover.jpg',
      total_pages: null,
      kakao_id: null,
      created_at: '2024-06-14T00:00:00Z',
    };
    deps.findCachedBook.mockResolvedValue(cachedRow);

    const res = await handleSearchRequest(
      { query: '9791186565873', target: 'isbn' },
      deps
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        title: '호모 데우스',
        isbn: '9791186565873',
        authors: ['유발 하라리'],
      });
    }
    expect(deps.findCachedBook).toHaveBeenCalledWith(expect.any(Object), '9791186565873');
    expect(deps.searchKakao).not.toHaveBeenCalled();
  });

  it('캐시 미스 시 Kakao API 호출 후 단일 배치 upsert 하고 결과를 반환한다 (REQ-BOOK-011, 시나리오 S14)', async () => {
    deps.findCachedBook.mockResolvedValue(null);
    deps.searchKakao.mockResolvedValue({
      documents: [
        {
          title: '호모 데우스',
          authors: ['유발 하라리'],
          isbn: '9791186565873',
          datetime: '2017-01-20T00:00:00.000+09:00',
          publishers: ['김영사'],
          thumbnail: 'https://example.com/cover.jpg',
        },
      ],
      meta: { total_count: 1 },
    });
    deps.upsertBooks.mockResolvedValue([
      {
        id: 'uuid-new',
        isbn: '9791186565873',
        title: '호모 데우스',
        author: '유발 하라리',
        publisher: '김영사',
        published_at: '2017-01-20',
        cover_url: 'https://example.com/cover.jpg',
        total_pages: null,
        kakao_id: null,
        created_at: '2024-06-14T00:00:00Z',
      },
    ]);

    const res = await handleSearchRequest(
      { query: '호모 데우스', target: 'title' },
      deps
    );

    expect(res.ok).toBe(true);
    expect(deps.searchKakao).toHaveBeenCalled();
    // @MX:NOTE: [AUTO] 캐시 미스 시 단일 배치 upsert — N+1 방지 (시나리오 S14, REQ-BOOK-011)
    expect(deps.upsertBooks).toHaveBeenCalledTimes(1);
    expect(deps.upsertBooks).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array)
    );
    if (res.ok) {
      expect(res.body.data[0].title).toBe('호모 데우스');
    }
  });

  it('빈 결과(Kakao documents 빈 배열) 시 빈 data 를 반환한다 (REQ-BOOK-016, 시나리오 S21)', async () => {
    deps.findCachedBook.mockResolvedValue(null);
    deps.searchKakao.mockResolvedValue({
      documents: [],
      meta: { total_count: 0 },
    });

    const res = await handleSearchRequest(
      { query: '9999999999999', target: 'isbn' },
      deps
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.data).toEqual([]);
    }
    // 빈 결과 시 upsert 미호출
    expect(deps.upsertBooks).not.toHaveBeenCalled();
  });

  it('Kakao API 에러 시 { error, code } 구조화 에러를 반환한다 (REQ-BOOK-004, 시나리오 S4)', async () => {
    deps.findCachedBook.mockResolvedValue(null);
    const kakaoErr = Object.assign(new Error('invalid app key'), {
      code: 'KAKAO_API_ERROR',
      statusCode: 401,
      name: 'KakaoClientError',
    });
    deps.searchKakao.mockRejectedValue(kakaoErr);

    const res = await handleSearchRequest(
      { query: '호모 데우스', target: 'title' },
      deps
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.body.code).toBe('KAKAO_API_ERROR');
      expect(typeof res.body.error).toBe('string');
    }
  });

  it('KAKAO_REST_API_KEY 가 없으면 설정 에러를 반환한다 (REQ-BOOK-002)', async () => {
    (deps.getEnv as jest.MockedFunction<typeof deps.getEnv>).mockReturnValue(undefined);

    const res = await handleSearchRequest(
      { query: '호모 데우스', target: 'title' },
      deps
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.body.code).toBe('MISSING_API_KEY');
    }
  });
});
