// @MX:NOTE: [AUTO] 네이버 userinfo 프록시 — Supabase Custom OIDC 용.
//   네이버 사용자정보 응답은 비표준 중첩 구조(resultcode/message/response)이며
//   최상위 sub 가 없어 Supabase 가 "error missing provider id" 로 실패한다.
//   본 함수는 네이버 access_token 을 받아 /v1/nid/me 를 호출한 뒤
//   표준 OIDC userinfo(sub/email/name/picture) 로 평탄화해 반환한다.
/**
 * naver-userinfo-proxy Edge Function (SPEC-AUTH-001)
 *
 * 목적:
 *  - Supabase Custom OIDC 의 userinfo URL 로 지정된다.
 *  - 호출자는 Supabase Auth 서버이며 Authorization: Bearer <naver_access_token> 을 보낸다.
 *  - 네이버 비표준 중첩 응답을 평탄화하여 표준 OIDC userinfo 를 반환한다.
 *
 * 동작:
 *  1. Bearer 토큰 추출 (누락/빈값 → 401 missing_token)
 *  2. https://openapi.naver.com/v1/nid/me 호출 (네트워크 실패 → 502)
 *  3. resultcode === "00" 검증 (실패 → 502 naver_api_error)
 *  4. response.{id,email,nickname,profile_image} → {sub,email,name,picture} 평탄화
 *     - null/빈값 필드는 omit (네이버는 email scope 미지원 시 생략)
 *  5. 200 application/json 반환
 *
 * 보안:
 *  - 서버-서버 호출이므로 CORS 미설정.
 *  - access_token 은 절대 로깅하지 않는다 (에러 로그 시 redact).
 *  - verify_jwt=false 로 배포: 호출자가 Supabase JWT 가 아닌 네이버 토큰을 전달.
 */

const NAVER_USERINFO_URL = 'https://openapi.naver.com/v1/nid/me';

/** 네이버 /v1/nid/me 원본 응답 타입. */
interface NaverUserinfoResponse {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    nickname?: string;
    profile_image?: string;
    // 네이버는 추가 필드(name, age, gender, birthday 등)를 반환할 수 있으나
    // 본 프록시는 Supabase OIDC 에 필요한 최소 필드만 평탄화한다.
    [key: string]: unknown;
  };
}

/** 최종 반환할 표준 OIDC userinfo (평탄화 결과). */
interface StandardUserinfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Authorization 헤더에서 Bearer 토큰을 추출한다.
 * @returns 토큰 문자열. 헤더 누락/형식 오류/빈값이면 null.
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * 값이 비어있지 않은(non-empty) 문자열인지 검사. 빈값은 OIDC 응답에서 생략한다.
 */
function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 표준화된 JSON 에러 응답을 생성한다. */
function errorResponse(
  status: number,
  error: string,
  detail?: string,
): Response {
  const body: Record<string, unknown> = { error };
  if (detail !== undefined) body.detail = detail;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 네이버 userinfo 원본 응답을 표준 OIDC userinfo 로 평탄화한다.
 * - sub(response.id)는 필수. 누락 시 null 반환 (호출측에서 502 처리).
 * - email/name/picture 중 빈값은 생략한다.
 */
function flattenToStandard(
  naver: NaverUserinfoResponse,
): StandardUserinfo | null {
  const inner = naver.response;
  if (!inner || !isNonEmpty(inner.id)) {
    return null;
  }
  const result: StandardUserinfo = { sub: inner.id };
  if (isNonEmpty(inner.email)) {
    result.email = inner.email;
    // @MX:NOTE: [AUTO] 네이버 email 을 verified 로 표시. Supabase Custom OIDC 는 email_verified=true
    //           일 때만 auth.users.email 에 기록하며, 같은 email 의 다른 provider(kakao 등) 와
    //           account linking(auto-linking) 한다.
    //           @MX:REASON: 이 값이 없으면 auth.users.email 이 NULL 로 남아 카카오와 연동되지 않는다.
    result.email_verified = true;
  }
  if (isNonEmpty(inner.nickname)) result.name = inner.nickname;
  if (isNonEmpty(inner.profile_image)) result.picture = inner.profile_image;
  return result;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // OPTIONS 에 대한 사전 요청 처리는 불필요(서버-서버). 메서드는 GET 만 허용.
  if (req.method !== 'GET') {
    return errorResponse(405, 'method_not_allowed');
  }

  const token = extractBearerToken(req.headers.get('authorization'));
  if (!token) {
    return errorResponse(401, 'missing_token');
  }

  let naverResp: Response;
  try {
    naverResp = await fetch(NAVER_USERINFO_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    // 네이버 API 도달 불가. 토큰은 절대 로깅하지 않는다.
    const reason = err instanceof Error ? err.message : 'unknown_error';
    console.error('naver-userinfo-proxy: naver fetch failed', {
      reason,
      // @MX:WARN: [AUTO] access_token 절대 로깅 금지. reason 에도 토큰이 섞이지 않았는지 주의.
      //           @MX:REASON: 토큰 유출은 계정 탈취로 이어진다.
    });
    return errorResponse(502, 'naver_unreachable', reason);
  }

  // HTTP 상태가 2xx 가 아니면 네이버 측 오류.
  if (!naverResp.ok) {
    const body = await naverResp.text().catch(() => '');
    // 네이버 에러 응답 본문을 detail 에 포함 (에러 메시지 영역, 토큰 미포함).
    return errorResponse(502, 'naver_api_error', `status=${naverResp.status} body=${body.slice(0, 200)}`);
  }

  let parsed: NaverUserinfoResponse;
  try {
    parsed = await naverResp.json() as NaverUserinfoResponse;
  } catch {
    return errorResponse(502, 'naver_invalid_json');
  }

  // resultcode "00" 만 성공. 그 외(예: "024 Authentication failed")는 실패.
  if (parsed.resultcode !== '00') {
    return errorResponse(502, 'naver_api_error', `${parsed.resultcode ?? 'unknown'}: ${parsed.message ?? ''}`);
  }

  const userinfo = flattenToStandard(parsed);
  if (!userinfo) {
    // response.id 가 없으면 Supabase 가 sub 를 읽을 수 없다 → 502.
    return errorResponse(502, 'missing_sub', 'naver response.id absent');
  }

  return new Response(JSON.stringify(userinfo), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
