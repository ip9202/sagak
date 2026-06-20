/**
 * sessionApi 단위 테스트 (SPEC-ROUTINE-001 REQ-ROUT-001/002)
 *
 * RPC 기반 전환 후 검증 대상:
 * - R1/R2: startSession → client.rpc('start_reading_session', {p_book_id}) 정확한 인자 전달
 * - R4/R5: endSession → client.rpc('end_reading_session', {p_session_id, p_pages_read}) 정확한 인자
 * - getActiveSession: RLS 기반 조회(is('ended_at', null))
 * - 에러 정규화 — normalizeError 경유
 *
 * 핵심: permissive chainable mock 대신 client.rpc 가 정확한 함수명/인자로 호출되었는지
 * 검증한다. RPC 계약 회귀(잘못된 함수명/파라미터)를 즉시 잡기 위함.
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
 * RPC 호출을 정확히 기록하는 mock 클라이언트 팩토리.
 * rpc(fn, args) 호출을 캡처해 계약 위반을 잡는다.
 */
function createRpcMock(
  terminal: { data: unknown; error: unknown },
): {
  rpc: jest.Mock;
  from: jest.Mock;
  builder: Record<string, jest.Mock>;
} {
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

  const rpc = jest.fn().mockResolvedValue(terminal);
  const from = jest.fn().mockReturnValue(builder);
  return { rpc, from, builder };
}

describe('SPEC-ROUTINE-001 REQ-ROUT-001/002: sessionApi (RPC)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startSession — REQ-ROT-001/002', () => {
    it('R1/R2: start_reading_session RPC 를 정확한 인자로 호출하고 새 세션 id 반환', async () => {
      const { rpc, from } = createRpcMock({
        data: [{ id: 'new-session-id' }],
        error: null,
      });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc, from });

      const result = await startSession('book-1');

      // RPC 계약 검증 — 정확한 함수명과 인자 객체
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('start_reading_session', {
        p_book_id: 'book-1',
      });
      // from() 사용 금지 — 시작 경로는 RPC 만 사용
      expect(from).not.toHaveBeenCalled();
      // 새 세션 id 추출
      expect(result).toBe('new-session-id');
    });

    it('RPC 응답이 단일 객체({id}) 형태여도 id 추출', async () => {
      const { rpc } = createRpcMock({
        data: { id: 'single-id' },
        error: null,
      });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      const result = await startSession('book-2');
      expect(result).toBe('single-id');
    });

    it('RPC 응답에 id 없으면 null 반환', async () => {
      const { rpc } = createRpcMock({ data: null, error: null });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      const result = await startSession('book-3');
      expect(result).toBeNull();
    });

    it('Supabase RPC 에러 → normalizeError 로 throw', async () => {
      const { rpc } = createRpcMock({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      await expect(startSession('book-1')).rejects.toMatchObject({
        category: 'RLS_DENIED',
      });
    });
  });

  describe('endSession — REQ-ROT-002', () => {
    it('R4/R5: pagesRead 미전달 시 p_pages_read 생략 (RPC DEFAULT NULL 적용)', async () => {
      const { rpc } = createRpcMock({ data: null, error: null });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      await endSession('session-A');

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('end_reading_session', {
        p_session_id: 'session-A',
      });
    });

    it('R5: pagesRead 전달 시 p_pages_read 에 값 전달', async () => {
      const { rpc } = createRpcMock({ data: null, error: null });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      await endSession('session-A', 15);

      expect(rpc).toHaveBeenCalledWith('end_reading_session', {
        p_session_id: 'session-A',
        p_pages_read: 15,
      });
    });

    it('pagesRead=0 전달 시 p_pages_read=0 (COALESCE 가 0 을 유지값으로 취급)', async () => {
      const { rpc } = createRpcMock({ data: null, error: null });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      await endSession('session-A', 0);

      expect(rpc).toHaveBeenCalledWith('end_reading_session', {
        p_session_id: 'session-A',
        p_pages_read: 0,
      });
    });

    it('Supabase RPC 에러 → normalizeError 로 throw', async () => {
      const { rpc } = createRpcMock({
        data: null,
        error: { code: 'PT0401', message: 'rpc not found' },
      });
      (getSupabaseClient as jest.Mock).mockReturnValue({ rpc });

      await expect(endSession('session-A')).rejects.toMatchObject({
        category: expect.any(String),
      });
    });
  });

  describe('getActiveSession — 보조 조회 (RLS)', () => {
    it('활성 세션(ended_at IS NULL) 을 maybeSingle 로 조회한다', async () => {
      const { builder, from } = createRpcMock({
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
      (getSupabaseClient as jest.Mock).mockReturnValue({ from, rpc: jest.fn() });

      const result = await getActiveSession();
      expect(result?.id).toBe('s1');
      // RLS 단독 — user_id 클라이언트 필터 없이 ended_at IS NULL 만
      expect(builder.is).toHaveBeenCalledWith('ended_at', null);
      expect(builder.eq).not.toHaveBeenCalledWith(
        'user_id',
        expect.anything(),
      );
    });

    it('활성 세션 없으면 null 반환', async () => {
      const { from } = createRpcMock({ data: null, error: null });
      (getSupabaseClient as jest.Mock).mockReturnValue({ from, rpc: jest.fn() });

      const result = await getActiveSession();
      expect(result).toBeNull();
    });

    it('조회 에러 → normalizeError 로 throw', async () => {
      const { from } = createRpcMock({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });
      (getSupabaseClient as jest.Mock).mockReturnValue({ from, rpc: jest.fn() });

      await expect(getActiveSession()).rejects.toMatchObject({
        category: 'RLS_DENIED',
      });
    });
  });
});
