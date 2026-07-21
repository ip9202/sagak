/**
 * completionApi 단위 테스트 (SPEC-COMPLETION-001, REQ-COMP-001/003/004/005)
 *
 * 검증 대상 (시나리오 1, 2, 4, 6, 16, 17):
 * - 시나리오 1: 1회 조회 성공 → ReportData 반환
 * - 시나리오 2 좌: 첫 호출 NETWORK 에러 → 재시도 후 성공
 * - 시나리오 2 우 / 16: 3회 빈 응답 → retriesExhausted=true, NETWORK/빈 상태 에러 throw
 * - 시나리오 4: 타인 user_book_id → RLS 로 null → 빈 응답으로 재시도 후 실패 (RLS 신뢰, user_id 미전송)
 * - 시나리오 6: 스키마 불일치 → AppError(category=VALIDATION) 즉시 throw (재시도 X)
 * - 시나리오 17: 401 → AppError(category=AUTH) 즉시 throw (재시도 X)
 * - user_id 는 쿼리에 전송하지 않는다 (RLS auth.uid() 자동 주입)
 */
import { fetchReport } from '../completionApi';
import { getSupabaseClient } from '../../../lib/supabase/client';
import { AppError } from '../../../errors';

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
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));

const VALID_REPORT = {
  emotion_curve: [{ page_number: 12, emotion_count: 3 }],
  highlights: [{ page_number: 12, content: '마음이 찡해졌다' }],
  total_records: 47,
};

describe('SPEC-COMPLETION-001: completionApi.fetchReport', () => {
  const selectMock = jest.fn();
  const eqMock = jest.fn();
  const maybeSingleMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({ select: selectMock }),
    });
  });

  it('시나리오 1: 1회 조회로 ReportData 를 반환한다', async () => {
    maybeSingleMock.mockResolvedValue({ data: { report_data: VALID_REPORT }, error: null });

    const result = await fetchReport('ub-1');

    expect(result.total_records).toBe(47);
    expect(result.emotion_curve[0].page_number).toBe(12);
    // user_id 는 쿼리 조건에 전송하지 않는다 (RLS auth.uid() 자동 주입)
    expect(eqMock).toHaveBeenCalledWith('user_book_id', 'ub-1');
    const allEqArgs = eqMock.mock.calls.map((c) => c[0]);
    expect(allEqArgs).not.toContain('user_id');
  });

  it('select 컬럼은 report_data 만 요청한다', async () => {
    maybeSingleMock.mockResolvedValue({ data: { report_data: VALID_REPORT }, error: null });
    await fetchReport('ub-1');
    expect(selectMock).toHaveBeenCalledWith('report_data');
  });

  it('시나리오 2 좌: 첫 호출 NETWORK 에러 후 재시도로 성공한다', async () => {
    const networkErr = new TypeError('Failed to fetch');
    maybeSingleMock
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce({ data: { report_data: VALID_REPORT }, error: null });

    const result = await fetchReport('ub-1');

    expect(result.total_records).toBe(47);
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it('시나리오 2 우: 3회 모두 빈 응답이면 retriesExhausted=true 와 함께 throw', async () => {
    // RLS 로 타인 행이면 data 가 null 로 온다 (maybeSingle). 빈 응답 = data 없음.
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(fetchReport('ub-1')).rejects.toThrow();
    expect(maybeSingleMock).toHaveBeenCalledTimes(3);
  });

  it('시나리오 2 우: 3회 실패 시 throw 되는 에러는 retriesExhausted=true 이다', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    try {
      await fetchReport('ub-1');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).retriesExhausted).toBe(true);
    }
  });

  it('시나리오 4: 타인 user_book_id 조회 → RLS null → 3회 재시도 후 실패 (user_id 미전송 신뢰)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(fetchReport('others-ub')).rejects.toThrow();
    expect(eqMock).toHaveBeenCalledWith('user_book_id', 'others-ub');
    // 클라이언트 측 user_id 검증 로직은 없다 (RLS 신뢰)
    const allEqArgs = eqMock.mock.calls.map((c) => c[0]);
    expect(allEqArgs).not.toContain('user_id');
  });

  it('시나리오 6: report_data 스키마 불일치 → VALIDATION AppError 즉시 throw (재시도 X)', async () => {
    const invalidReport = { emotion_curve: [], highlights: [] }; // total_records 누락
    maybeSingleMock.mockResolvedValue({ data: { report_data: invalidReport }, error: null });

    try {
      await fetchReport('ub-1');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).category).toBe('VALIDATION');
    }
    // 스키마 불일치는 재시도하지 않는다
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('시나리오 17: 401 Unauthorized → AUTH AppError 즉시 throw (재시도 X)', async () => {
    maybeSingleMock.mockResolvedValue({
      data: null,
      error: { code: 'PGRST301', message: 'jwt expired', status: 401 },
    });

    try {
      await fetchReport('ub-1');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).category).toBe('AUTH');
    }
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('PostgREST error 필드가 있고 네트워크성이면 재시도한다', async () => {
    maybeSingleMock
      .mockResolvedValueOnce({ data: null, error: { message: 'network request failed', status: 0 } })
      .mockResolvedValueOnce({ data: { report_data: VALID_REPORT }, error: null });

    const result = await fetchReport('ub-1');
    expect(result.total_records).toBe(47);
    expect(maybeSingleMock).toHaveBeenCalledTimes(2);
  });

  it('빈 상태(total_records=0) report_data 는 정상 반환된다 (에러 아님)', async () => {
    const emptyReport = { emotion_curve: [], highlights: [], total_records: 0 };
    maybeSingleMock.mockResolvedValue({ data: { report_data: emptyReport }, error: null });

    const result = await fetchReport('ub-1');
    expect(result.total_records).toBe(0);
    expect(result.emotion_curve).toEqual([]);
    // 빈 상태는 재시도 없이 1회 반환
    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
  });

  it('3회 네트워크 에러 지속 시 retriesExhausted=true', async () => {
    const networkErr = new TypeError('Failed to fetch');
    maybeSingleMock.mockRejectedValue(networkErr);

    try {
      await fetchReport('ub-1');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).retriesExhausted).toBe(true);
      expect((e as AppError).category).toBe('NETWORK');
    }
    expect(maybeSingleMock).toHaveBeenCalledTimes(3);
  });
});
