/**
 * Auth type definitions tests
 * REQ-AUTH-001: AuthProvider union type 'kakao' | 'naver' | 'google'
 * Tests compile-time type safety and runtime value constraints
 */

import type { AuthProvider, UserProfile, AuthContextValue } from '../types';

describe('AuthProvider type', () => {
  it('accepts exactly three provider values', () => {
    const providers: AuthProvider[] = ['kakao', 'naver', 'google'];
    expect(providers).toHaveLength(3);
    expect(providers).toContain('kakao');
    expect(providers).toContain('naver');
    expect(providers).toContain('google');
  });

  it('matches users.provider CHECK constraint values', () => {
    // SPEC-DB-001 REQ-DB-001 CHECK constraint: kakao/naver/google
    // These must be identical at compile time and runtime
    const dbProviders = ['kakao', 'naver', 'google'];
    const tsProviders: AuthProvider[] = ['kakao', 'naver', 'google'];
    expect(tsProviders.sort()).toEqual(dbProviders.sort());
  });
});

describe('UserProfile type', () => {
  it('supports a fully populated profile', () => {
    const profile: UserProfile = {
      id: 'user-123',
      nickname: '독서왕',
      avatar_url: 'https://example.com/avatar.png',
      bio: null,
      provider: 'kakao',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(profile.nickname).toBe('독서왕');
    expect(profile.provider).toBe('kakao');
  });

  it('supports nullable nickname and avatar_url (onboarding not yet complete)', () => {
    const profile: UserProfile = {
      id: 'user-456',
      nickname: null,
      avatar_url: null,
      bio: null,
      provider: 'google',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(profile.nickname).toBeNull();
    expect(profile.avatar_url).toBeNull();
  });
});

describe('AuthContextValue type', () => {
  it('exposes session, user, profile, loading state', () => {
    const value: AuthContextValue = {
      session: null,
      user: null,
      profile: null,
      loading: true,
      signInWithProvider: async () => {},
      signOut: async () => {},
      refreshProfile: async () => {},
    };
    expect(value.loading).toBe(true);
  });

  it('supports actions returning Promise<void>', () => {
    const value: AuthContextValue = {
      session: null,
      user: null,
      profile: null,
      loading: false,
      signInWithProvider: jest.fn().mockResolvedValue(undefined),
      signOut: jest.fn().mockResolvedValue(undefined),
      refreshProfile: jest.fn().mockResolvedValue(undefined),
    };
    expect(typeof value.signInWithProvider).toBe('function');
    expect(typeof value.signOut).toBe('function');
    expect(typeof value.refreshProfile).toBe('function');
  });
});
