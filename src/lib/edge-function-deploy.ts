// Edge Function deploy target resolution
// SPEC-DEPLOY-001 M6 (REQ-DEPLOY-022 / REQ-DEPLOY-023 / REQ-DEPLOY-013)
//
// 이 모듈은 단일 진실 소스(SSOT)를 기반으로 동작한다:
// 1. Edge Function 목록 → supabase/functions/registry.json (JSON SSOT)
//    - TS(이 모듈)와 Bash(scripts/deploy-edge-functions.sh)가 모두 이 JSON을 읽는다.
//    - 함수 추가/이름 변경 시 registry.json 한 곳만 수정하면 양쪽에 반영된다.
// 2. 빌드 환경 → Supabase project ref 매핑
// 3. `supabase functions deploy` 인자 목록 구성 방식
//
// 셸 래퍼(scripts/deploy-edge-functions.sh)도 동일한 registry.json을 jq로 읽는다.
// 해상도(resolution) 로직을 TS에 두는 이유는 Git Flow + 환경 분리 분기를
// 단위 테스트할 수 있기 때문이다.

// @MX:NOTE: [AUTO] SSOT — 함수 목록은 supabase/functions/registry.json에서 파생된다.
// @MX:SPEC: SPEC-DEPLOY-001 REQ-DEPLOY-022
import registry from '../../supabase/functions/registry.json';

/**
 * Edge Functions that MUST be deployed per SPEC-DEPLOY-001 REQ-DEPLOY-022.
 * registry.json 에서 파생된다 (JSON SSOT).
 *
 * 타입 안전성: .map()은 string[]로 widen되므로, literal union을 보존하기 위해
 * readonly tuple 단언을 사용한다. 런타임 값은 항상 JSON에서 온다.
 * JSON↔TS literal 불일치는 edge-function-deploy.test.ts의 개수/이름 검증으로 감지된다.
 */
// 런타임: JSON에서 이름 추출
const FUNCTION_NAMES_FROM_REGISTRY = registry.functions.map((f) => f.name);

// @MX:ANCHOR: [AUTO] Edge Function 레지스트리 — deploy 스크립트 + CI + 테스트가 소비 (fan_in >= 3)
// @MX:REASON: JSON SSOT에서 파생되며, literal union 타입 보존을 위해 tuple 단언 사용. 타입 widen 시 소비처 type 좁힘이 깨짐.
// @MX:SPEC: SPEC-DEPLOY-001 REQ-DEPLOY-022
export const EDGE_FUNCTIONS = FUNCTION_NAMES_FROM_REGISTRY as unknown as readonly [
  'kakao-book-search',
  'process-join-request',
  'send-notification',
  'naver-userinfo-proxy',
];

export type EdgeFunctionName = (typeof EDGE_FUNCTIONS)[number];

/**
 * Build environments that have a dedicated Supabase project (REQ-DEPLOY-023).
 *
 * §6 #6 단일 프로젝트 결정으로 amended 2026-07-01: prod는 단일 클라우드 프로젝트,
 * dev는 로컬 Docker. 환경별 project ref는 런타임 환경변수로 주입되므로
 * 이 타입(3-환경 분기)은 단일 프로젝트 정책에서도 그대로 유효하다.
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
 * REQ-DEPLOY-023 (amended 2026-07-01, §6 #6): 단일 클라우드 프로젝트를 prod로 사용하고
 * dev는 로컬 Docker. 환경별 project ref는 환경변수(SUPABASE_DEV/STAGING/PROD_PROJECT_REF)로
 * 주입되므로 3-환경 분기 로직은 그대로 유효하다.
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
