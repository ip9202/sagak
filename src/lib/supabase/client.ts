/**
 * Supabase Client Singleton
 * REQ-API-001: Singleton pattern for Supabase client
 * REQ-API-001: Client initialization logic
 * REQ-API-002: 세션 영속화 + 자동 갱신 + JWT 헤더 자동 주입(auth.storage 어댑터)
 * REQ-API-007: Type-safe client with Database types (after gen-types)
 */
import { createClient } from '@supabase/supabase-js';
import { getEnvVar } from '../../config/env';
import { supabaseStorageAdapter } from './storageAdapter';
// import type { Database } from '../../types/supabase'; // Uncomment after running: npm run gen-types

// Singleton instance
let clientInstance: ReturnType<typeof createClient> | null = null;

// @MX:ANCHOR: [AUTO] Supabase 클라이언트 팩토리 — 앱 전역 유일 진입점
// @MX:REASON: 모든 도메인 SPEC(Books/Library/Clubs/Feed 등)이 이 클라이언트를 공유하며, auth.storage 설정이 누락되면 세션 영속화/자동 갱신/JWT 주입이 전역적으로 고장난다.

/**
 * Get Supabase client instance (singleton pattern)
 * REQ-API-001: Ensures only one client instance exists
 * REQ-API-002: persistSession/autoRefreshToken/storage 어댑터 설정
 *
 * @returns Supabase client instance
 */
export function getSupabaseClient() {
  if (clientInstance) {
    return clientInstance;
  }

  // Initialize client with environment variables
  // REQ-API-001: Client initialization logic
  const supabaseUrl = getEnvVar('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  // Create typed Supabase client (REQ-API-007)
  // NOTE: Generic types will be applied after running: npm run gen-types
  // Currently using basic client until database schema is available
  clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // REQ-API-002: 세션 영속화 — SecureStore(우선) / AsyncStorage(폴백) 어댑터
      persistSession: true,
      // REQ-API-002: JWT 만료 전 자동 갱신
      autoRefreshToken: true,
      // REQ-API-002: 모바일 환경 — URL 기반 세션 감지 비활성화
      detectSessionInUrl: false,
      // REQ-API-002: React Native 호환 커스텀 저장소 어댑터
      storage: supabaseStorageAdapter,
    },
  });

  return clientInstance;
}

/**
 * Reset Supabase client instance (for testing only)
 * This should only be used in test environments
 */
export function resetSupabaseClient() {
  clientInstance = null;
}
