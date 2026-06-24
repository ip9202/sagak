// Sentry configuration builder + initialization wrapper
// SPEC-DEPLOY-001 M3 (REQ-DEPLOY-014/015/016/017/018)
//
// ARCHITECTURE NOTE:
// @sentry/react-native 가 정적 import 로 전환되었다. 과거 SPEC §6 #4 미결정으로
// SDK 가 설치되지 않았을 때를 대비한 dynamic-import + try/catch 가드는 제거되었다.
// 이제 initSentry 는 Sentry.init 을 직접 호출한다.
// (참고) Sentry CLI 소스맵 업로드/릴리즈 트래킹(SPEC §6 #4)은 여전히 OPEN 이며,
// 이 모듈은 SDK 초기화까지만 담당한다 — app entry 연결과 빌드 설정은 별도 작업.

import * as Sentry from '@sentry/react-native';

/**
 * DSN sentinel value that disables Sentry transport without throwing.
 * Sentry treats empty/undefined DSN as "SDK initialized but inactive".
 */
export const SENTRY_DISABLED_DSN = '';

/**
 * Build environment keys recognized by Sentry environment routing.
 */
export type SentryEnvironment = 'production' | 'staging' | 'development';

/**
 * Input for buildSentryConfig. Values come from app.config.ts `extra`
 * (build-time injected EXPO_PUBLIC_* variables).
 */
export interface SentryConfigInput {
  /** Sentry DSN from EXPO_PUBLIC_SENTRY_DSN. Empty/undefined disables reporting. */
  dsn: string | undefined;
  /** Build environment. Unknown values fall back to development. */
  env: string;
  /** App version for release tracking (e.g. '1.2.3'). */
  release: string;
}

/**
 * Resolved Sentry init options consumed by @sentry/react-native.
 */
export interface SentryConfig {
  enabled: boolean;
  dsn: string;
  environment: SentryEnvironment;
  release: string;
  sendDefaultPII: boolean;
  tracesSampleRate: number;
}

/**
 * Normalize an arbitrary env string into a known SentryEnvironment.
 * Unknown values default to 'development' (safe side — no prod data leakage).
 */
function normalizeEnvironment(env: string): SentryEnvironment {
  switch (env) {
    case 'production':
      return 'production';
    case 'staging':
      return 'staging';
    default:
      return 'development';
  }
}

/**
 * Build a SentryConfig from build-time inputs.
 *
 * REQ-DEPLOY-014: provides DSN for Sentry.init.
 * REQ-DEPLOY-015: production -> production environment tag; dev/staging separated.
 * REQ-DEPLOY-018: production + missing DSN throws (fail-fast, build-time guard complement).
 *
 * Dev tolerance: development/staging with missing DSN returns enabled=false so the
 * app still runs locally without crash reporting.
 */
// @MX:ANCHOR: [AUTO] Sentry 설정 정규화 — initSentry + 테스트 + 향후 CI 소스맵 단계가 소비 (fan_in >= 3 예상)
// @MX:REASON: 잘못된 환경 라우팅은 dev 크래시가 prod 프로젝트로 유입되는 치명적 버그를 유발한다. 환경 분리 불변식.
// @MX:SPEC: SPEC-DEPLOY-001 M3
export function buildSentryConfig(input: SentryConfigInput): SentryConfig {
  const environment = normalizeEnvironment(input.env);
  const hasDsn = Boolean(input.dsn && input.dsn.length > 0);

  // REQ-DEPLOY-018: production 빌드에서 DSN 누락은 빌드 중단(fail-fast).
  // app.config.ts의 validateEnv와 이중 방어 — 런타임 진입 시에도 차단.
  if (environment === 'production' && !hasDsn) {
    throw new Error(
      'EXPO_PUBLIC_SENTRY_DSN is required for production builds (REQ-DEPLOY-018)'
    );
  }

  // dev tolerance: dev/staging은 DSN 없어도 실행(비활성 상태)
  return {
    enabled: hasDsn,
    dsn: hasDsn ? (input.dsn as string) : SENTRY_DISABLED_DSN,
    environment,
    release: input.release,
    // @MX:NOTE: [AUTO] PII 보호 — 프로덕션에서 자동 개인정보 전송 금지 (OWASP 관련)
    sendDefaultPII: false,
    // dev는 전수 샘플링, prod는 낮은 비율(비용/노이즈 균형)
    tracesSampleRate: environment === 'development' ? 1.0 : 0.2,
  };
}

/**
 * Initialize Sentry at app startup.
 *
 * Wraps @sentry/react-native init with the resolved config. disabled 상태이면
 * (DSN 누락 등) Sentry.init 을 호출하지 않고 그대로 반환한다 (dev tolerance).
 *
 * REQ-DEPLOY-014: 활성화된 경우 Sentry SDK 를 초기화한다.
 */
// @MX:ANCHOR: [AUTO] Sentry SDK 초기화 진입점 — app/_layout.tsx 및 테스트가 호출 (fan_in >= 3 예상)
// @MX:REASON: init 호출 누락/중복/잘못된 옵션은 크래시 리포팅 전체를 무력화한다. 단일 진입점 불변식.
// @MX:SPEC: SPEC-DEPLOY-001 M3
export async function initSentry(input: SentryConfigInput): Promise<SentryConfig> {
  const config = buildSentryConfig(input);

  if (!config.enabled) {
    return config;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    // @sentry/react-native 옵션명은 sendDefaultPii(소문자 pii).
    // 내부 SentryConfig 는 sendDefaultPII(대문자)를 사용하므로 여기서 매핑한다.
    sendDefaultPii: config.sendDefaultPII,
    tracesSampleRate: config.tracesSampleRate,
  });

  return config;
}
