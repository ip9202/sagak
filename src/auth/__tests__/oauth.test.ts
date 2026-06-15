/**
 * OAuth redirect URI wrapper tests
 * REQ-AUTH-002: signInWithOAuth uses makeRedirectUri() for redirectTo
 * Tests the expo-linking wrapper boundary (testability separation)
 */

import * as Linking from 'expo-linking';
import { getOAuthRedirectUri } from '../oauth';

jest.mock('expo-linking');

describe('getOAuthRedirectUri', () => {
  const mockedLinking = jest.mocked(Linking);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns createURL result for /auth/callback path', () => {
    const expectedUri = 'sagak://auth/callback';
    mockedLinking.createURL.mockReturnValue(expectedUri);

    const result = getOAuthRedirectUri();

    expect(result).toBe(expectedUri);
    expect(mockedLinking.createURL).toHaveBeenCalledWith('/auth/callback');
  });

  it('returns a non-empty string', () => {
    mockedLinking.createURL.mockReturnValue('sagak://auth/callback');

    const result = getOAuthRedirectUri();

    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
