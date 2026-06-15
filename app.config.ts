/**
 * Expo Configuration
 * Environment variables are injected at build time from .env files
 * REQ-API-017: Inject environment variables into extra field
 *
 * IMPORTANT: This file is evaluated at BUILD TIME, not runtime.
 * Use process.env to inject environment variables into the extra field.
 * At runtime, access them via Constants.expoConfig.extra in React components.
 */
export default {
  extra: {
    // Supabase Configuration (REQ-API-017)
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,

    // Environment (REQ-API-019)
    ENV: process.env.ENV || 'development',
  },
};
