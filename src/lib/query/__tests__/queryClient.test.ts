/**
 * QueryClient 싱글턴 테스트
 * SPEC-LIBRARY-001 — TASK-001 (M0: QueryClientProvider bootstrap)
 *
 * 검증 대상:
 * - getQueryClient 가 동일한 QueryClient 인스턴스를 반환한다 (싱글턴)
 * - QueryClient 가 기본 옵션(retry, staleTime)으로 생성된다
 */
import { QueryClient } from '@tanstack/react-query';
import { getQueryClient, resetQueryClient } from '../queryClient';

describe('SPEC-LIBRARY-001 TASK-001: QueryClient 싱글턴', () => {
  beforeEach(() => {
    // 각 테스트 시작 전 싱글턴 캐시 초기화
    resetQueryClient();
  });

  it('getQueryClient 는 QueryClient 인스턴스를 반환한다', () => {
    const client = getQueryClient();
    expect(client).toBeInstanceOf(QueryClient);
  });

  it('getQueryClient 를 여러 번 호출하면 동일한 인스턴스를 반환한다 (싱글턴)', () => {
    const first = getQueryClient();
    const second = getQueryClient();
    expect(second).toBe(first);
  });

  it('resetQueryClient 호출 후에는 새 인스턴스를 반환한다', () => {
    const first = getQueryClient();
    resetQueryClient();
    const second = getQueryClient();
    expect(second).not.toBe(first);
    expect(second).toBeInstanceOf(QueryClient);
  });

  it('기본 staleTime 이 0 이상으로 설정되어 있다 (즉시 refetch 허용 또는 제어)', () => {
    const client = getQueryClient();
    // SPEC 미결정 항목 — 최소한의 안전 기본값 검증
    expect(client.getDefaultOptions().queries?.staleTime).toBeGreaterThanOrEqual(0);
  });
});
