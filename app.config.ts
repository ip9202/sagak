/**
 * Expo Configuration
 * Environment variables are injected at build time from .env files
 * REQ-API-017: Inject environment variables into extra field
 * SPEC-DEPLOY-001 M1: build-time 환경변수 검증 (validateEnv) 연동
 *
 * IMPORTANT: This file is evaluated at BUILD TIME, not runtime.
 * Use process.env to inject environment variables into the extra field.
 * At runtime, access them via Constants.expoConfig.extra in React components.
 *
 * Function pattern ({ config }) => ({ ...config, extra }) inherits app.json's
 * expo settings (name/ios/android/plugins) and injects `extra`. Returning only
 * a bare object { extra } drops app.json's contents — bundleIdentifier goes
 * missing and prebuild (expo run:ios) fails with "Cannot automatically write
 * to dynamic config".
 */
import type { ConfigContext } from 'expo/config';

// SPEC-DEPLOY-001 M1 / REQ-DEPLOY-003: production 빌드 시 필수 환경변수 누락 검증(fail-fast).
// IMPORTANT: 이 파일은 빌드 시점 Expo Config 평가(Node CJS)에서 실행되므로
// src/config/env.ts 같은 .ts 모듈을 import(require)할 수 없다 ("Cannot find module './src/config/env'").
// 따라서 검증 로직을 인라인으로 작성한다. src/config/env.ts 의 validateEnv 와 동일 상수(REQUIRED_PROD)를
// 사용하며, 두 정의는 반드시 동기화해야 한다. env.ts 의 validateEnv 는 런타임/단위 테스트용으로 유지된다.
const REQUIRED_PROD_ENV = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
] as const;

export default ({ config }: ConfigContext) => {
  const currentEnv = process.env.ENV || 'development';
  // production 빌드에서만 필수 환경변수 누락 시 빌드를 중단(fail-fast)한다.
  // development/staging 은 누락을 허용(dev tolerance)하여 로컬 개발을 방해하지 않는다.
  if (currentEnv === 'production') {
    const missing = REQUIRED_PROD_ENV.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for production build: ${missing.join(', ')}`
      );
    }
  }

  return {
    ...config,
    extra: {
      // Supabase Configuration (REQ-API-017)
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // NOTE: service_role 키는 서버 전용(Edge Functions)이므로 클라이언트 번들에 주입하지 않는다.
      // 절대 EXPO_PUBLIC_ 접두사를 붙이지 말 것 (RLS 우회 위험, DoD #11 위반).

      // Environment (REQ-API-019)
      ENV: process.env.ENV || 'development',

      // SPEC-NOTIF-001 / REQ-NOTIF-001: Expo Push 토큰 발급용 projectId.
      // @ip9202/sagak project 식별자 (환경 무관 고정값, secret 아님). registerForPush.ts:44 참조.
      eas: {
        projectId: '6648249c-f694-48d8-9a76-b1e639e86fdd',
      },
    },
  };
};
