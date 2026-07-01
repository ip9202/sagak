// @MX:NOTE: [AUTO] 네이버 OIDC 커스텀 discovery — Supabase Custom OIDC 가 네이버를 읽도록 우회하는 discovery 문서.
// @MX:REASON: 네이버 discovery 의 userinfo_endpoint(/v1/nid/me) 은 response.{} 중첩이라 Supabase 가 sub 를 못 읽음("missing provider id").
//            따라서 userinfo_endpoint 만 naver-userinfo-proxy(flatten) 로 바꾸고, jwks_uri 는 네이버 실제값(/oauth2/jwks) 을 그대로 둔 커스텀 discovery 를 제공한다.
//            OIDC provider 의 discovery_url 옵션(Supabase docs OIDC-specific) 으로 이 함수를 지정하면, Supabase 가 이 discovery 를 기준으로 동작한다.

const NAVER_PROJECT_URL = Deno.env.get("SUPABASE_URL") ?? "";

// 네이버 OIDC discovery 의 모든 실제 필드 + userinfo_endpoint 만 proxy 로 교체.
const DISCOVERY = {
  issuer: "https://nid.naver.com",
  authorization_endpoint: "https://nid.naver.com/oauth2.0/authorize",
  token_endpoint: "https://nid.naver.com/oauth2.0/token",
  // @MX:WARN: [AUTO] userinfo_endpoint = flatten proxy. 원본 /v1/nid/me(response 중첩) 대신.
  userinfo_endpoint: `${NAVER_PROJECT_URL}/functions/v1/naver-userinfo-proxy`,
  // jwks_uri 는 네이버 실제값(200). /.well-known/jwks.json(404) 아님.
  jwks_uri: "https://nid.naver.com/oauth2/jwks",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code"],
  scopes_supported: ["openid", "profile"],
  token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
  code_challenge_methods_supported: ["S256"],
  subject_types_supported: ["pairwise"],
  id_token_signing_alg_values_supported: ["RS256"],
};

Deno.serve(async (_req: Request) => {
  return new Response(JSON.stringify(DISCOVERY), {
    headers: { "content-type": "application/json" },
  });
});
