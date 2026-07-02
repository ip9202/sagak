---
id: SPEC-SECURITY-001
title: "Edge Function JWT defense-in-depth: verify_jwt CI guard + jose signature verification"
version: "1.0.0"
status: planned
created: 2026-07-02
updated: 2026-07-02
author: "강력쇠주먹"
priority: high
labels: [security, edge-function, jwt, jose, ci-guard, defense-in-depth, process-join-request]
---

# SPEC-SECURITY-001: Edge Function JWT defense-in-depth

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-07-02 | 1.0.0 | 최초 작성 — verify_jwt per-function CI guard(A1) + process-join-request jose 서명 검증 도입. expert-security 평가 보고서 기반 단일 방어선(L0 게이트웨이 verify_jwt) → 이중 방어선 전환. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **대상 Edge Function**: `supabase/functions/process-join-request/` (단일 함수, blast radius 최소화)
- **현재 인가 아키텍처 (단일 방어선)**:
  - L0 게이트웨이: `supabase/config.toml:415` `verify_jwt=true` → Supabase 플랫폼 게이트웨이가 JWT 서명+만료 검증 (플랫폼 신뢰)
  - L1 앱 게이트: `index.ts:94-113` `extractJwtSub(authHeader)` 호출 → `jwtSub !== requester_id` 비교 → 403
  - `extractJwtSub` (`logic.ts:135`): payload 디코딩 ONLY, 서명 미검증 (`@MX:WARN` at logic.ts:124-130)
  - L2: `index.ts:117-127` service_role 클라이언트(RLS bypass)가 `user_books_public` 조회
- **CI/배포 스크립트**: `scripts/deploy-edge-functions.sh` (registry.json ↔ 디렉토리 드리프트 가드, `DRIFT_HARD_FAIL` 환경변수 제공)
- **도입 라이브러리**: `jose` (Deno 호환 JWT 라이브러리, `deno.json` import map 통해 esm.sh 또는 npm: 스키마로 로드 — 구현 시 검증 필요)
- **JWKS 출처**: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (Supabase Auth 호스팅, `createRemoteJWKSet` 내장 TTL 캐시)
- **의존 SPEC**: SPEC-CLUB-001 (process-join-request Edge Function 정의), SPEC-AUTH-001 (JWT 발행 주체), SPEC-DEPLOY-001 (배포 파이프라인)

### 단일 출처 (Single Source of Truth)

본 SPEC의 위협 모델과 도입 결정은 다음 문서를 복합 SSOT로 한다:
- `supabase/config.toml` `[functions.<name>]` 블록 — verify_jwt 의도값 SSOT (process-join-request=true, send-notification=true, kakao-book-search=true, naver-userinfo-proxy=false)
- `scripts/deploy-edge-functions.sh:101-117` — DRIFT_HARD_FAIL 실제 커버리지 (registry↔디렉토리 드리프트 ONLY, verify_jwt 미검사)
- `supabase/functions/process-join-request/logic.ts:135` — extractJwtSub 구현 (payload-only 디코딩)
- `supabase/functions/process-join-request/index.ts:94-113` — M-1 인가 게이트 (extractJwtSub 소비자)
- `supabase/functions/process-join-request/logic.ts:124-130` — @MX:WARN 서명 미검증 경고
- `supabase/functions/deno.json` — Edge Function Deno import map (jose 추가 대상)
- `.moai/specs/SPEC-CLUB-001/spec.md` — REQ-CLUB-* process-join-request 원본 정의

---

## 2. 위협 모델 (Threat Model)

### 2.1 현 상태 진단 — 단일 방어선 (Single Point of Failure)

현재 process-join-request의 인가는 L0 게이트웨이 `verify_jwt=true` **한 줄**에 전적으로 의존한다. L1 앱 게이트(`extractJwtSub`)는 payload만 디코딩하므로 서명 검증 능력이 없어, L0가 우회되는 모든 시나리오에서 무력화된다.

