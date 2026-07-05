#!/usr/bin/env bash
# SPEC-SECURITY-001 REQ-SEC-021 — extractJwtSub 호출부 잔존 금지 CI 가드
#
# process-join-request 코드베이스 내에 extractJwtSub( 호출부가 남아 있으면 CI 를 실패시킨다.
# REQ-SEC-020 은 레거시 호환성을 위해 함수 정의 자체(deprecation 경고 포함)의 유지를 허용하므로,
# 본 가드는 "호출부(call site)"만 검사한다. 프로덕션 호출부는 반드시 0건이어야 한다.
#
# 예외 (가드 제외):
#   1. 함수 정의 라인 — function extractJwtSub / export function extractJwtSub
#   2. 주석 라인 — 선행 공백 제거 후 // 로 시작
#   3. __tests__/ 디렉토리 하위 파일 — 레거시 함수 자체의 단위 테스트는 허용
#
# 사용:
#   bash scripts/verify-no-extractjwtsub.sh                                  # 기본 경로 검사
#   TARGET_DIR=path/to/dir bash scripts/verify-no-extractjwtsub.sh           # 커스텀 루트
#   TARGET_DIR=... TESTS_EXCLUDE=custom bash scripts/verify-no-extractjwtsub.sh
#
# @MX:NOTE: [AUTO] 021 가드 — 미검증 경로(extractJwtSub)의 프로덕션 호출부 재도입 차단.
#   A1 가드(scripts/verify-jwt-policy.sh, verify_jwt 단정)와 직교하는 독립 방어선.
#   목적: future regression 방지. 현재 프로덕션 호출부는 0건.
#   @MX:SPEC: SPEC-SECURITY-001 (REQ-SEC-021)
#
# 호환성: macOS bash 3.2 호환 (lesson #15). associative array / mapfile 미사용.
set -euo pipefail

TARGET_DIR="${TARGET_DIR:-supabase/functions/process-join-request}"
TESTS_EXCLUDE="${TESTS_EXCLUDE:-__tests__}"

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "ERROR: TARGET_DIR not found at $TARGET_DIR" >&2
  exit 2
fi

errors=0

# 프로덕션 .ts 파일 순회. find -print0 + while read -d '' 조합으로 경로명 공백 안전 처리.
while IFS= read -r -d '' file; do
  # __tests__/ 하위 파일은 제외 (레거시 함수 자체의 단위 테스트 허용).
  case "$file" in
    */${TESTS_EXCLUDE}/*) continue ;;
  esac

  # grep -nE: 매칭 라인을 "lineno:content" 형식으로 반환.
  # 정규식 extractJwtSub[[:space:]]*\( — 대소문자 구분(verifyAndExtractJwtSub 의 대문자 E 와 충돌 없음).
  # 매칭 없으면 grep 이 1 반환 → true 로 정규화.
  matches="$(grep -nE 'extractJwtSub[[:space:]]*\(' "$file" 2>/dev/null || true)"
  [[ -z "$matches" ]] && continue

  while IFS= read -r match; do
    # "lineno:content" 에서 lineno 와 content 분리.
    lineno="${match%%:*}"
    content="${match#*:}"

    # 선행 공백 제거 — 주석 판별과 정의 판별을 위해.
    trimmed="${content#"${content%%[![:space:]]*}"}"

    # 주석 라인 면제 (// 로 시작).
    [[ "$trimmed" == \//* ]] && continue

    # 함수 정의 라인 면제:
    #   export function extractJwtSub ...
    #   function extractJwtSub ...
    if [[ "$trimmed" =~ ^export[[:space:]]+function[[:space:]]+extractJwtSub ]]; then
      continue
    fi
    if [[ "$trimmed" =~ ^function[[:space:]]+extractJwtSub ]]; then
      continue
    fi

    # 호출부 발견 — 에러 카운터 증가, 파일 상대경로와 라인번호 명시.
    relpath="${file#$TARGET_DIR/}"
    echo "ERROR: extractJwtSub call site found at ${relpath}:${lineno} — use verifyAndExtractJwtSub instead (REQ-SEC-021)" >&2
    errors=$((errors + 1))
  done <<< "$matches"
done < <(find "$TARGET_DIR" -type f -name '*.ts' -print0)

if [[ $errors -gt 0 ]]; then
  echo "FAIL: $errors extractJwtSub call site(s) detected in production code ($TARGET_DIR)" >&2
  exit 1
fi

echo "OK: no extractJwtSub call sites in production code ($TARGET_DIR)"
exit 0
