// @MX:NOTE: [AUTO] 네이버 OIDC 커스텀 discovery 문서 생성기. 현재 미사용 dead code (배포는 유지, v3).
// @MX:REASON: 네이버 userinfo(/v1/nid/me) response.{} 중첩 → Supabase sub 미인식("missing provider id") 회피 목적의 auto-discovery 설계 산물.
//            userinfo_endpoint 만 naver-userinfo-proxy(flatten) 로 교체, jwks_uri 는 네이버 실제값(/oauth2/jwks).
//            custom:naver 는 v1.0.2(2026-06-19) auto-discovery → OAuth2 Manual 모드로 전환. Manual 모드는 Auth/Token/Userinfo URL 을
//            직접 입력하므로 discovery 문서를 조회하지 않음 → 이 함수 미호출.
//            (2026-07-01 Dashboard custom:naver = Manual 모드 검증 완료 — SPEC-DEPLOY-001 S1 해소. 재전환 시 git history 복구 가능)

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
  if (!NAVER_PROJECT_URL) {
    return new Response(
      JSON.stringify({ error: "missing_server_config", detail: "SUPABASE_URL not injected" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  return new Response(JSON.stringify(DISCOVERY), {
    headers: { "content-type": "application/json" },
  });
});