### 2.2 시나리오 분석

| 시나리오 | 설명 | 현재 방어 | jose 도입 효과 |
|---|---|---|---|
| (a) verify_jwt 설정 드리프트 | config.toml 값이 false로 바뀌거나 CLI 재배포 시 기본값 덮어쓰기 | **없음** (DRIFT_HARD_FAIL은 registry↔디렉토리만 검사, verify_jwt 미검사 — 코드 직검 확정) | **완전 방어** (jose는 L0와 독립적) |
| (b) Supabase 플랫폼 장애 | Auth 서비스 중단 시 | L0와 함께 붕괴 | **무의미** (jose가 동일 Supabase Auth JWKS를 fetch하므로 같이 장애) |
| (c) extractJwtSub copy-paste 유출 | verify_jwt=false 함수에 extractJwtSub이 복사 붙여넣기 되는 경우 | 없음 | **간접 방어** (extractJwtSub 폐지로 근원 차단) |
| (d3) 알고리즘 혼동 (RS256 vs HS256) | 공격자가 HS256 토큰으로 서명 검증 회유 | L0가 핀치 못하면 무력화 | **의미 있는 2차 방어** |

### 2.3 핵심 사실 정정 (Critical Fact Correction)

**오해**: "PR #115 DRIFT_HARD_FAIL 가드가 verify_jwt 드리프트를 자동 차단한다."
**사실 (코드 직검 확정)**: `scripts/deploy-edge-functions.sh:101-117`의 DRIFT_HARD_FAIL 로직은 `registry.json` ↔ 함수 디렉토리 매칭만 검사한다. `verify_jwt` 값 자체를 파싱·검증하는 CI 단계는 **현재 없다**. 따라서 시나리오 (a)는 자동 방어가 전혀 없는 상태다. 이것이 A1 도입의 직접적 근거다.

### 2.4 평가 결론 — CONDITIONAL INTRODUCTION

사용자는 A1 + jose를 **동시 도입** 결정 (jose 단독 도입이 아님). 이유:
- A1은 비용이 극히 낮고 시나리오 (a)를 즉시 제거
- jose는 시나리오 (d3)에 대한 의미 있는 2차 방어 제공
- 단, jose는 (b) 플랫폼 장애를 방어하지 못함 — 동일 인프라 의존. 본 SPEC은 (b)를 **명시적으로 범위 밖**으로 둔다 (제외 범위 4.1 참조).

---

## 3. 가정 (Assumptions)

### 3.1 아키텍처 가정

