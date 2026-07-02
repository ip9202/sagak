#!/usr/bin/env bash
# Edge Function deploy wrapper
# SPEC-DEPLOY-001 M6 (REQ-DEPLOY-022)
#
# Deploys all Edge Functions listed in supabase/functions/registry.json (SSOT)
# to the Supabase project matching $ENV. The function list is shared with
# src/lib/edge-function-deploy.ts — both consume the same JSON registry, so
# there is exactly one source of truth for the function list.
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

# @MX:NOTE: [AUTO] SSOT — 함수 목록은 supabase/functions/registry.json에서 파생.
# @MX:SPEC: SPEC-DEPLOY-001 REQ-DEPLOY-022
# 스크립트 위치 기준으로 registry.json 경로 해상 (repo root 어디서 실행해도 동작).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTRY="${SCRIPT_DIR}/../supabase/functions/registry.json"

if [[ ! -f "$REGISTRY" ]]; then
  echo "ERROR: registry.json not found at $REGISTRY" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required to read $REGISTRY (install: brew install jq)" >&2
  exit 1
fi

# @MX:WARN: [AUTO] bash 3.2(macOS 기본 /bin/bash) 호환 — mapfile(bash 4.0+) 대신 while-read 사용.
# CI(Ubuntu bash 5)에서는 mapfile이 작동하지만, 로컬 macOS 직접 실행 시 command not found 로 실패한다.
FUNCTIONS=()
while IFS= read -r fn_name; do
  FUNCTIONS+=("$fn_name")
done < <(jq -r '.functions[].name' "$REGISTRY")

if [[ ${#FUNCTIONS[@]} -eq 0 ]]; then
  echo "ERROR: no functions found in $REGISTRY" >&2
  exit 1
fi

# @MX:NOTE: [AUTO] 양방향 registry↔디렉토리 드리프트 가드 (LOW-1).
# @MX:SPEC: SPEC-DEPLOY-001 REQ-DEPLOY-022
# 방향 A: registry에 있으나 디렉토리 없음 → 배포 루프에서 skip(기존 단방향 가드와 동일 메시지로 사전 명시).
# 방향 B: 디렉토리 있으나 registry에 없음 → 미등록 함수, 배포 누락 발생.
# 정책: soft fail (WARN만, exit 안 함). 개발자가 registry.json만 고치면 되므로 배포 자체 중단은 과잉.
# 단, CI에서 실패를 강제하려면 DRIFT_HARD_FAIL=1 환경변수로 ERROR 처리(아래참조).
FUNCTIONS_DIR="${SCRIPT_DIR}/../supabase/functions"
REGISTRY_NAMES_TMP="$(mktemp -t deploy_reg.XXXXXX)"
DIR_NAMES_TMP="$(mktemp -t deploy_dir.XXXXXX)"
DRIFT_TMP="$(mktemp -t deploy_drift.XXXXXX)"
trap 'rm -f "$REGISTRY_NAMES_TMP" "$DIR_NAMES_TMP" "$DRIFT_TMP"' EXIT

# @MX:NOTE: [AUTO] bash 3.2(macOS 기본 /bin/bash) 호환 —
# mapfile/연관배열(bash 4.0+) 금지. 정렬된 임시 파일 2개 + comm(POSIX)로 차집합 계산.
# comm -23 = 첫번째 파일에만 있는 줄(registry에만), -13 = 두번째에만(디렉토리에만).
printf '%s\n' "${FUNCTIONS[@]}" | sort > "$REGISTRY_NAMES_TMP"
# 디렉토리 목록에서 *.json(SSOT 파일)과 숨김 파일 제외한 하위 디렉토리만 수집.
find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.*' \
  -exec basename {} \; | sort > "$DIR_NAMES_TMP"

# 방향 A: registry에 있으나 디렉토리 누락.
if comm -23 "$REGISTRY_NAMES_TMP" "$DIR_NAMES_TMP" > "$DRIFT_TMP"; then
  if [[ -s "$DRIFT_TMP" ]]; then
    while IFS= read -r missing; do
      echo "WARN: registry lists '$missing' but directory supabase/functions/$missing/ missing (will skip at deploy)" >&2
    done < "$DRIFT_TMP"
  fi
fi

# 방향 B: 디렉토리 존재하나 registry 미등록.
if comm -13 "$REGISTRY_NAMES_TMP" "$DIR_NAMES_TMP" > "$DRIFT_TMP"; then
  if [[ -s "$DRIFT_TMP" ]]; then
    DRIFT_HARD_FAIL="${DRIFT_HARD_FAIL:-0}"
    while IFS= read -r unregistered; do
      if [[ "$DRIFT_HARD_FAIL" == "1" ]]; then
        echo "ERROR: directory supabase/functions/$unregistered/ exists but not in registry.json (DRIFT_HARD_FAIL=1)" >&2
      else
        echo "WARN: directory supabase/functions/$unregistered/ exists but not in registry.json — will NOT be deployed (add to registry.json or remove directory)" >&2
      fi
    done < "$DRIFT_TMP"
    if [[ "$DRIFT_HARD_FAIL" == "1" ]]; then
      echo "ERROR: registry↔directory drift detected, aborting (DRIFT_HARD_FAIL=1). Fix registry.json or unset to allow deploy." >&2
      exit 1
    fi
  fi
fi

# @MX:NOTE: [AUTO] 본 드리프트 가드는 이 스크립트 경유 배포에서만 작동한다.
# `supabase functions deploy <fn>` 를 직접 실행하면 registry.json 검사를 우회해 미등록 함수도
# 배포될 수 있으므로, 프로덕션 배포는 반드시 본 스크립트를 거칠 것(SSOT 단일 진입점).
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
