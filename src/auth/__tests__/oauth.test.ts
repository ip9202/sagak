/**
 * OAuth redirect URI tests
 * REQ-AUTH-002: signInWithOAuth redirectTo 딥링크 URI
 *
 * getOAuthRedirectUri() 는 app.json scheme("sagak") 기반 고정 URI를 반환한다.
 * 과거 Linking.createURL('/auth/callback') 사용 시 "sagak:///auth/callback"(슬래시 3개,
 * host 누락)이 반환되어 Supabase Redirect URLs allow-list 불일치 → Site URL(localhost)
 * 폴백 문제가 발생했으므로, 정확한 형식을 보장하는 회귀 테스트를 포함한다.
 */

import { getOAuthRedirectUri } from '../oauth';

describe('getOAuthRedirectUri', () => {
  it('app.json scheme 기반 고정 URI "sagak://auth/callback" 을 반환한다', () => {
    expect(getOAuthRedirectUri()).toBe('sagak://auth/callback');
  });

  it('슬래시 3개(host 누락, sagak:/// ) 형식이 아님을 보장 — Supabase 폴백 회귀 방어', () => {
    const uri = getOAuthRedirectUri();
    // sagak:///auth/callback (슬래시 3개) 가 되면 Supabase가 redirectTo 를 인식 못해
    // Site URL(localhost) 로 폴백한다. 스킴 직후 슬래시는 정확히 2개여야 한다.
    expect(uri).not.toMatch(/^sagak:\/\/\//);
  });

  it('non-empty string', () => {
    const result = getOAuthRedirectUri();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
