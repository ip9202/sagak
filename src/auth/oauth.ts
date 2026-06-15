/**
 * OAuth redirect URI wrapper for expo-linking
 * REQ-AUTH-002: 딥링크는 makeRedirectUri() / Linking.createURL() 사용
 *
 * expo-linking 호출을 단일 함수로 캡슐화하여 테스트 경계를 분리한다.
 * 실제 스킴 등록/Universal Links 설정은 SPEC-DEPLOY-001 영역이다.
 */
import * as Linking from 'expo-linking';

// @MX:ANCHOR: [AUTO] OAuth 딥링크 리다이렉트 URI 생성 — login.tsx + AuthContext.signInWithProvider가 호출
// @MX:REASON: fan_in >= 3 예상 (login, AuthContext, 향후 콜백 화면). 잘못된 경로/스킴은 OAuth 콜백 실패로 이어진다.

/**
 * OAuth redirectTo로 사용할 딥링크 URI를 반환한다.
 * REQ-AUTH-002: Linking.createURL('/auth/callback') 사용
 *
 * @returns expo-linking이 생성한 딥링크 URI 문자열
 */
export function getOAuthRedirectUri(): string {
  return Linking.createURL('/auth/callback');
}
