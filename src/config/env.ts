// Environment variable configuration and validation
// REQ-API-016 ~ REQ-API-019
// SPEC-DEPLOY-001 M1: build-time 환경변수 검증 (validateEnv)
import Constants from 'expo-constants';

/**
 * production 빌드 시 반드시 존재해야 하는 환경변수 키 목록.
 * SPEC-DEPLOY-001 M1 / REQ-DEPLOY-003.
 *
 * - Supabase URL / anon key: 클라이언트가 Supabase 에 접근하기 위한 최소 요구값
 * - Sentry DSN: production 크래시 리포팅 (SDK 설치는 M3, 여기선 키 검증만)
 */
export const REQUIRED_PROD: readonly string[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
];

/**
 * production 환경에서 필수 환경변수가 누락되었을 때 발생하는 에러.
 * AC-DEPLOY-018: 누락된 키 이름(복수)을 메시지에 포함한다.
 */
export class MissingEnvError extends Error {
  constructor(missingKeys: string[]) {
    super(`Missing required environment variables: ${missingKeys.join(', ')}`);
    this.name = 'MissingEnvError';
  }
}

/**
 * Build-time 환경변수 검증 (REQ-DEPLOY-003).
 * app.config.ts 의 최상단에서 ENV + process.env 와 함께 호출한다.
 *
 * - production: REQUIRED_PROD 키 중 하나라도 빈 값이면 누락된 키 전체를 모아
 *   MissingEnvError 를 던진다 (fail-fast, CI 빌드 중단).
 * - development/staging: 검증을 건너뛴다 (로컬 개발 편의, dev tolerance).
 *
 * @param env 검사할 환경변수 맵 (일반적으로 process.env)
 * @param envName 현재 빌드 환경 ('production' | 'development' | 'staging' 등)
 */
// @MX:ANCHOR: [AUTO] build-time 환경변수 검증 — app.config.ts + 향후 CI + 테스트가 호출 (fan_in >= 3)
// @MX:REASON: production 빌드에서 필수 키 누락 시 무효 번들이 배포되는 것을 차단한다. REQUIRED_PROD 변경 시 모든 호출처에 영향.
export function validateEnv(
  env: Record<string, string | undefined>,
  envName: string
): void {
  if (envName !== 'production') {
    return;
  }
  const missing = REQUIRED_PROD.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new MissingEnvError(missing);
  }
}

/**
 * Runtime environment variable access with validation
 * Throws error if required variables are missing (fail-fast)
 * REQ-API-018: Fail-fast when environment variables are missing
 */
export function getEnvVar(key: string): string {
  const value = Constants.expoConfig?.extra?.[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
}

/**
 * Get optional environment variable with default value
 * REQ-API-018: Graceful fallback for optional variables
 */
export function getOptionalEnvVar(key: string, defaultValue: string): string {
  return Constants.expoConfig?.extra?.[key] || defaultValue;
}
