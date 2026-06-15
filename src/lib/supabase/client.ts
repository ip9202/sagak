/**
 * Supabase Client Singleton
 * REQ-API-001: Singleton pattern for Supabase client
 * REQ-API-001: Client initialization logic
 * REQ-API-007: Type-safe client with Database types (after gen-types)
 */
import { createClient } from '@supabase/supabase-js';
import { getEnvVar } from '../../config/env';
// import type { Database } from '../../types/supabase'; // Uncomment after running: npm run gen-types

// Singleton instance
let clientInstance: ReturnType<typeof createClient> | null = null;

/**
 * Get Supabase client instance (singleton pattern)
 * REQ-API-001: Ensures only one client instance exists
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
  clientInstance = createClient(supabaseUrl, supabaseAnonKey);

  return clientInstance;
}

/**
 * Reset Supabase client instance (for testing only)
 * This should only be used in test environments
 */
export function resetSupabaseClient() {
  clientInstance = null;
}
