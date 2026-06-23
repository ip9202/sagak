// Edge Function deploy target resolution
// SPEC-DEPLOY-001 M6 (REQ-DEPLOY-022 / REQ-DEPLOY-023 / REQ-DEPLOY-013)
//
// This module is the single source of truth for:
// 1. Which Edge Functions the project ships (registry)
// 2. How a build environment maps to a Supabase project ref
// 3. How to construct the `supabase functions deploy` argument list
//
// The shell wrapper (scripts/deploy-edge-functions.sh) consumes the argument
// lists produced here. Keeping resolution in TS (not bash) lets us unit-test
// the branching logic that Git Flow + environment separation requires.

/**
 * Edge Functions that MUST be deployed per SPEC-DEPLOY-001 REQ-DEPLOY-022.
 * Sourced from the delegating domain SPECs (BOOK-001, CLUB-001, NOTIF-001).
 *
 * Additional helper functions (naver-userinfo-proxy, naver-discovery) are
 * deployed alongside — they are runtime dependencies of the auth flow.
 */
export const EDGE_FUNCTIONS = [
  'kakao-book-search', // SPEC-BOOK-001 위임
  'process-join-request', // SPEC-CLUB-001 위임
  'send-notification', // SPEC-NOTIF-001 위임
  'naver-userinfo-proxy', // SPEC-DEPLOY-001 REQ-DEPLOY-019 (Naver OIDC)
  'naver-discovery', // SPEC-DEPLOY-001 Naver OIDC discovery 보조
] as const;

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number];

/**
 * Build environments that have a dedicated Supabase project (REQ-DEPLOY-023).
 */
export type DeployEnvironment = 'development' | 'staging' | 'production';

/**
 * Environment variable keys carrying the Supabase project ref per environment.
 * The shell deploy script sets these before invoking; tests inject defaults.
 */
const PROJECT_REF_ENV_KEYS: Record<DeployEnvironment, string> = {
  development: 'SUPABASE_DEV_PROJECT_REF',
  staging: 'SUPABASE_STAGING_PROJECT_REF',
  production: 'SUPABASE_PROD_PROJECT_REF',
};

/**
 * Placeholder refs used when the real env var is absent (tests, local dry-run).
 * Real values are provisioned via EAS Secrets / GitHub Actions secrets.
 */
const PLACEHOLDER_REFS: Record<DeployEnvironment, string> = {
  development: 'dev-project-ref-placeholder',
  staging: 'staging-project-ref-placeholder',
  production: 'prod-project-ref-placeholder',
};

/**
 * Resolved deployment target for a single environment.
 */
export interface DeployTarget {
  environment: DeployEnvironment;
  projectRef: string;
  /** Build the `supabase functions deploy <fn>` argv for this target. */
  commandFor: (fn: string) => string[];
}

/**
 * Resolve the Supabase project ref + command builder for an environment.
 *
 * REQ-DEPLOY-013: develop -> staging build, release/hotfix -> production.
 * REQ-DEPLOY-023: three separate Supabase projects, one per environment.
 *
 * @param env Runtime environment. Unknown values throw (fail-fast).
 * @param envSource Optional override for unit tests (defaults to process.env).
 */
// @MX:ANCHOR: [AUTO] Edge Function 배포 타겟 해결 — deploy 스크립트 + CI + 테스트가 소비 (fan_in >= 3)
// @MX:REASON: 환경→프로젝트 매핑 오류는 dev 코드가 prod 데이터베이스에 배포되는 치명적 사고로 이어진다. 단일 진실 소스 필수.
// @MX:SPEC: SPEC-DEPLOY-001 M6
export function resolveDeployTarget(
  env: DeployEnvironment,
  envSource: Record<string, string | undefined> = process.env
): DeployTarget {
  if (!(env in PROJECT_REF_ENV_KEYS)) {
    throw new Error(
      `Unknown deployment environment: "${env}". Expected development|staging|production.`
    );
  }

  const knownEnv = env as DeployEnvironment;
  const envKey = PROJECT_REF_ENV_KEYS[knownEnv];
  const projectRef = envSource[envKey] || PLACEHOLDER_REFS[knownEnv];

  return {
    environment: knownEnv,
    projectRef,
    commandFor: (fn: string) => [
      'functions',
      'deploy',
      fn,
      '--project-ref',
      projectRef,
    ],
  };
}
