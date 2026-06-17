/**
 * useCompletionReport 훅 단위 테스트 (SPEC-COMPLETION-001, REQ-COMP-001/004/005)
 *
 * 검증 대상 (시나리오 7, 8, 12, 17):
 * - 초기 loading 상태
 * - 시나리오 8: 성공(total_records>=1) → status='success'
 * - 시나리오 7: 빈 상태(total_records=0) → status='empty'
 * - 시나리오 12 우: VALIDATION(data-error) → status='data-error'
 * - 시나리오 17: AUTH → status='auth'
 * - 네트워크/retriesExhausted → status='error'
 * - refetch() 로 재시도 가능
 *
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useCompletionReport } from '../useCompletionReport';
import { AppError } from '../../../errors';
import type { ReportData } from '../types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));

jest.mock('../completionApi', () => ({
  __esModule: true,
  fetchReport: jest.fn(),
}));

import { fetchReport } from '../completionApi';
const fetchMock = fetchReport as jest.MockedFunction<typeof fetchReport>;

function makeReport(overrides: Partial<ReportData> = {}): ReportData {
  return {
    emotion_curve: [{ page_number: 12, emotion_count: 3 }],
    highlights: [{ page_number: 12, content: '마음이 찡해졌다' }],
    total_records: 47,
    ...overrides,
  };
}

describe('SPEC-COMPLETION-001: useCompletionReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('초기 상태는 loading 이다', () => {
    fetchMock.mockReturnValue(new Promise<ReportData>(() => {}));
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('시나리오 8: 성공(total_records>=1) → status=success, data 세팅', async () => {
    fetchMock.mockResolvedValue(makeReport({ total_records: 47 }));
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.data?.total_records).toBe(47);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('시나리오 7: 빈 상태(total_records=0) → status=empty', async () => {
    fetchMock.mockResolvedValue(
      makeReport({ emotion_curve: [], highlights: [], total_records: 0 }),
    );
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.data?.total_records).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('시나리오 12 우: VALIDATION 에러 → status=data-error', async () => {
    const err = new AppError('schema', 'SCHEMA', 400);
    err.category = 'VALIDATION';
    fetchMock.mockRejectedValue(err);
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('data-error'));
    expect(result.current.error?.category).toBe('VALIDATION');
    expect(result.current.data).toBeNull();
  });

  it('시나리오 17: AUTH 에러 → status=auth', async () => {
    const err = new AppError('jwt expired', 'AUTH_ERROR', 401);
    err.category = 'AUTH';
    fetchMock.mockRejectedValue(err);
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('auth'));
    expect(result.current.error?.category).toBe('AUTH');
  });

  it('NETWORK/retriesExhausted 에러 → status=error', async () => {
    const err = new AppError('Failed to fetch', 'NETWORK_ERROR', 0);
    err.category = 'NETWORK';
    err.retriesExhausted = true;
    fetchMock.mockRejectedValue(err);
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error?.category).toBe('NETWORK');
    expect(result.current.error?.retriesExhausted).toBe(true);
  });

  it('refetch() 호출 시 fetchReport 를 다시 호출한다', async () => {
    fetchMock.mockResolvedValue(makeReport());
    const { result } = renderHook(() => useCompletionReport('ub-1'));
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await result.current.refetch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
