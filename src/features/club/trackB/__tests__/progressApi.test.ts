/**
 * SPEC-CLUB-002 M2: progressApi 단위 테스트
 *
 * 검증 대상 (acceptance S13~S16):
 * - updateProgress: clubs 진도 UPDATE (daily_pages, trigger_page) — REQ-CLUBB-009
 * - 비host 차단 (RLS 42501 → RLS_DENIED) — REQ-CLUBB-010
 * - 입력 검증 (음수/비정수 → VALIDATION) — REQ-CLUBB-011
 * - closed 모임 진도 업데이트 사전 차단 — REQ-CLUBB-012
 *
 * 권한 모델: RLS(clubs_update_own — auth.uid() = host_id)가 host 만 UPDATE 허용.
 * 클라이언트는 호출만 수행하며, DB 가 단일 신뢰 경로로 강제한다.
 */
import { updateProgress } from '../progressApi';
import type { UpdateProgressInput } from '../progressApi';
import { getSupabaseClient } from '../../../../lib/supabase/client';

jest.mock('../../../../lib/supabase/client', () => ({
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

describe('SPEC-CLUB-002 M2 REQ-CLUBB-009: updateProgress (host 성공)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('daily_pages 와 trigger_page 를 clubs 에 UPDATE 한다 (S13)', async () => {
    // DB 가 active 행 1건 반환 → affected rows 1
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', status: 'active' }],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    const input: UpdateProgressInput = {
      dailyPages: 30,
      triggerPage: 100,
    };
    await updateProgress('c1', input);

    expect(fromMock).toHaveBeenCalledWith('clubs');
    // 컬럼명은 snake_case (gen-types clubs.Update)
    expect(updateMock).toHaveBeenCalledWith({
      daily_pages: 30,
      trigger_page: 100,
    });
    // W1: DB 레벨 status='active' 조건으로 closed 행 자동 제외
    expect(eqIdMock).toHaveBeenCalledWith('id', 'c1');
    expect(eqStatusMock).toHaveBeenCalledWith('status', 'active');
  });

  it('trigger_page 만 부분 업데이트 시 미전달 필드는 payload 에서 제외된다', async () => {
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', status: 'active' }],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await updateProgress('c1', { triggerPage: 50 });

    expect(updateMock).toHaveBeenCalledWith({ trigger_page: 50 });
  });

  it('null 전달 시 해당 컬럼을 NULL 로 UPDATE (진도 초기화 허용)', async () => {
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', status: 'active' }],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await updateProgress('c1', { dailyPages: null });

    expect(updateMock).toHaveBeenCalledWith({ daily_pages: null });
  });
});

describe('SPEC-CLUB-002 M2 REQ-CLUBB-010: 비host RLS 거부', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('RLS 거부(42501) 시 RLS_DENIED AppError throw (S14)', async () => {
    // DB 가 명시적 42501 에러 반환 → RLS_DENIED 분류 (0 rows 와 구분됨)
    const selectMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 10 }),
    ).rejects.toMatchObject({
      name: 'AppError',
      category: 'RLS_DENIED',
    });
  });

  it('쿼리 throw(TypeError) 시 normalizeError → NETWORK', async () => {
    const selectMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 10 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'NETWORK' });
  });
});

describe('SPEC-CLUB-002 M2 REQ-CLUBB-011: 입력 검증 (음수/비정수)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('음수 dailyPages 시 VALIDATION 에러 throw, UPDATE 미호출 (S15)', async () => {
    const updateMock = jest.fn();
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: -1 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('음수 triggerPage 시 VALIDATION 에러 throw', async () => {
    const updateMock = jest.fn();
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { triggerPage: -5 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('비정수 dailyPages 시 VALIDATION 에러 throw', async () => {
    const updateMock = jest.fn();
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      // 의도적으로 정수가 아닌 값 전달
      updateProgress('c1', { dailyPages: 3.5 as unknown as number }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('0 은 유효한 값으로 허용된다 (CHECK >= 0 와 일치)', async () => {
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', status: 'active' }],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 0, triggerPage: 0 }),
    ).resolves.toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith({
      daily_pages: 0,
      trigger_page: 0,
    });
  });
});

describe('SPEC-CLUB-002 M2 REQ-CLUBB-012: closed 모임 진도 업데이트 차단', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('status=closed 전달 시 VALIDATION 에러 throw, UPDATE 미호출 (S16 클라이언트 사전 차단)', async () => {
    const updateMock = jest.fn();
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 10 }, { status: 'closed' }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('status=active 전달 시 정상 UPDATE 진행', async () => {
    // DB 가 active 행 1건 반환 → affected rows 1 → 성공
    const selectMock = jest.fn().mockResolvedValue({
      data: [{ id: 'c1', status: 'active' }],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 10 }, { status: 'active' }),
    ).resolves.toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith({ daily_pages: 10 });
    // DB 레벨 status='active' 조건이 추가되어야 함 (W1 TOCTOU 방어)
    expect(eqIdMock).toHaveBeenCalledWith('id', 'c1');
    expect(eqStatusMock).toHaveBeenCalledWith('status', 'active');
  });

  it('DB 가 closed 행이라 0 rows 갱신 시 VALIDATION 에러 throw (W1 DB 레벨 차단)', async () => {
    // 클라이언트는 status 를 모름(stale) → 사전 차단 통과.
    // 하지만 DB UPDATE ... WHERE status='active' 가 0 rows(이미 closed) → 차단.
    const selectMock = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      // status 미전달 → 사전 차단 통과 → DB 에서 closed 로 0 rows
      updateProgress('c1', { dailyPages: 10 }),
    ).rejects.toMatchObject({ name: 'AppError', category: 'VALIDATION' });
    expect(updateMock).toHaveBeenCalledWith({ daily_pages: 10 });
    expect(eqStatusMock).toHaveBeenCalledWith('status', 'active');
  });

  it('host 가 아니어도 0 rows 반환 → VALIDATION/RLS 범주로 차단 (W1 host+closed 혼합)', async () => {
    // 비host 의 경우 RLS 가 USING 절로 행을 필터링하여 0 rows 반환.
    // UPDATE ... .select() 가 빈 배열 반환 → VALIDATION throw (host 아님/closed 구분 불가 → 범주 처리).
    const selectMock = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const eqStatusMock = jest.fn().mockReturnValue({ select: selectMock });
    const eqIdMock = jest.fn().mockReturnValue({ eq: eqStatusMock });
    const updateMock = jest.fn().mockReturnValue({ eq: eqIdMock });
    const fromMock = jest.fn().mockReturnValue({ update: updateMock });
    (getSupabaseClient as jest.Mock).mockReturnValue({ from: fromMock });

    await expect(
      updateProgress('c1', { dailyPages: 10 }, { status: 'active' }),
    ).rejects.toMatchObject({ name: 'AppError' });
  });
});
