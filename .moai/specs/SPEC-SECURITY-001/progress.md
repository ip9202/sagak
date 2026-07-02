## SPEC-SECURITY-001 Progress

- Started: 2026-07-02
- development_mode: tdd (manager-tdd, RED-GREEN-REFACTOR)
- execution_mode: solo + standard harness
- branch: (미정 — feature/SPEC-SECURITY-001-jose-defense-in-depth 예정)

## Phase 기록

- **Phase 1 (Plan) complete**: manager-spec가 expert-security 평가 보고서(2026-07-02) 기반으로 SPEC 작성. 핵심 사실 정정(DRIFT_HARD_FAIL은 verify_jwt 미검사) 위협 모델에 반영. A1 + jose 동시 도입 확정. (2026-07-02)
- **A1 역방향 가드 추가 (evaluator-active Medium 결함 해소)**: `scripts/verify-jwt-policy.sh` 에 역방향 검사 추가 — false 정책 함수(`naver-userinfo-proxy`)는 반드시 명시적 `[functions.<name>]` 블록을 가져야 함. 블록 삭제 시 CLI 기본값(true) 적용으로 naver 401 장애 유발 시나리오를 CI 단계에서 차단. true 정책 함수는 블록 누락 허용(CLI 기본값=true와 일치). TDD: RED(블록 삭제 fixture → 기대 비-제로, 구현은 0으로 통과=결함) → GREEN(for 루프 + grep 블록 헤더 검사) → 전체 게이트 green. (2026-07-02)

## 마일스톤 진척

- **M0 (A1 CI 가드)**: 미착수 — verify_jwt per-function 단정문 (REQ-SEC-001~003)
- **M1 (jose 도입 — logic.ts)**: 미착수 — verifyAndExtractJwtSub 헬퍼 + deno.json import map (REQ-SEC-010, REQ-SEC-030~042)
- **M2 (index.ts 게이트 교체)**: 미착수 — extractJwtSub → verifyAndExtractJwtSub (REQ-SEC-011~012)
- **M3 (extractJwtSub 폐지)**: 미착수 — @deprecated + 호출부 0건 검증 (REQ-SEC-020~021)
- **M4 (단위 테스트)**: 미착수 — RS256 키페어, 변조/HS256혼동/만료 케이스, JWKS fetch 모킹 (REQ-SEC-060~064)
- **M5 (런타임 smoke test)**: 미착수 — 로컬 + 프로덕션 + 다른 함수 회귀 (REQ-SEC-050~052)

## 수락 기준 완료 카운트

| 항목 | 상태 |
|------|------|
| REQ-SEC-001 (CI verify_jwt 단정) | 미완료 |
| REQ-SEC-002 (드리프트 CI 실패) | 미완료 |
| REQ-SEC-003 (신규 함수 누락 방어) | 미완료 |
| REQ-SEC-010 (verifyAndExtractJwtSub 도입) | 미완료 |
| REQ-SEC-011 (index.ts 게이트 교체) | 미완료 |
| REQ-SEC-012 (서명 실패 401) | 미완료 |
| REQ-SEC-020 (extractJwtSub deprecation) | 미완료 |
| REQ-SEC-021 (미검증 경로 잔존 금지) | 미완료 |
| REQ-SEC-030 (logic.ts 배치) | 미완료 |
| REQ-SEC-031 (index.ts 헬퍼 호출만) | 미완료 |
| REQ-SEC-040 (RS256 고정) | 미완료 |
| REQ-SEC-041 (issuer 고정) | 미완료 |
| REQ-SEC-042 (audience 고정) | 미완료 |
| REQ-SEC-050 (로컬 smoke) | 미완료 |
| REQ-SEC-051 (프로덕션 smoke) | 미완료 |
| REQ-SEC-052 (다른 함수 회귀) | 미완료 |
| REQ-SEC-060 (유효 서명 통과) | 미완료 |
| REQ-SEC-061 (서명 변조 실패) | 미완료 |
| REQ-SEC-062 (HS256 혼동 실패) | 미완료 |
| REQ-SEC-063 (만료 토큰 실패) | 미완료 |
| REQ-SEC-064 (JWKS fetch 모킹) | 미완료 |

## 반복별 완료율 추적 (Re-planning Gate 감지용)

| 반복 | 새로 완료된 AC | 총 완료 | 에러 증감 | 비고 |
|------|---------------|---------|-----------|------|
| (구현 시작 후 갱신) | | | | |

## 비고

- 본 SPEC은 DB 마이그레이션 미수반. 순수 Edge Function + CI 변경.
- 롤백: feature 브랜치 + deno.json import map git-revert.
- jose Deno 호환성, JWKS URL 정확성은 구현 시 검증 필요 (미결정 6.1, 6.2).
