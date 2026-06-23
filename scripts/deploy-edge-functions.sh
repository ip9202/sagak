#!/usr/bin/env bash
# Edge Function deploy wrapper
# SPEC-DEPLOY-001 M6 (REQ-DEPLOY-022)
#
# Deploys all Edge Functions in src/lib/edge-function-deploy.ts::EDGE_FUNCTIONS
# to the Supabase project matching $ENV. Project ref resolution mirrors the
# TS module so there is a single source of truth for the function list.
#
# Usage:
#   ENV=production bash scripts/deploy-edge-functions.sh
#
# Required environment variables:
#   ENV                          development | staging | production
#   SUPABASE_ACCESS_TOKEN        Supabase CLI access token (CI secret)
#   SUPABASE_<ENV>_PROJECT_REF   Project ref for the target environment
#
# Smoke test (dry-run without secrets): see .moai/specs/SPEC-DEPLOY-001/progress.md
set -euo pipefail

ENV="${ENV:-}"
if [[ "$ENV" != "development" && "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "ERROR: ENV must be development|staging|production (got: '$ENV')" >&2
  exit 1
fi

case "$ENV" in
  development) PROJECT_REF_VAR="SUPABASE_DEV_PROJECT_REF" ;;
  staging)     PROJECT_REF_VAR="SUPABASE_STAGING_PROJECT_REF" ;;
  production)  PROJECT_REF_VAR="SUPABASE_PROD_PROJECT_REF" ;;
esac

PROJECT_REF="${!PROJECT_REF_VAR:-}"
if [[ -z "$PROJECT_REF" ]]; then
  echo "ERROR: $PROJECT_REF_VAR is not set. Cannot resolve Supabase project." >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not found in PATH. Install: brew install supabase/tap/supabase" >&2
  exit 1
fi

# @MX:NOTE: [AUTO] SPEC-DEPLOY-001 REQ-DEPLOY-022 위임 3종 + Naver OIDC 보조 2종.
# Keep in sync with src/lib/edge-function-deploy.ts::EDGE_FUNCTIONS.
FUNCTIONS=(
  "kakao-book-search"
  "process-join-request"
  "send-notification"
  "naver-userinfo-proxy"
  "naver-discovery"
)

echo "==> Deploying ${#FUNCTIONS[@]} functions to $ENV (project: $PROJECT_REF)"

for fn in "${FUNCTIONS[@]}"; do
  src="supabase/functions/$fn"
  if [[ ! -d "$src" ]]; then
    echo "WARN: function source missing, skipping: $src" >&2
    continue
  fi
  echo "    deploying $fn ..."
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "==> Edge Function deploy complete ($ENV)"
