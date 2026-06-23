// Sentry configuration builder + initialization wrapper
// SPEC-DEPLOY-001 M3 (REQ-DEPLOY-014/015/016/017/018)
//
// ARCHITECTURE NOTE:
// @sentry/react-native is not yet installed (SPEC §6 #4 undecided). To keep
// TDD honest without a runtime dependency, the testable logic lives in the
// pure `buildSentryConfig` function. The `initSentry` wrapper dynamically
// imports the SDK so the app does not hard-fail if the package is absent —
// it logs a warning and no-ops, letting the app run without crash reporting.
// Once the SDK is installed and the team confirms release-tracking (§6 #4),
// remove the dynamic-import guard and call Sentry.init directly.

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
 * Wraps @sentry/react-native init with the resolved config. If the SDK is not
 * installed, logs a warning and returns silently (no crash). This lets the
 * codebase reference initSentry() before the package is added.
 *
 * REQ-DEPLOY-014: 항상 Sentry를 초기화해야 한다 (SDK 설치 시).
 */
export async function initSentry(input: SentryConfigInput): Promise<SentryConfig> {
  const config = buildSentryConfig(input);

  if (!config.enabled) {
    return config;
  }

  try {
    // Dynamic import so this module type-checks and runs without the SDK installed.
    // SDK 미설치 시 타입 선언이 없으므로 any 로 취급 — 패키지 설치 후 이 가드 제거.
    const Sentry: { init: (opts: Record<string, unknown>) => void } = (
      await import(/* @vite-ignore */ '@sentry/react-native' as string)
    ) as { init: (opts: Record<string, unknown>) => void };
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      sendDefaultPII: config.sendDefaultPII,
      tracesSampleRate: config.tracesSampleRate,
    });
  } catch (err) {
    // SDK 미설치 시 경고만 출력, 앱 실행은 계속 (REQ-DEPLOY-014 보류 상태 허용)
    // @MX:WARN: [AUTO] @sentry/react-native 미설치 상태 — 크래시 리포팅 비활성
    // @MX:REASON: SPEC §6 #4 미결정(Sentry 릴리즈 트래킹)으로 SDK 도입 보류 중. 패키지 설치 후 이 브랜치 제거.
    // eslint-disable-next-line no-console
    console.warn(
      '[sentry] @sentry/react-native not installed — crash reporting disabled.',
      err instanceof Error ? err.message : err
    );
  }

  return config;
}
