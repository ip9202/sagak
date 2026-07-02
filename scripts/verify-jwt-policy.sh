#!/usr/bin/env bash
# SPEC-SECURITY-001 A1 — verify_jwt per-function CI 가드 (REQ-SEC-001~003)
#
# supabase/config.toml 의 [functions.<name>] 블록에서 verify_jwt 값을 파싱하여
# 의도값 매트릭스와 비교한다. 불일치 / 매트릭스 미등록 함수 발견 시 비-제로 종료.
#
# 사용:
#   bash scripts/verify-jwt-policy.sh                       # supabase/config.toml (기본)
#   CONFIG_TOML=path/to/config.toml bash scripts/verify-jwt-policy.sh
#
# @MX:NOTE: [AUTO] A1 가드 — 드리프트 자동 차단 (scripts/deploy-edge-functions.sh 의
#   registry 드리프트 가드와는 독립적). 단일 방어선(verify_jwt) 드리프트 시나리오 (a) 방어.
#   @MX:SPEC: SPEC-SECURITY-001 (REQ-SEC-001~003)
#
# 호환성: macOS bash 3.2 호환 (lesson #15). associative array 미사용.
set -euo pipefail

CONFIG_TOML="${CONFIG_TOML:-supabase/config.toml}"

if [[ ! -f "$CONFIG_TOML" ]]; then
  echo "ERROR: config.toml not found at $CONFIG_TOML" >&2
  exit 2
fi

# 의도값 매트릭스 조회 (REQ-SEC-001 SSOT).
# send-notification / kakao-book-search 는 config.toml 에 블록이 없으면 CLI 기본값(true)
# 를 사용하므로, 매트릭스에 명시하되 config 누락 자체는 본 가드 범위가 아니다.
# 인자: 함수명. 출력: "true" | "false" | "" (매트릭스 미등록).
policy_value() {
  case "$1" in
    process-join-request)  echo "true" ;;
    send-notification)     echo "true" ;;
    kakao-book-search)     echo "true" ;;
    naver-userinfo-proxy)  echo "false" ;;
    *)                     echo "" ;;
  esac
}

# config.toml 에서 [functions.<name>] 블록과 직후 verify_jwt 라인을 추출한다.
# 단순 파서 — TOML 의 제한된 서브셋(블록 헤더 + 단일 키=값 라인)만 다룬다.
# 출력: "<name> <value>" 라인들. verify_jwt 키가 없는 블록은 건너뛴다.
extract_function_verify_jwt() {
  local current_fn=""
  local line trimmed
  while IFS= read -r line || [[ -n "$line" ]]; do
    # 선행 공백 제거
    trimmed="${line#"${line%%[![:space:]]*}"}"
    # 주석/공백 라인 무시
    [[ -z "$trimmed" ]] && continue
    [[ "$trimmed" == \#* ]] && continue

    # [functions.<name>] 헤더 매칭
    if [[ "$trimmed" =~ ^\[functions\.([a-zA-Z0-9_-]+)\]$ ]]; then
      current_fn="${BASH_REMATCH[1]}"
      continue
    fi

    # verify_jwt = <value> 라인 매칭 (현재 functions 블록 컨텍스트)
    if [[ -n "$current_fn" && "$trimmed" =~ ^verify_jwt[[:space:]]*=[[:space:]]*(true|false) ]]; then
      printf '%s %s\n' "$current_fn" "${BASH_REMATCH[1]}"
      current_fn=""  # 중복 verify_jwt 라인 방지
    fi
  done < "$CONFIG_TOML"
}

errors=0

# config.toml 의 각 functions 블록 verify_jwt 값을 매트릭스와 비교 (REQ-SEC-002, 003).
while read -r fn actual; do
  expected="$(policy_value "$fn")"

  if [[ -z "$expected" ]]; then
    # REQ-SEC-003: 매트릭스에 없는 신규 함수 — 반드시 실패.
    echo "ERROR: function '$fn' exists in config.toml but is not in the verify_jwt policy matrix." >&2
    echo "       Add '$fn' to policy_value() in scripts/verify-jwt-policy.sh with the intended verify_jwt value." >&2
    errors=$((errors + 1))
    continue
  fi

  if [[ "$actual" != "$expected" ]]; then
    # REQ-SEC-002: 드리프트 — 함수명/기대값/실제값 명시.
    echo "ERROR: verify_jwt drift for '$fn': expected='$expected', actual='$actual'" >&2
    errors=$((errors + 1))
  fi
done < <(extract_function_verify_jwt)

# 역방향 가드 — false 정책 함수는 반드시 명시적 블록을 가져야 한다 (REQ-SEC-002).
# 이유: false 는 CLI 기본값이 아니므로, 블록이 삭제되면 CLI 가 true 를 적용해
# 외부 토큰(naver 등)을 받는 함수가 401 로 거절되는 운영 장애가 발생한다.
# true 정책 함수는 블록 누락 시 CLI 기본값(true) 과 일치하므로 블록 필수가 아니다.
for fn in naver-userinfo-proxy; do
  if ! grep -Eq "^\[functions\.${fn}\]" "$CONFIG_TOML"; then
    echo "ERROR: '$fn' requires an explicit [functions.${fn}] block with verify_jwt=false in $CONFIG_TOML." >&2
    echo "       Deleting the block makes the Supabase CLI apply its default verify_jwt=true and breaks naver login (401)." >&2
    errors=$((errors + 1))
  fi
done

if [[ $errors -gt 0 ]]; then
  echo "FAIL: $errors verify_jwt policy violation(s) detected in $CONFIG_TOML" >&2
  exit 1
fi

echo "OK: verify_jwt policy matches intended values ($CONFIG_TOML)"
exit 0
