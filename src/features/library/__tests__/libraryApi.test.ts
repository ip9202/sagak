/**
 * libraryApi 단위 테스트 (CRUD)
 * SPEC-LIBRARY-001 — TASK-004 (M1: libraryApi types + CRUD query functions)
 *
 * 검증 대상:
 * - addBook: user_books INSERT (book_id, user_id, status)
 * - getLibrary: user_books SELECT with books join, last_progress_at DESC 정렬
 * - deleteBook: user_books DELETE
 * - UNIQUE 409(23505) → VALIDATION 분류
 * - RLS 42501 → RLS_DENIED 분류
 */
import { addBook, getLibrary, deleteBook } from '../libraryApi';
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

describe('SPEC-LIBRARY-001 TASK-004: libraryApi CRUD', () => {
  describe('addBook (INSERT)', () => {
    const insertMock = jest.fn();
    const selectMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ insert: insertMock, select: selectMock }),
      });
    });

    it('user_books 에 (book_id, user_id, status=reading) 을 INSERT 한다', async () => {
      const inserted = {
        id: 'ub-1',
        book_id: 'book-uuid-1',
        user_id: 'user-uuid-1',
        status: 'reading',
        current_page: null,
      };
      insertMock.mockReturnValue({ select: selectMock });
      selectMock.mockReturnValue({ single: jest.fn().mockResolvedValue({ data: inserted, error: null }) });

      const result = await addBook({ bookId: 'book-uuid-1', userId: 'user-uuid-1' });

      expect(insertMock).toHaveBeenCalledWith({
        book_id: 'book-uuid-1',
        user_id: 'user-uuid-1',
        status: 'reading',
      });
      expect(result).toMatchObject({ id: 'ub-1', book_id: 'book-uuid-1', status: 'reading' });
    });

    it('UNIQUE 위반(23505) 시 VALIDATION AppError 를 throw 한다 (이미 등록된 책)', async () => {
      insertMock.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate key value' },
          }),
        }),
      });

      await expect(
        addBook({ bookId: 'book-uuid-1', userId: 'user-uuid-1' }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    });

    it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
      insertMock.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: '42501', message: 'permission denied' },
          }),
        }),
      });

      await expect(
        addBook({ bookId: 'book-uuid-1', userId: 'user-uuid-1' }),
      ).rejects.toMatchObject({ name: 'AppError', category: 'RLS_DENIED' });
    });
  });

  describe('getLibrary (SELECT with books join)', () => {
    const orderMock = jest.fn();
    const eqMock = jest.fn();
    const selectMock = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      selectMock.mockReturnValue({ eq: eqMock });
      eqMock.mockReturnValue({ order: orderMock });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ select: selectMock }),
      });
    });

    it('user_id 로 필터링하고 books 조인, last_progress_at DESC 정렬로 조회한다', async () => {
      const rows = [
        {
          id: 'ub-1',
          book_id: 'b-1',
          user_id: 'u-1',
          status: 'reading',
          current_page: 120,
          books: { id: 'b-1', title: '호모 데우스', author: '유발 하라리', cover_url: null, total_pages: 480 },
        },
      ];
      orderMock.mockResolvedValue({ data: rows, error: null });

      const result = await getLibrary({ userId: 'u-1' });

      // books 조인 select 검증
      expect(selectMock).toHaveBeenCalledWith(
        '*, books(id,title,author,cover_url,total_pages)',
      );
      expect(eqMock).toHaveBeenCalledWith('user_id', 'u-1');
      // last_progress_at DESC 정렬 (PostgREST order(column, { ascending }) 형태)
      expect(orderMock).toHaveBeenCalledWith('last_progress_at', { ascending: false });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'ub-1', status: 'reading' });
      expect(result[0].books).toMatchObject({ title: '호모 데우스' });
    });

    it('status 필터를 전달하면 .eq(status, ...) 가 추가로 호출된다', async () => {
      orderMock.mockResolvedValue({ data: [], error: null });

      // status 필터 추가 시 eq 가 user_id + status 두 번 호출되어야 한다
      // 단순화: orderMock 이 filter 체인을 반환하도록 구성
      const statusEqMock = jest.fn().mockReturnValue({ order: orderMock });
      eqMock.mockReturnValue({ eq: statusEqMock });

      await getLibrary({ userId: 'u-1', status: 'reading' });

      expect(eqMock).toHaveBeenCalledWith('user_id', 'u-1');
      expect(statusEqMock).toHaveBeenCalledWith('status', 'reading');
    });

    it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
      orderMock.mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'permission denied' },
      });

      await expect(getLibrary({ userId: 'u-1' })).rejects.toMatchObject({
        name: 'AppError',
        category: 'RLS_DENIED',
      });
    });
  });

  describe('deleteBook (DELETE)', () => {
    // 체인: delete() → eq('id', id) → eq('user_id', userId) → (await)
    const firstEqArgs: string[] = [];
    const secondEqArgs: string[] = [];
    const finalResolve = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      firstEqArgs.length = 0;
      secondEqArgs.length = 0;
      finalResolve.mockReset();

      const secondEq = jest.fn((...args: unknown[]) => {
        secondEqArgs.push(...(args as string[]));
        return { data: null, error: null };
      });
      const firstEq = jest.fn((...args: unknown[]) => {
        firstEqArgs.push(...(args as string[]));
        return { eq: secondEq };
      });
      const deleteChain = jest.fn().mockReturnValue({ eq: firstEq });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ delete: deleteChain }),
      });
    });

    it('user_books 에서 id + user_id 복합 조건으로 DELETE 한다 (RLS 보조)', async () => {
      await deleteBook({ id: 'ub-1', userId: 'u-1' });

      expect(firstEqArgs).toEqual(['id', 'ub-1']);
      expect(secondEqArgs).toEqual(['user_id', 'u-1']);
    });

    it('RLS 거부(42501) 시 RLS_DENIED 로 분류한다', async () => {
      const rlsError = { code: '42501', message: 'permission denied' };
      const secondEq = jest.fn().mockResolvedValue({ data: null, error: rlsError });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
      const deleteChain = jest.fn().mockReturnValue({ eq: firstEq });
      (getSupabaseClient as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({ delete: deleteChain }),
      });

      await expect(deleteBook({ id: 'ub-1', userId: 'u-1' })).rejects.toMatchObject({
        name: 'AppError',
        category: 'RLS_DENIED',
      });
    });
  });
});
