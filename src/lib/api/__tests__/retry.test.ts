/**
 * 재시도 로직 테스트
 * REQ-API-013: 지수 백오프 재시도
 *
 * 인수 시나리오 E2 (NETWORK 재시도), E6 (SERVER 재시도), E3/E4 (재시도 없음) 커버
 */
import { retryWithBackoff } from '../retry';
import { AppError } from '../../../errors';

describe('retryWithBackoff (REQ-API-013)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('첫 호출이 성공하면 재시도 없이 값을 반환한다', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await retryWithBackoff(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NETWORK 에러는 최대 3회 재시도 후 최종 에러를 throw한다 (시나리오 E2)', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fn = jest.fn<Promise<string>, []>().mockRejectedValue(networkError);

    // 즉시 거부 핸들러를 붙여 unhandled rejection 방지
    const settledPromise = retryWithBackoff(fn).catch((e: unknown) => e);

    // 초기 호출 (attempt 0)
    expect(fn).toHaveBeenCalledTimes(1);

    // 백오프 1초 대기 후 재시도 1
    await jest.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // 백오프 2초 대기 후 재시도 2
    await jest.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    // 백오프 4초 대기 후 재시도 3
    await jest.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(4);

    // 더 이상 재시도하지 않는다
    await jest.advanceTimersByTimeAsync(100000);
    expect(fn).toHaveBeenCalledTimes(4);

    const settled = await settledPromise;
    expect(settled).toBeInstanceOf(AppError);
    expect((settled as AppError).category).toBe('NETWORK');
    expect((settled as AppError).retriesExhausted).toBe(true);
  });

  it('SERVER 에러도 재시도한다 (시나리오 E6)', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ message: 'internal', status: 500 });

    const settledPromise = retryWithBackoff(fn).catch((e: unknown) => e);

    await jest.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(4); // 초기 + 3회 재시도

    const settled = await settledPromise;
    expect(settled).toBeInstanceOf(AppError);
    expect((settled as AppError).category).toBe('SERVER');
  });

  it('AUTH 에러는 재시도하지 않고 즉시 throw한다 (시나리오 E4)', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ message: 'JWT expired', status: 401 });

    await expect(retryWithBackoff(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);

    // 시간이 흘러도 추가 호출 없음
    jest.advanceTimersByTime(10000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('RLS_DENIED 에러는 재시도하지 않는다 (시나리오 E3)', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ message: 'denied', code: '42501' });

    const err = await retryWithBackoff(fn).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).category).toBe('RLS_DENIED');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('VALIDATION 에러는 재시도하지 않는다', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ message: 'dup', code: '23505' });

    await expect(retryWithBackoff(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('NOT_FOUND 에러는 재시도하지 않는다', async () => {
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue({ message: 'none', code: 'PGRST116' });

    await expect(retryWithBackoff(fn)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('재시도 중 성공하면 성공값을 반환한다', async () => {
    const networkError = new TypeError('Failed to fetch');
    const fn = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce('recovered');

    const promise = retryWithBackoff(fn);

    await jest.advanceTimersByTimeAsync(1000); // 재시도 1 실패
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(2000); // 재시도 2 성공
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe('recovered');
  });
});
