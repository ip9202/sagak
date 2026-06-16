/**
 * React Query QueryClient 싱글턴 (SPEC-LIBRARY-001 TASK-001)
 *
 * 앱 전역에서 단일 QueryClient 인스턴스를 공유한다.
 * - _layout.tsx 의 QueryClientProvider 에 주입된다
 * - useQuery / useMutation 훅이 이 인스턴스를 통해 캐시를 공유한다
 *
 * 설계 의도:
 * - HMR(Hot Module Replacement) 중에도 인스턴스 중복 생성을 방지하기 위해
 *   globalThis 를 캐시 저장소로 사용한다 (공식 권장 패턴).
 * - 테스트 격리를 위해 resetQueryClient 를 노출한다.
 */
import { QueryClient } from '@tanstack/react-query';

// @MX:NOTE: [AUTO] globalThis 캐시 — HMR/테스트 환경에서 QueryClient 인스턴스 중복 생성 방지 (TanStack 공식 패턴)
// @MX:SPEC SPEC-LIBRARY-001
const QUERY_CLIENT_KEY = '__SAGAK_QUERY_CLIENT__';

type QueryClientHolder = { [K in typeof QUERY_CLIENT_KEY]?: QueryClient };

function getGlobalHolder(): QueryClientHolder {
  // globalThis 에 키가 없으면 빈 홀더로 취급
  return globalThis as unknown as QueryClientHolder;
}

/**
 * QueryClient 의 기본 옵션을 정의한다.
 *
 * staleTime: 0 — 쿼리는 즉시 stale 상태가 되어 refetch 가 자유롭게 일어난다.
 *   (SPEC-LIBRARY-001 의 서재/진행률 데이터는 최신성이 중요하므로
 *    캐시 우선보다 네트워크 우선 전략을 기본값으로 채택)
 * retry: 1 — 일시적 네트워크 장애에 대해 1회 재시도.
 *   (classifyError 가 NETWORK 로 분류한 경우 retryWithBackoff 를 별도 적용할 수 있음)
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * 전역 QueryClient 싱글턴을 반환한다.
 *
 * 최초 호출 시 인스턴스를 생성하여 globalThis 에 캐싱하고,
 * 이후 호출에서는 동일 인스턴스를 반환한다.
 *
 * @returns 앱 전역 공유 QueryClient
 */
export function getQueryClient(): QueryClient {
  const holder = getGlobalHolder();
  if (!holder[QUERY_CLIENT_KEY]) {
    holder[QUERY_CLIENT_KEY] = createQueryClient();
  }
  return holder[QUERY_CLIENT_KEY] as QueryClient;
}

/**
 * QueryClient 싱글턴을 초기화한다 (테스트 전용).
 *
 * 프로덕션 코드에서는 호출하지 않는다.
 */
export function resetQueryClient(): void {
  const holder = getGlobalHolder();
  delete holder[QUERY_CLIENT_KEY];
}
