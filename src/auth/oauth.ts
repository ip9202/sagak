/**
 * OAuth redirect URI (app deep link)
 * REQ-AUTH-002: OAuth 콜백 딥링크 URI
 *
 * app.json 의 scheme("sagak") 기반 고정 URI를 반환한다.
 *
 * 참고: Linking.createURL('/auth/callback') 를 사용하면 dev/prod 모두
 * "sagak:///auth/callback"(슬래시 3개, host 누락)을 반환하여 Supabase Redirect URLs
 * allow-list 불일치 → Site URL(localhost) 폴백 문제가 발생한다. 따라서 고정 URI 사용.
 * 실제 스킴 등록/Universal Links 설정은 SPEC-DEPLOY-001 영역이다.
 */

// @MX:ANCHOR: [AUTO] OAuth 딥링크 리다이렉트 URI — login.tsx + AuthContext.signInWithProvider가 호출
// @MX:REASON: fan_in >= 3 (login, AuthContext, 향후 콜백 화면). 잘못된 스킴/경로는 OAuth 콜백 실패로 이어진다.

/**
 * OAuth redirectTo로 사용할 딥링크 URI를 반환한다.
 * REQ-AUTH-002: app.json scheme 기반 고정 딥링크 URI
 *
 * @returns "sagak://auth/callback" (app.json scheme="sagak")
 */
export function getOAuthRedirectUri(): string {
  return 'sagak://auth/callback';
}
