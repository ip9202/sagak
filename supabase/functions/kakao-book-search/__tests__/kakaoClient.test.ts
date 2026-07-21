/**
 * kakaoClient 단위 테스트 (REQ-BOOK-001, REQ-BOOK-002, REQ-BOOK-004, 시나리오 S1/S4)
 *
 * Kakao Book Search API 호출 래퍼 검증.
 * API 키는 파라미터로 주입받는다 (Deno.env 직접 참조 금지 — 테스트 가능성).
 * fetch 는 글로벌 mock 으로 대체한다.
 */
import { searchKakaoBooks, type KakaoSearchResponse } from '../kakaoClient';

describe('kakaoClient (REQ-BOOK-001/002/004, 시나리오 S1/S4)', () => {
  const API_KEY = 'test-kakao-key';
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Authorization: KakaoAK <key> 헤더로 Kakao API 를 호출한다 (REQ-BOOK-002, 시나리오 S1)', async () => {
    const kakaoResponse: KakaoSearchResponse = {
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
      meta: { total_count: 1, pageable_count: 1, is_end: true },
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => kakaoResponse,
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await searchKakaoBooks({
      query: '호모 데우스',
      target: 'title',
      apiKey: API_KEY,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://dapi.kakao.com/v3/search/book');
    // @MX:NOTE: [AUTO] KakaoAK 인증 스킴 — 클라이언트 번들에 키 노출 금지 (REQ-BOOK-002)
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `KakaoAK ${API_KEY}`,
    });
    expect(result).toEqual(kakaoResponse);
  });

  it('target=query 파라미터를 URL 에 포함한다', async () => {
    const kakaoResponse: KakaoSearchResponse = {
      documents: [],
      meta: { total_count: 0, pageable_count: 0, is_end: true },
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => kakaoResponse,
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await searchKakaoBooks({
      query: '9791186565873',
      target: 'isbn',
      apiKey: API_KEY,
    });

    const [url] = fetchMock.mock.calls[0];
    const urlStr = String(url);
    expect(urlStr).toContain('query=');
    expect(urlStr).toContain('target=isbn');
  });

  it('4xx 에러 시 구조화 에러를 throw 한다 (REQ-BOOK-004, 시나리오 S4)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'invalid app key' }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      searchKakaoBooks({ query: 'x', target: 'title', apiKey: 'bad' })
    ).rejects.toMatchObject({
      code: 'KAKAO_API_ERROR',
      statusCode: 401,
    });
  });

  it('5xx 에러 시 구조화 에러를 throw 한다', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ message: 'server boom' }),
    } as Response);
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      searchKakaoBooks({ query: 'x', target: 'title', apiKey: API_KEY })
    ).rejects.toMatchObject({
      code: 'KAKAO_API_ERROR',
      statusCode: 500,
    });
  });

  it('타임아웃 시 에러를 throw 한다', async () => {
    // AbortError 시뮬레이션
    const fetchMock = jest.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      searchKakaoBooks({ query: 'x', target: 'title', apiKey: API_KEY })
    ).rejects.toMatchObject({
      code: 'KAKAO_TIMEOUT',
    });
  });

  it('네트워크 에러(fetch reject) 시 에러를 throw 한다', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    await expect(
      searchKakaoBooks({ query: 'x', target: 'title', apiKey: API_KEY })
    ).rejects.toMatchObject({
      code: 'KAKAO_NETWORK_ERROR',
    });
  });
});
