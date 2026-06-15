/**
 * Supabase client singleton tests
 * REQ-API-001: Singleton pattern verification
 * REQ-API-005: Fail-fast on missing environment variables verification
 */
import { getSupabaseClient, resetSupabaseClient } from '../client';
import Constants from 'expo-constants';

// Mock expo-constants (uses manual mock from __mocks__/expo-constants.ts)
jest.mock('expo-constants');

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    rpc: jest.fn(),
  })),
}));

// REQ-API-002: storageAdapter 가 의존하는 저장소 모킹
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  WHEN_UNLOCKED: 'WHEN_UNLOCKED',
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Supabase Client Singleton (REQ-API-001, REQ-API-005)', () => {
  beforeEach(() => {
    // Reset client instance before each test
    resetSupabaseClient();

    // Clear createClient mock
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockClear();

    // Set up environment variables
    (Constants as any).__setMockExtra({
      EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    });
  });

  afterEach(() => {
    // Clean up after each test
    resetSupabaseClient();
    (Constants as any).__clearMockExtra();
  });

  describe('getSupabaseClient', () => {
    it('should create new client instance on first call (REQ-API-001)', () => {
      const { createClient } = require('@supabase/supabase-js');

      const client1 = getSupabaseClient();

      expect(createClient).toHaveBeenCalledTimes(1);
      // REQ-API-002: URL, anon_key, auth 옵션(persistSession/autoRefreshToken/storage) 전달
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage: expect.any(Object),
          }),
        })
      );
      expect(client1).toBeDefined();
    });

    it('should return same instance on subsequent calls (REQ-API-001 singleton)', () => {
      const client1 = getSupabaseClient();
      const client2 = getSupabaseClient();

      expect(client1).toBe(client2);
    });

    it('세션 영속화/자동 갱신/storage 어댑터 설정이 적용된다 (REQ-API-002 시나리오 C2)', () => {
      const { createClient } = require('@supabase/supabase-js');

      getSupabaseClient();

      const [, , options] = createClient.mock.calls[0];
      expect(options.auth.persistSession).toBe(true);
      expect(options.auth.autoRefreshToken).toBe(true);
      expect(options.auth.detectSessionInUrl).toBe(false);
      // REQ-API-002: storage 어댑터는 getItem/setItem/removeItem 인터페이스 구현
      expect(options.auth.storage).toBeDefined();
      expect(typeof options.auth.storage.getItem).toBe('function');
      expect(typeof options.auth.storage.setItem).toBe('function');
      expect(typeof options.auth.storage.removeItem).toBe('function');
    });

    it('should throw error if SUPABASE_URL is missing (REQ-API-005)', () => {
      (Constants as any).__setMockExtra({
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      });

      expect(() => getSupabaseClient()).toThrow(
        'Environment variable EXPO_PUBLIC_SUPABASE_URL is not defined'
      );
    });

    it('should throw error if SUPABASE_ANON_KEY is missing (REQ-API-005)', () => {
      (Constants as any).__setMockExtra({
        EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      });

      expect(() => getSupabaseClient()).toThrow(
        'Environment variable EXPO_PUBLIC_SUPABASE_ANON_KEY is not defined'
      );
    });

    it('should throw error if both environment variables are missing (REQ-API-005)', () => {
      (Constants as any).__clearMockExtra();

      expect(() => getSupabaseClient()).toThrow();
    });
  });

  describe('resetSupabaseClient', () => {
    it('should reset client instance (testing utility)', () => {
      const { createClient } = require('@supabase/supabase-js');

      const client1 = getSupabaseClient();
      resetSupabaseClient();
      const client2 = getSupabaseClient();

      expect(createClient).toHaveBeenCalledTimes(2);
      expect(client1).not.toBe(client2);
    });
  });
});
