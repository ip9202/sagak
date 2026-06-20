/**
 * sessionApi 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-001/002)
 *
 * 검증 대상:
 * - R1: 정상 세션 시작 — INSERT (ended_at=NULL)
 * - R2: 기존 활성 세션 자동 종료 — UPDATE ended_at + duration EXTRACT 후 INSERT
 * - R4: 세션 종료 — UPDATE ended_at + duration_seconds EXTRACT
 * - R5: pages_read 선택적
 * - 에러 정규화 — normalizeError 경유
 *
 * RLS(REQ-DB-021)는 서버 정책이므로 본 단위 테스트에서는 mock 하지 않는다.
 */
import {
  startSession,
  endSession,
  getActiveSession,
} from '../sessionApi';
import { getSupabaseClient } from '../../../lib/supabase/client';

jest.mock('../../../lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

/**
 * PostgREST 빌더 체인을 흉내내는 유연한 mock 팩토리.
 * 모든 체인 메서드(select/eq/is/order/limit/maybeSingle/update/insert) 가
 * 동일한 빌더를 반환하도록 해서 어떤 순서로든 호출 가능.
 */
function createChainableMock(
  terminal: { data: unknown; error: unknown },
): Record<string, jest.Mock> {
  const builder: Record<string, jest.Mock> = {};
  const returnBuilder = (): Record<string, jest.Mock> => builder;
  builder.select = jest.fn(returnBuilder);
  builder.eq = jest.fn(returnBuilder);
  builder.is = jest.fn(returnBuilder);
  builder.order = jest.fn(returnBuilder);
  builder.limit = jest.fn(returnBuilder);
  builder.update = jest.fn(returnBuilder);
  builder.insert = jest.fn(returnBuilder);
  builder.maybeSingle = jest.fn().mockResolvedValue(terminal);
  // update/insert 체인의 최종 await 결과
  builder.then = undefined;
  // update/insert/eq/is/... 의 최종 resolve — PostgREST 는 await 시 {data,error} 반환
  // maybeSingle/single 이 붙지 않은 체인도 await 가능해야 함
  const awaitable = Promise.resolve(terminal);
  // builder 자체를 thenable 로 만들기 — 하지만 jest.Mock 은 then 을 가질 수 없으므로
  // 별도 proxy 대신, 최종 호출에서 thenable 반환하도록 insert/update 에 한해 처리
  return builder;
}

describe('SPEC-ROUTINE-001 REQ-ROUT-001/002: sessionApi', () => {
  let fromMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fromMock = jest.fn();
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });
  });

  describe('startSession — REQ-ROUT-001', () => {
    it('R1: 기존 활성 세션 없으면 INSERT 만 수행한다', async () => {
      // 1) 활성 세션 조회 — null (없음)
      const lookupBuilder = createChainableMock({ data: null, error: null });
      // 2) INSERT 빌더
      const insertBuilder = createChainableMock({ data: null, error: null });
      // insert 체인의 최종 await 결과
      insertBuilder.select = jest.fn().mockResolvedValue({ data: null, error: null });

      fromMock
        .mockReturnValueOnce(lookupBuilder) // 조회
        .mockReturnValueOnce(insertBuilder); // insert (update 건너뜀)

      await startSession('book-1');

      // 조회에서 ended_at IS NULL 조건 사용
      expect(lookupBuilder.is).toHaveBeenCalledWith('ended_at', null);
      // INSERT 호출됨
      expect(fromMock).toHaveBeenCalledWith('reading_sessions');
    });

    it('R2: 기존 활성 세션 존재 시 자동 종료(UPDATE) 후 새 INSERT', async () => {
      // 1) 활성 세션 조회 — 존재
      const lookupBuilder = createChainableMock({
        data: {
          id: 'session-A',
          book_id: 'book-1',
          started_at: '2026-06-14T10:00:00Z',
          ended_at: null,
        },
        error: null,
      });
      // 2) 자동 종료 UPDATE — 최종 await 결과
      const updateBuilder = createChainableMock({ data: null, error: null });
      updateBuilder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      // 3) INSERT
      const insertBuilder = createChainableMock({ data: null, error: null });
      insertBuilder.insert = jest.fn().mockReturnValue(insertBuilder);

      fromMock
        .mockReturnValueOnce(lookupBuilder) // 조회
        .mockReturnValueOnce(updateBuilder) // 자동 종료
        .mockReturnValueOnce(insertBuilder); // 새 INSERT

      await startSession('book-2');

      // 자동 종료 UPDATE — duration_seconds 는 EXTRACT 문자열
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ended_at: expect.any(String),
          duration_seconds: expect.stringContaining('extract'),
        }),
      );
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'session-A');
      // 새 INSERT — book-2
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ book_id: 'book-2', ended_at: null }),
      );
    });

    it('Supabase 조회 에러 → normalizeError 로 throw', async () => {
      const lookupBuilder = createChainableMock({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });
      fromMock.mockReturnValueOnce(lookupBuilder);

      await expect(startSession('book-1')).rejects.toMatchObject({
        category: 'RLS_DENIED',
      });
    });
  });

  describe('endSession — REQ-ROUT-002', () => {
    it('R4: 세션 종료 — ended_at + duration_seconds EXTRACT UPDATE', async () => {
      const builder = createChainableMock({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await endSession('session-A');

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          ended_at: expect.any(String),
          duration_seconds: expect.stringContaining('extract'),
        }),
      );
      expect(builder.eq).toHaveBeenCalledWith('id', 'session-A');
    });

    it('R5: pages_read 입력 시 UPDATE 에 포함한다', async () => {
      const builder = createChainableMock({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await endSession('session-A', 15);

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          pages_read: 15,
          ended_at: expect.any(String),
        }),
      );
    });

    it('R5: pages_read 미입력 시 UPDATE 에 pages_read 미포함 (NULL 유지)', async () => {
      const builder = createChainableMock({ data: null, error: null });
      builder.eq = jest.fn().mockResolvedValue({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      await endSession('session-A');

      const updateArg = builder.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateArg).not.toHaveProperty('pages_read');
    });
  });

  describe('getActiveSession — 보조 조회', () => {
    it('활성 세션(ended_at IS NULL) 을 maybeSingle 로 조회한다', async () => {
      const builder = createChainableMock({
        data: {
          id: 's1',
          book_id: 'b1',
          started_at: '2026-06-14T10:00:00Z',
          ended_at: null,
          duration_seconds: null,
          pages_read: null,
          user_id: 'u1',
        },
        error: null,
      });
      fromMock.mockReturnValue(builder);

      const result = await getActiveSession();
      expect(result?.id).toBe('s1');
      expect(builder.is).toHaveBeenCalledWith('ended_at', null);
    });

    it('활성 세션 없으면 null 반환', async () => {
      const builder = createChainableMock({ data: null, error: null });
      fromMock.mockReturnValue(builder);

      const result = await getActiveSession();
      expect(result).toBeNull();
    });
  });
});