1. Supabase 게이트웨이는 `verify_jwt=true` 설정 시 JWT 서명을 플랫폼 신뢰 키로 검증한다. 본 SPEC은 이 신뢰를 전제하지만, 단일 방어선 SPOF를 보완하기 위해 앱 계층에서도 독립 검증을 추가한다.
2. `jose` 라이브러리는 Deno 런타임(Supabase Edge Function)에서 `deno.json` import map을 통해 로드 가능하다 — **구현 시 검증 필요** (esm.sh vs npm: 스키마 호환성, lessons #16 다중 파일 Edge Function 배포 호환성).
3. JWKS 엔드포인트 `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`은 Supabase Auth 호스팅 공개 엔드포인트다 — **구현 시 검증 필요** (URL 정확성, 응답 스키마).
4. `createRemoteJWKSet`가 내장 TTL 캐시를 제공하므로, 별도 JWKS 캐시 로직 구현이 불필요하다 — jose 공식 문서 기준.
5. index.ts의 핸들러는 이미 async 함수이므로, `verifyAndExtractJwtSub`의 Promise 반환값을 `await`로 소비할 수 있다.
6. `deno.json`의 import map 변경은 다른 3개 함수(send-notification, kakao-book-search, naver-userinfo-proxy)에 영향을 주지 않는다 — import map은 모듈 단위 참조이므로 jose를 import하지 않는 함수는 바이트 수준 동일하게 동작한다.

### 3.2 비즈니스 가정

1. process-join-request는 service_role 클라이언트(RLS bypass)를 사용하므로, 인가 게이트 우회 시 데이터 노출 영향이 크다. 따라서 defense-in-depth 투자가 정당화된다.
2. naver-userinfo-proxy의 `verify_jwt=false`는 의도적 설정이다 (외부 네이버 토큰 사용). A1 CI 가드는 이 의도값을 "기대값=false"로 고정한다.
3. 본 SPEC은 DB 마이그레이션을 수반하지 않는다 — 순수 Edge Function + CI 변경이다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 다루지 않는다:

1. **Supabase 플랫폼 장애 방어 (위협 모델 시나리오 b)**: jose가 동일 Supabase Auth JWKS를 fetch하므로 플랫폼 장애 시 함께 붕괴한다. 이 시나리오는 본 SPEC 범위 밖이며, 플랫폼 SLA에 의존한다.
2. **jose 도입 범위 확대**: 본 SPEC은 process-join-request 1개 함수만 대상으로 한다. send-notification, kakao-book-search는 기존 L0 verify_jwt에 의존한다 (REQ-SEC-002는 process-join-request 한정).
3. **OAuth 제공자 토큰 취소 / 세션 폐기 정책**: SPEC-AUTH-001 영역.
4. **service_role 키 로테이션 / KMS 통합**: SPEC-DEPLOY-001 영역.
5. **DB RLS 정책 변경**: service_role은 RLS를 bypass하므로 RLS 변경으로는 방어할 수 없다. 본 SPEC은 인가 게이트 자체를 강화한다.
6. **다른 Edge Function의 verify_jwt=false 정책 변경**: naver-userinfo-proxy의 false는 의도적(외부 토큰)이므로 A1은 이를 존중한다.
7. **함수 코드 구조 리팩토링**: 본 SPEC은 extractJwtSub → verifyAndExtractJwtSub 교체 + jose 검증 추가에 한정한다. process-join-request의 비즈니스 로직(M-2 응답 처리 등)은 건드리지 않는다.

---

## 5. 요구사항 (Requirements)

> 본 SPEC은 두 방어층(A1 CI 가드, jose 서명 검증)으로 구성된다:
> REQ-SEC-A1 (CI 가드), REQ-SEC-JOSE (서명 검증), REQ-SEC-DEPRECATE (구 API 폐지), REQ-SEC-PLACEMENT (파일 배치), REQ-SEC-PIN (알고리즘/클레임 고정), REQ-SEC-SMOKE (런타임 검증), REQ-SEC-TEST (단위 테스트).

### REQ-SEC-A1: verify_jwt per-function CI 가드

**목적**: 시나리오 (a) verify_jwt 드리프트를 CI 단계에서 자동 차단한다. 현재 어떤 CI 단계도 verify_jwt를 검사하지 않는다(사실 정정 2.3 참조).

#### REQ-SEC-001: verify_jwt per-function CI 단정문

CI 파이프라인은 **항상** `supabase/config.toml`의 각 `[functions.<name>]` 블록에서 `verify_jwt` 값을 파싱하여, 함수별 의도값 매트릭스와 비교 검증하는 단계를 포함해야 한다. 의도값 매트릭스:
- `process-join-request` = `true`
- `send-notification` = `true`
- `kakao-book-search` = `true`
- `naver-userinfo-proxy` = `false` (외부 네이버 토큰 사용, 의도적)

#### REQ-SEC-002: 드리프트 시 CI 실패

**IF** config.toml의 함수별 `verify_jwt` 값이 의도값 매트릭스와 불일치하면,
**THEN** CI는 즉시 실패하고(fail-fast), 빌드를 중단해야 한다. 오류 메시지는 함수명, 기대값, 실제값을 명시해야 한다.

#### REQ-SEC-003: 신규 함수 누락 방어

**IF** config.toml에 새로운 `[functions.<name>]` 블록이 추가되었으나 의도값 매트릭스에 해당 함수가 정의되지 않으면,
**THEN** CI는 실패하고 "의도값 매트릭스에 함수를 추가하라"는 메시지를 출력해야 한다. 이는 신규 함수가 검증 없이 우회되는 것을 막는다.

---

### REQ-SEC-JOSE: process-join-request JWT 서명 검증

**목적**: L0 게이트웨이와 독립적으로 앱 계층에서 JWT 서명을 검증하여, 시나리오 (a)(d3)에 대한 2차 방어선을 제공한다.

#### REQ-SEC-010: verifyAndExtractJwtSub 헬퍼 도입

시스템은 **항상** `supabase/functions/process-join-request/logic.ts`에 `verifyAndExtractJwtSub(authHeader: string | null): Promise<{ sub: string } | null>` 헬퍼를 제공해야 한다. 이 헬퍼는 다음을 수행한다:
1. Authorization 헤더에서 Bearer 토큰 추출
2. jose `jwtVerify`로 서명 검증 (REQ-SEC-005 핀 치 준수)
3. 검증 성공 시 `{ sub }` 반환, 실패 시 `null` 반환

#### REQ-SEC-011: index.ts 게이트 교체

**WHEN** process-join-request가 요청을 수신하면,
**THEN** index.ts의 M-1 인가 게이트는 `extractJwtSub` 대신 `verifyAndExtractJwtSub`를 `await`로 호출해야 한다. 반환값이 `null`이면 401 Unauthorized 응답을 반환한다.

#### REQ-SEC-012: 서명 검증 실패 응답

**IF** JWT 서명 검증이 실패하면(서명 불일치, 만료, 알고리즘 혼동 시도, 잘못된 발행자/청중),
**THEN** 시스템은 HTTP 401을 반환하고, service_role 클라이언트 쿼리(`user_books_public` 조회)를 실행하지 않아야 한다.

---

### REQ-SEC-DEPRECATE: extractJwtSub 폐지

**목적**: 서명 미검증 헬퍼가 다른 함수로 copy-paste되는 시나리오 (c)를 근원 차단한다.

#### REQ-SEC-020: extractJwtSub deprecation

`extractJwtSub` 함수는 **항상** `@deprecated` JSDoc 태그로 표시되어야 하며, 함수 본문 상단에 `verifyAndExtractJwtSub` 사용을 유도하는 `console.warn` 로그를 포함해야 한다.

#### REQ-SEC-021: 미검증 경로 잔존 금지

**IF** process-join-request 코드베이스 내에 `extractJwtSub`를 호출하는 코드가 남아 있으면,
**THEN** CI(또는 린트)가 이를 감지하고 실패해야 한다. `index.ts`의 REQ-SEC-011 교체 후 유일한 소비자가 제거되어야 한다.

> 예외: extractJwtSub 함수 정의 자체는 deprecation 경고만 남기고 유지될 수 있다(타 함수 호환성). 단, 호출부는 0건이어야 한다.

---

### REQ-SEC-PLACEMENT: jose 로직 파일 배치

**목적**: tsconfig 타입 체크와 테스트 커버리지가 jose 로직을 포함하도록 보장한다 (lessons #22 — index.ts는 tsconfig exclude 대상).

#### REQ-SEC-030: logic.ts 배치 강제

jose 서명 검증 로직(`verifyAndExtractJwtSub` 구현)은 **항상** `logic.ts`에 위치해야 하며, `index.ts`에 위치해서는 안 된다. 근거: index.ts는 tsconfig exclude 대상이므로 타입 체크와 단위 테스트가 적용되지 않는다 (lessons #22).

#### REQ-SEC-031: index.ts는 헬퍼 호출만

index.ts는 **항상** `logic.ts`에서 import한 `verifyAndExtractJwtSub`를 호출만 해야 하며, jose 라이브러리를 직접 import해서는 안 된다.

---

### REQ-SEC-PIN: 알고리즘/클레임 고정

**목적**: 시나리오 (d3) 알고리즘 혼동 공격을 방어하고, 토큰 출처를 Supabase Auth로 한정한다.

#### REQ-SEC-040: 알고리즘 RS256 고정

`verifyAndExtractJwtSub`는 **항상** `algorithms: ['RS256']` 옵션으로 `jwtVerify`를 호출해야 한다. 이는 HS256 혼동 공격을 차단한다.

#### REQ-SEC-041: 발행자(issuer) 고정

`verifyAndExtractJwtSub`는 **항상** `issuer: SUPABASE_URL` 옵션으로 검증해야 한다. `SUPABASE_URL`은 Deno 환경변수에서 읽는다.

#### REQ-SEC-042: 청중(audience) 고정

`verifyAndExtractJwtSub`는 **항상** `audience: 'authenticated'` 옵션으로 검증해야 한다. 이는 Supabase Auth가 발행한 인증 토큰만 수용한다.

---

### REQ-SEC-SMOKE: 런타임 호환성 검증

**목적**: deno.json import map + jose가 로컬 및 프로덕션 Deno 런타임에서 실제로 동작함을 확인한다 (lessons #16 다중 파일 Edge Function 배포 호환성).

#### REQ-SEC-050: 로컬 smoke test

**WHEN** 구현 완료 후,
**THEN** 개발자는 `supabase functions serve` 로컬 환경에서 process-join-request에 유효한 JWT로 요청을 보내 200 응답을, 서명 변조 토큰으로 401 응답을 확인해야 한다.

#### REQ-SEC-051: 프로덕션 smoke test

**WHEN** 프로덕션 배포 후,
**THEN** 개발자는 프로덕션 process-join-request 엔드포인트에 대해 동일한 200/401 검증을 수행해야 한다. 이는 deno.json import map이 프로덕션 Supabase 런타임에서 호환됨을 확인한다.

#### REQ-SEC-052: 다른 함수 영향 없음 확인

**WHEN** deno.json import map에 jose가 추가된 후,
**THEN** send-notification, kakao-book-search, naver-userinfo-proxy 3개 함수에 대해 회귀 smoke test를 수행하여 기존 동작이 유지됨을 확인해야 한다 (jose 미사용 함수는 바이트 수준 동일 동작).

---

### REQ-SEC-TEST: 단위 테스트

**목적**: verifyAndExtractJwtSub의 보안 속성을 단위 테스트로 증명한다.

#### REQ-SEC-060: 유효 서명 토큰 통과

단위 테스트는 RS256 키페어를 생성하여 서명한 유효 JWT가 `verifyAndExtractJwtSub`를 통과하여 `{ sub }`를 반환함을 검증해야 한다.

#### REQ-SEC-061: 서명 변조 토큰 실패

단위 테스트는 서명을 1바이트라도 변조한 토큰이 `null`을 반환함을 검증해야 한다.

#### REQ-SEC-062: HS256 혼동 토큰 실패

단위 테스트는 HS256 알고리즘으로 서명한 토큰(공격자가 공개 키로 HS256 서명을 시도)이 `null`을 반환함을 검증해야 한다. 이는 REQ-SEC-040의 실제 방어를 증명한다.

#### REQ-SEC-063: 만료 토큰 실패

단위 테스트는 `exp`가 과거인 토큰이 `null`을 반환함을 검증해야 한다.

#### REQ-SEC-064: JWKS fetch 모킹

단위 테스트는 JWKS 엔드포인트 fetch를 가로채어(intercept) 네트워크 의존성 없이 결정적(deterministic) 테스트를 수행해야 한다. 이는 CI 환경에서 실제 Supabase Auth 호출 없이 검증 가능하게 한다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 jose 로드 스키마 (esm.sh vs npm:) — 구현 시 결정

**질문**: `deno.json` import map에서 jose를 `"jose": "https://esm.sh/jose@5"`로 로드할 것인가, `"jose": "npm:jose@5"`로 로드할 것인가?

**영향**: Deno 런타임 호환성, 번들 크기, 프로덕션 Supabase Edge Function 런타임 지원 여부.

**상태**: 미해결 — 구현 단계에서 양 스키마 로컬 검증 후 결정. REQ-SEC-050/051 smoke test가 최종 판단 근거.

### 6.2 A1 CI 가드 구현 형태 (bash vs YAML 파서) — 구현 시 결정

**질문**: A1 CI 가드를 bash 스크립트(config.toml 파싱)로 구현할 것인가, 전용 YAML/TOML 파서 도구를 사용할 것인가?

**영향**: bash 파싱은 의존성이 없지만 TOML 엣지 케이스(중첩 테이블, 배열)에 취약. 파서 도구는 안정적이지만 CI 의존성 추가.

**상태**: 미해결 — 구현 단계에서 결정. 어느 쪽이든 REQ-SEC-001~003을 충족해야 함.

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-SECURITY-001 | REQ-SEC-001 ~ REQ-SEC-064 | `supabase/config.toml`, `scripts/deploy-edge-functions.sh:101-117`, `supabase/functions/process-join-request/logic.ts:135`, `supabase/functions/process-join-request/index.ts:94-113`, `supabase/functions/deno.json`, expert-security 평가 보고서 (2026-07-02) |

### 상류 SPEC 의존성 (본 SPEC이 소비하는 SPEC)

| 공급자 SPEC | 공급 포인트 |
|-------------|-------------|
| SPEC-CLUB-001 | process-join-request Edge Function 원본 정의 |
| SPEC-AUTH-001 | JWT 발행 주체 (Supabase Auth, RS256) |
| SPEC-DEPLOY-001 | 배포 파이프라인, deno.json import map |

### 하류 SPEC 의존성 (본 SPEC을 소비하는 SPEC)

(현재 없음 — 본 SPEC은 process-join-request 내부 구현에 한정)

---

## 8. 구현 노트 (Implementation Notes)

### 구현 접근법 (요약, 상세는 tasks.md)

**A1 (REQ-SEC-001~003)**: CI 단계에서 `supabase/config.toml`을 파싱하여 함수별 `verify_jwt` 값을 추출, 의도값 매트릭스와 비교. 불일치 시 CI 실패. 신규 함수 누락 시 실패.

**jose (REQ-SEC-010~042)**:
1. `deno.json` import map에 jose 추가 (스키마는 미결정 6.1)
2. `logic.ts`에 `verifyAndExtractJwtSub` 헬퍼 추가 — `createRemoteJWKSet(new URL("${SUPABASE_URL}/auth/v1/.well-known/jwks.json"))` + `jwtVerify(token, JWKS, { algorithms: ['RS256'], issuer: SUPABASE_URL, audience: 'authenticated' })`
3. `index.ts` M-1 게이트에서 `extractJwtSub` → `verifyAndExtractJwtSub` 교체 (await)
4. `extractJwtSub` `@deprecated` 마킹 + `console.warn` 추가
5. JWKS 캐싱: `createRemoteJWKSet` 내장 TTL 캐시 사용 (별도 캐시 불필요)

**테스트 (REQ-SEC-060~064)**: RS256 키페어 생성(예: node crypto 또는 jose 자체 유틸), 유효/변조/HS256혼동/만료 토큰 케이스, JWKS fetch 인터셉트 모킹.

**Blast radius**: process-join-request 단일 함수. 나머지 3개 함수는 deno.json import map 변경은 공유하지만 jose 미사용 시 바이트 수준 동일 동작 (REQ-SEC-052 회귀 테스트로 확인).

**롤백**: feature 브랜치이므로 pre-jose 코드 보존. deno.json import map git-revert. DB 마이그레이션 없음.

---

**Version**: 1.0.0
**Status**: planned
**Last Updated**: 2026-07-02
