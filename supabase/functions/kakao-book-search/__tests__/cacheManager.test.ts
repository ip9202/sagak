/**
 * cacheManager 단위 테스트 (REQ-BOOK-010, REQ-BOOK-011, 시나리오 S13/S14/S18)
 *
 * Supabase 클라이언트를 주입받아(의존성 주입) 캐시 히트 조회 및 업서트를 검증.
 * Deno 글로벌에 의존하지 않는 순수 로직 — jest + mock 클라이언트로 테스트.
 */
import {
  findCachedBook,
  upsertBooks,
  type SupabaseClientLike,
} from '../cacheManager';
import type { BookUpsertRow } from '../mapper';

describe('cacheManager (REQ-BOOK-010/011, 시나리오 S13/S14/S18)', () => {
  let mockClient: jest.Mocked<SupabaseClientLike>;

  beforeEach(() => {
    mockClient = {
      from: jest.fn(),
    } as unknown as jest.Mocked<SupabaseClientLike>;
  });

  describe('findCachedBook (캐시 히트, REQ-BOOK-010)', () => {
    it('ISBN 으로 캐시된 행을 반환한다 (시나리오 S13)', async () => {
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
      const selectEqSingle = jest.fn().mockResolvedValue({
        data: cachedRow,
        error: null,
      });
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single: selectEqSingle }),
      });
      mockClient.from = jest.fn().mockReturnValue({
        select: selectMock,
      }) as unknown as typeof mockClient.from;

      const result = await findCachedBook(mockClient, '9791186565873');

      expect(mockClient.from).toHaveBeenCalledWith('books');
      expect(selectMock).toHaveBeenCalledWith('*');
      expect(result).toEqual(cachedRow);
    });

    it('캐시 미스(0행) 시 null 을 반환한다 (REQ-BOOK-011)', async () => {
      const selectEqSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'JSON object requested' },
      });
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single: selectEqSingle }),
      });
      mockClient.from = jest.fn().mockReturnValue({
        select: selectMock,
      }) as unknown as typeof mockClient.from;

      const result = await findCachedBook(mockClient, '9999999999999');

      expect(result).toBeNull();
    });

    it('에러 발생 시 null 을 반환한다 (캐시 조회 실패는 미스로 취급)', async () => {
      const selectEqSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'boom' },
      });
      const selectMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ single: selectEqSingle }),
      });
      mockClient.from = jest.fn().mockReturnValue({
        select: selectMock,
      }) as unknown as typeof mockClient.from;

      const result = await findCachedBook(mockClient, '1');

      expect(result).toBeNull();
    });
  });

  describe('upsertBooks (캐시 미스 시 배치 업서트, REQ-BOOK-011, 시나리오 S14/S18)', () => {
    it('ON CONFLICT (isbn) 로 다수 행을 단일 배치 upsert 한다', async () => {
      const rows: BookUpsertRow[] = [
        {
          isbn: '111',
          title: 'A',
          author: 'a',
          publisher: null,
          published_at: null,
          cover_url: null,
          total_pages: null,
          kakao_id: null,
        },
        {
          isbn: '222',
          title: 'B',
          author: 'b',
          publisher: null,
          published_at: null,
          cover_url: null,
          total_pages: null,
          kakao_id: null,
        },
      ];
      const upsertedRows = [
        { id: 'uuid-1', ...rows[0], created_at: '2024-06-14T00:00:00Z' },
        { id: 'uuid-2', ...rows[1], created_at: '2024-06-14T00:00:00Z' },
      ];
      const select = jest.fn().mockResolvedValue({
        data: upsertedRows,
        error: null,
      });
      const upsert = jest.fn().mockReturnValue({ select });
      mockClient.from = jest.fn().mockReturnValue({
        upsert,
      }) as unknown as typeof mockClient.from;

      const result = await upsertBooks(mockClient, rows);

      expect(mockClient.from).toHaveBeenCalledWith('books');
      // @MX:NOTE: [AUTO] 단일 배치 호출 — 전체 배열을 한 번에 upsert (N+1 순차 쿼리 방지)
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledWith(rows, { onConflict: 'isbn' });
      expect(result).toEqual(upsertedRows);
    });

    it('빈 배열 입력 시 upsert 를 호출하지 않고 빈 배열을 반환한다', async () => {
      const result = await upsertBooks(mockClient, []);

      expect(result).toEqual([]);
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it('업서트 에러 시 에러를 throw 한다', async () => {
      const rows: BookUpsertRow[] = [
        {
          isbn: '1',
          title: 't',
          author: 'a',
          publisher: null,
          published_at: null,
          cover_url: null,
          total_pages: null,
          kakao_id: null,
        },
      ];
      const select = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'XX000', message: 'upsert failed' },
      });
      const upsert = jest.fn().mockReturnValue({ select });
      mockClient.from = jest.fn().mockReturnValue({
        upsert,
      }) as unknown as typeof mockClient.from;

      await expect(upsertBooks(mockClient, rows)).rejects.toThrow('upsert failed');
    });
  });
});
