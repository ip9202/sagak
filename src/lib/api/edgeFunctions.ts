/**
 * Edge Function 호출 공통 래퍼 (REQ-API-004)
 *
 * 모든 Edge Function 호출(kakao-book-search, process-join-request,
 * generate-completion-report, send-notification)의 단일 진입점이다.
 * supabase.functions.invoke 로 위임하며, 현재 세션 JWT 는 supabase-js 가
 * 자동으로 Authorization 헤더에 주입한다(REQ-API-004 / 시나리오 C5).
 *
 * 에러 처리:
 * - invoke 반환값에 error 가 있거나 throw 된 경우, 기존 에러 파이프라인의
 *   normalizeError 로 AppError 로 변환 후 throw 한다. 정규화 로직을 중복 구현하지 않는다.
 *
 * 재시도 정책:
 * - 기본값: 재시도 없음(아래 주석 참고). retryWithBackoff 를 호출하지 않는다.
 * - 이유: Edge Function 은 멱등성을 보장하지 않는다. 예컨대 process-join-request 는
 *   가입 요청 상태를 변경하고 알림을 발생시키며, send-notification 은 알림 row 를
 *   INSERT 한다. 네트워크 에러로 인한 재시도가 동일 부작용을 중복 발생시킬 수 있어
 *   안전한 기본값은 "재시도 금지"이다. 호출부가 해당 Function 이 멱등(예: 읽기 전용
 *   kakao-book-search)임을 확실히 알 때만 retryWithBackoff(invokeEdgeFunction) 형태로
 *   감싸서 재시도를 적용한다.
 */
import { getSupabaseClient } from '../supabase/client';
import { normalizeError } from './errors';
import type { AppError } from '../../errors';

/**
 * Supabase functions.invoke 응답 형태(최소 계약). 라이브러리 타입에 의존하지 않고
 * data/error 만 판별해 불필요한 제네릭 복잡도를 피한다.
 */
interface FunctionsInvokeResponse<T> {
  data: T | null;
  error: unknown;
}

// @MX:ANCHOR: [AUTO] 백엔드 Edge Function 호출의 단일 진입점 (public API boundary)
// @MX:REASON: 모든 Edge Function 호출(kakao-book-search, process-join-request, generate-completion-report, send-notification)이 이 함수를 거치며, 에러 정규화/JWT 주입 계약을 위반하면 도메인 전반의 호출이 고장난다.
/**
 * REQ-API-004: Edge Function 호출 래퍼.
 *
 * @param name - Edge Function 이름(예: 'kakao-book-search')
 * @param body - 요청 본문(선택). supabase.functions.invoke 의 { body } 로 전달.
 * @returns Edge Function 이 반환한 데이터
 * @throws {AppError} invoke 실패 시 normalizeError 로 정규화된 AppError
 */
export async function invokeEdgeFunction<T>(
  name: string,
  body?: Record<string, unknown>
): Promise<T> {
  const client = getSupabaseClient();

  try {
    // @MX:NOTE: [AUTO] supabase-js 가 현재 세션 JWT 를 Authorization 헤더에 자동 주입한다(REQ-API-004).
    const response = (await client.functions.invoke(name, {
      body,
    })) as FunctionsInvokeResponse<T>;

    // supabase-js 는 throw 대신 { data, error } 형태로 에러를 반환할 수 있다.
    if (response.error) {
      throw normalizeError(response.error);
    }

    // data 가 null 인 정상 응답도 허용(void Function 등).
    return response.data as T;
  } catch (error) {
    // 이미 normalizeError 가 만든 AppError 인 경우 동일 인스턴스를 그대로 throw.
    const normalized: AppError = normalizeError(error);
    throw normalized;
  }
}
