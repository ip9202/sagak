## SPEC-SECURITY-001 Progress

- Started: 2026-07-02
- development_mode: tdd (manager-tdd, RED-GREEN-REFACTOR)
- execution_mode: solo + standard harness
- branch: (미정 — feature/SPEC-SECURITY-001-jose-defense-in-depth 예정)

## Phase 기록

- **Phase 1 (Plan) complete**: manager-spec가 expert-security 평가 보고서(2026-07-02) 기반으로 SPEC 작성. 핵심 사실 정정(DRIFT_HARD_FAIL은 verify_jwt 미검사) 위협 모델에 반영. A1 + jose 동시 도입 확정. (2026-07-02)
- **A1 역방향 가드 추가 (evaluator-active Medium 결함 해소)**: `scripts/verify-jwt-policy.sh` 에 역방향 검사 추가 — false 정책 함수(`naver-userinfo-proxy`)는 반드시 명시적 `[functions.<name>]` 블록을 가져야 함. 블록 삭제 시 CLI 기본값(true) 적용으로 naver 401 장애 유발 시나리오를 CI 단계에서 차단. true 정책 함수는 블록 누락 허용(CLI 기본값=true와 일치). TDD: RED(블록 삭제 fixture → 기대 비-제로, 구현은 0으로 통과=결함) → GREEN(for 루프 + grep 블록 헤더 검사) → 전체 게이트 green. (2026-07-02)
- **PR #121 merge (d706363, 2026-07-02)**: A1 CI 가드 + jose 서명 검증 구현이 develop에 merge. M0~M4 코드 구현 완료 (REQ-SEC-001~003, 010~012, 020, 030~042, 060~064). M5 smoke test는 배포 게이트로 남음 (REQ-SEC-050~052 미완료 — 런타임 검증이어서 배포 시점 필요).

## 마일스톤 진척

- **M0 (A1 CI 가드)**: ✅ 완료 (PR #121) — `scripts/verify-jwt-policy.sh` 정방향+역방향 가드, `verify_jwt policy guard (A1)` CI job. 단, develop 룰셋 필수 상태 체크로는 미등록(ops 후속).
- **M1 (jose 도입 — logic.ts)**: ✅ 완료 (PR #121) — `verifyAndExtractJwtSub` (RS256/JWKS) + `deno.json` jose import map (esm.sh).
- **M2 (index.ts 게이트 교체)**: ✅ 완료 (PR #121) — M-1 게이트가 `verifyAndExtractJwtSub` 사용.
- **M3 (extractJwtSub 폐지)**: ✅ 완료 (PR #121) — `@deprecated` 표시. 단, REQ-SEC-021(CI 가드로 미검증 경로 잔존 금지)는 후속 이슈로 추적 중.
- **M4 (단위 테스트)**: ✅ 완료 (PR #121) — `verify.test.ts` 7개 케이스 (유효 서명/변조/HS256혼동/만료/JWKS fetch 모킹).
- **M5 (런타임 smoke test)**: 미착수 (배포 게이트) — 로컬 + 프로덕션 + 다른 함수 회귀 (REQ-SEC-050~052). iss/aud/JWKS-URL 정확성은 런타임만 검증 가능 → 프로덕션 배포 전 로컬 smoke test 필수.

## 후속 이슈 (PR #121 이후)

- esm.sh jose 버전 핀 (재현성 확보)
- HS256 혼동 테스트 정제 (현재 통과하나 시그널 명확화 여지)
- REQ-SEC-021 CI 가드 (extractJwtSub 호출부 잔존 정적 검사)

## 수락 기준 완료 카운트

| 항목 | 상태 |
|------|------|
| REQ-SEC-001 (CI verify_jwt 단정) | 완료 (PR #121, verify-jwt-policy.sh) |
| REQ-SEC-002 (드리프트 CI 실패) | 완료 (PR #121, CI job) |
| REQ-SEC-003 (신규 함수 누락 방어) | 완료 (PR #121, 역방향 가드) |
| REQ-SEC-010 (verifyAndExtractJwtSub 도입) | 완료 (PR #121, logic.ts) |
| REQ-SEC-011 (index.ts 게이트 교체) | 완료 (PR #121, M-1 게이트) |
| REQ-SEC-012 (서명 실패 401) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-020 (extractJwtSub deprecation) | 완료 (PR #121, @deprecated) |
| REQ-SEC-021 (미검증 경로 잔존 금지) | 미완료 (후속 이슈 — CI 정적 검사) |
| REQ-SEC-030 (logic.ts 배치) | 완료 (PR #121) |
| REQ-SEC-031 (index.ts 헬퍼 호출만) | 완료 (PR #121) |
| REQ-SEC-040 (RS256 고정) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-041 (issuer 고정) | 완료 (PR #121, logic.ts) |
| REQ-SEC-042 (audience 고정) | 완료 (PR #121, logic.ts) |
| REQ-SEC-050 (로컬 smoke) | 미완료 (배포 게이트) |
| REQ-SEC-051 (프로덕션 smoke) | 미완료 (배포 게이트) |
| REQ-SEC-052 (다른 함수 회귀) | 미완료 (배포 게이트) |
| REQ-SEC-060 (유효 서명 통과) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-061 (서명 변조 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-062 (HS256 혼동 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-063 (만료 토큰 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-064 (JWKS fetch 모킹) | 완료 (PR #121, verify.test.ts) |

## 반복별 완료율 추적 (Re-planning Gate 감지용)

| 반복 | 새로 완료된 AC | 총 완료 | 에러 증감 | 비고 |
|------|---------------|---------|-----------|------|
| PR #121 (2026-07-02) | 001,002,003,010,011,012,020,030,031,040,041,042,060,061,062,063,064 (17건) | 17/21 | 0 | M5(050~052) smoke test는 배포 게이트, 021은 후속 이슈 |

## 비고

- 본 SPEC은 DB 마이그레이션 미수반. 순수 Edge Function + CI 변경.
- 롤백: feature 브랜치 + deno.json import map git-revert.
- jose Deno 호환성, JWKS URL 정확성은 구현 시 검증 필요 (미결정 6.1, 6.2).
- M5(REQ-SEC-050~052) smoke test는 iss/aud/JWKS-URL이 런타임에만 검증 가능하므로 프로덕션 배포 전 로컬 smoke test가 필수 게이트임. 실패 시 첫 번째 의심 지점 = logic.ts의 `issuer` 클레임 (실제 Supabase JWT iss 값 디코딩으로 확인).
