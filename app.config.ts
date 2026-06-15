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
    // NOTE: service_role 키는 서버 전용(Edge Functions)이므로 클라이언트 번들에 주입하지 않는다.
    // 절대 EXPO_PUBLIC_ 접두사를 붙이지 말 것 (RLS 우회 위험, DoD #11 위반).

    // Environment (REQ-API-019)
    ENV: process.env.ENV || 'development',
  },
};
