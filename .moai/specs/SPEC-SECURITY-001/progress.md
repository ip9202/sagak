## SPEC-SECURITY-001 Progress

- Started: 2026-07-02
- development_mode: tdd (manager-tdd, RED-GREEN-REFACTOR)
- execution_mode: solo + standard harness
- branch: feature/SPEC-SECURITY-001-es256-issuer (PR #121 이후 후속)

## Phase 기록

- **Phase 1 (Plan) complete**: manager-spec가 expert-security 평가 보고서(2026-07-02) 기반으로 SPEC 작성. 핵심 사실 정정(DRIFT_HARD_FAIL은 verify_jwt 미검사) 위협 모델에 반영. A1 + jose 동시 도입 확정. (2026-07-02)
- **A1 역방향 가드 추가 (evaluator-active Medium 결함 해소)**: `scripts/verify-jwt-policy.sh` 에 역방향 검사 추가 — false 정책 함수(`naver-userinfo-proxy`)는 반드시 명시적 `[functions.<name>]` 블록을 가져야 함. 블록 삭제 시 CLI 기본값(true) 적용으로 naver 401 장애 유발 시나리오를 CI 단계에서 차단. true 정책 함수는 블록 누락 허용(CLI 기본값=true와 일치). TDD: RED(블록 삭제 fixture → 기대 비-제로, 구현은 0으로 통과=결함) → GREEN(for 루프 + grep 블록 헤더 검사) → 전체 게이트 green. (2026-07-02)
- **PR #121 merge (d706363, 2026-07-02)**: A1 CI 가드 + jose 서명 검증 구현이 develop에 merge. M0~M4 코드 구현 완료 (REQ-SEC-001~003, 010~012, 020, 030~042, 060~064). M5 smoke test는 배포 게이트로 남음 (REQ-SEC-050~052 미완료 — 런타임 검증이어서 배포 시점 필요).
- **REQ-SEC-050 runtime smoke 정합성 정정 (2026-07-03)**: 실제 Supabase 액세스 토큰 디코딩 + JWKS 조회로 두 가지 프로덕션 회귀 결함 발견. (1) **알고리즘**: logic.ts는 RS256 핀이나 실제 토큰/JWKS는 ES256(ECDSA P-256, 단일 EC 키). (2) **발행자**: logic.ts는 issuer=SUPABASE_URL 이나 실제 iss=`${SUPABASE_URL}/auth/v1`. RS256 자가 서명 단위 테스트(REQ-SEC-060~064)가 프로덕션 ES256/JWKS 경로를 전혀 exercised 하지 않아 결함 미검출 — lessons #4 case (외부 시스템 정책은 실제 검증 전 미확정). aud=`authenticated` 는 변경 없음. TDD: RED(verify.test.ts ES256 전환 → REQ-SEC-060 실패) → GREEN(logic.ts ES256/issuer 정정 → 7/7 통과) → docs(spec.md/deployment.md/progress.md ES256 반영).
- **Phase E 200 실기기 prod smoke 완료 (2026-07-04)**: Pixel 6 기기 kakao OAuth → prod ES256 JWT 캡처(kid=`33157f1d-...`, iss=`https://lqltwbpocbgoxvhlmjdo.supabase.co/auth/v1`, aud=`authenticated`) → prod `process-join-request` 검증. (1) **유효 JWT → HTTP 200 OK** `{ok,club_id,request_id}` — L0 게이트웨이 `verify_jwt` + L1 jose ES256 서명 검증(`verifyAndExtractJwtSub`) 모두 통과, `requester_id==JWT sub` 인가 통과, M-2 target public reader 통과. (2) **JWT 누락 → 401** 대조군. defense-in-depth 이중 방어선 prod 동작 완전 입증 (PR #121/#123 ES256/iss 정정 최종 런타임 검증). 관찰: 보호 엔드포인트 최초 호출 시 JWKS 콜드스타트로 transient `UNAUTHORIZED_ASYMMETRIC_JWT` 401 가능 — 재시도 시 소멸 (런타임 smoke는 단일 401 판정 금지, lessons #27). 200 검증 시 생성된 lazy 클럽·멤버십·join_request side-effect 사후 정리 완료 (모두 0건 잔여). 세션 캡처 계정은 `custom:naver`+`kakao` account linking 상태 (provider 무관, 유효 prod ES256 JWT로 AC 충족). lessons #26~#29.
- **REQ-SEC-021 CI 가드 완료 (2026-07-05)**: `scripts/verify-no-extractjwtsub.sh` + `extractJwtSub remnant guard (021)` CI job 추가. process-join-request 하위 프로덕션 .ts 파일에서 `extractJwtSub(` 호출부를 정적 검사 — 함수 정의 라인/`//` 주석/`__tests__/` 하위는 예외. 현재 프로덕션 호출부 0건, future regression 차단 (가드의 목적은 사후 차단이지 발견이 아님). TDD: RED(6 테스트 전부 실패 — 스크립트 미구현으로 bash exit 127) → GREEN(스크립트 구현, 6/6 통과). macOS bash 3.2 호환 (lesson #15). A1 가드와 직교하는 독립 방어선.


## 마일스톤 진척

- **M0 (A1 CI 가드)**: ✅ 완료 (PR #121) — `scripts/verify-jwt-policy.sh` 정방향+역방향 가드, `verify_jwt policy guard (A1)` CI job. 단, develop 룰셋 필수 상태 체크로는 미등록(ops 후속).
- **M1 (jose 도입 — logic.ts)**: ✅ 완료 (PR #121/#123) — `verifyAndExtractJwtSub` (ES256/JWKS, #121 RS256 → #123 정정) + `deno.json` jose import map (esm.sh).
- **M2 (index.ts 게이트 교체)**: ✅ 완료 (PR #121) — M-1 게이트가 `verifyAndExtractJwtSub` 사용.
- **M3 (extractJwtSub 폐지)**: ✅ 완료 (PR #121) — `@deprecated` 표시. 단, REQ-SEC-021(CI 가드로 미검증 경로 잔존 금지)는 후속 이슈로 추적 중.
- **M4 (단위 테스트)**: ✅ 완료 (PR #121) — `verify.test.ts` 7개 케이스 (유효 서명/변조/HS256혼동/만료/JWKS fetch 모킹).
- **M5 (런타임 smoke test)**: 부분 완료 — REQ-SEC-050(로컬 JWKS ES256 kid=`b81269f1` + serve iss 정합 입증, 2026-07-03) + REQ-SEC-051(프로덕션 실기기 smoke 입증 — Phase E 200, 2026-07-04) 완료. REQ-SEC-052(타 보호 함수 회귀 — kakao-book-search 등)는 별도 후속. iss/aud/JWKS-URL 정확성 런타임 확정 완료.

## 후속 이슈 (PR #121 이후)

- esm.sh jose 버전 핀 (재현성 확보)
- HS256 혼동 테스트 정제 (현재 통과하나 시그널 명확화 여지)

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
| REQ-SEC-021 (미검증 경로 잔존 금지) | 완료 (PR — feature/SPEC-SECURITY-001-021-ci-guard, scripts/verify-no-extractjwtsub.sh + CI job) |
| REQ-SEC-030 (logic.ts 배치) | 완료 (PR #121) |
| REQ-SEC-031 (index.ts 헬퍼 호출만) | 완료 (PR #121) |
| REQ-SEC-040 (ES256 고정) | 완료 (PR #121 + 2026-07-03 정정 — RS256→ES256, logic.ts) |
| REQ-SEC-041 (issuer 고정) | 완료 (PR #121 + 2026-07-03 정정 — `${SUPABASE_URL}/auth/v1`, logic.ts) |
| REQ-SEC-042 (audience 고정) | 완료 (PR #121, logic.ts) |
| REQ-SEC-050 (로컬 smoke) | 완료 (로컬 JWKS ES256 kid=`b81269f1` + serve iss 정합 입증, 2026-07-03) |
| REQ-SEC-051 (프로덕션 smoke) | 완료 (Phase E 200 실기기 prod smoke — 유효 JWT 200 OK + JWT 누락 401 대조군 입증, 2026-07-04) |
| REQ-SEC-052 (다른 함수 회귀) | 미완료 (별도 후속 — kakao-book-search 등 타 보호 함수) |
| REQ-SEC-060 (유효 서명 통과) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-061 (서명 변조 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-062 (HS256 혼동 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-063 (만료 토큰 실패) | 완료 (PR #121, verify.test.ts) |
| REQ-SEC-064 (JWKS fetch 모킹) | 완료 (PR #121, verify.test.ts) |

## 반복별 완료율 추적 (Re-planning Gate 감지용)

| 반복 | 새로 완료된 AC | 총 완료 | 에러 증감 | 비고 |
|------|---------------|---------|-----------|------|
| PR #121 (2026-07-02) | 001,002,003,010,011,012,020,030,031,040,041,042,060,061,062,063,064 (17건) | 17/21 | 0 | M5(050~052) smoke test는 배포 게이트, 021은 후속 이슈 |
| ES256 정정 (2026-07-03) | 040,041 정정 (RS256→ES256 / issuer=`${SUPABASE_URL}/auth/v1`) | 17/21 | 0 | REQ-SEC-050 smoke로 프로덕션 회귀 결함 발견·수정. AC 카운트 변동 없음(이미 "완료" 라벨이었으나 실제로는 프로덕션 401 회귀였음). M5 런타임 smoke는 여전히 배포 게이트. |
| Phase E 200 실기기 prod smoke (2026-07-04) | 050, 051 완료 처리 | 19/21 | 0 | prod 실기기 kakao OAuth → ES256 JWT 캡처 → 200 OK(유효 JWT) + 401(JWT 누락) 대조군 입증. defense-in-depth(L0 게이트웨이 + L1 jose ES256) prod 완전 입증. 잔여 021(CI 정적 가드), 052(타 함수 회귀) — 후속 이슈. |
| REQ-SEC-021 CI 가드 (2026-07-05) | 021 완료 | 20/21 | 0 | scripts/verify-no-extractjwtsub.sh + `extractJwtSub remnant guard (021)` CI job. 프로덕션 .ts 파일의 extractJwtSub( 호출부를 정적 검사 (함수 정의/주석/__tests__/ 예외). TDD: RED(6 테스트 전부 실패 — 스크립트 미구현) → GREEN(스크립트 구현, 6/6 통과). 현재 호출부 0건, future regression 차단. |

## 비고

- 본 SPEC은 DB 마이그레이션 미수반. 순수 Edge Function + CI 변경.
- 롤백: feature 브랜치 + deno.json import map git-revert.
- jose Deno 호환성, JWKS URL 정확성은 구현 시 검증 필요 (미결정 6.1, 6.2).
- M5 런타임 smoke: REQ-SEC-050(로컬 JWKS/serve 정합) + 051(프로덕션 실기기 200/401) 입증 완료 (2026-07-04 Phase E 200). iss/aud/JWKS-URL 런타임 확정. 잔여 052(타 보호 함수 회귀)는 별도 후속. 런타임 smoke 시 보호 엔드포인트 최초 호출은 JWKS 콜드스타트로 transient 401 가능 → 반드시 재시도로 확정 (lessons #27). 실패 시 첫 의심 지점 = logic.ts `issuer` 클레임 (실제 Supabase JWT iss 디코딩으로 확인).
