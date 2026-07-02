# SPEC-SECURITY-001 Tasks

> 구현 작업 분해. TDD 모드(RED-GREEN-REFACTOR) 기준. 각 태스크는 acceptance.md(또는 spec.md Section 5)의 수락 기준에 매핑됨.

## M0 — A1 CI 가드 (REQ-SEC-001~003)

### T-001: verify_jwt 파싱 유틸 작성
- **산출물**: `scripts/verify-jwt-policy.{sh,ts}` (또는 CI 잡 내 인라인 스크립트) — `supabase/config.toml`의 `[functions.<name>]` 블록에서 `verify_jwt` 값을 파싱
- **TDD RED**: 의도값 매트릭스 fixture(process-join-request=true, naver-userinfo-proxy=false 등) 대입 시 올바른 값 추출 단정
- **TDD GREEN**: TOML 파싱 구현 (bash 또는 파서 도구 — 미결정 6.2)
- **매핑**: REQ-SEC-001

### T-002: 의도값 매트릭스 비교 로직
- **산출물**: 파싱값 ↔ 의도값 매트릭스 비교 함수. 불일치 시 비-제로 종료 + 함수명/기대값/실제값 메시지
- **매핑**: REQ-SEC-002

### T-003: 신규 함수 누락 감지
- **산출물**: config.toml에 존재하지만 의도값 매트릭스에 없는 함수명 발견 시 실패 로직
- **매핑**: REQ-SEC-003

### T-004: CI 파이프라인 통합
- **산출물**: `.github/workflows/*.yml`(또는 해당 CI 설정)에 A1 가드 잡 추가. deploy-edge-functions.sh 의존
- **매핑**: REQ-SEC-001~003 통합 검증

## M1 — jose 도입 (logic.ts, REQ-SEC-010, 030~042)

### T-005: deno.json import map에 jose 추가
- **산출물**: `supabase/functions/deno.json` import map에 `"jose": "https://esm.sh/jose@5"` 또는 `"npm:jose@5"` 추가 (미결정 6.1 — 로컬 검증 후 결정)
- **매핑**: REQ-SEC-050 선행 조건

### T-006: verifyAndExtractJwtSub 헬퍼 (logic.ts)
- **산출물**: `supabase/functions/process-join-request/logic.ts`에 `verifyAndExtractJwtSub(authHeader): Promise<{sub}|null>` 추가
  - `createRemoteJWKSet(new URL("${SUPABASE_URL}/auth/v1/.well-known/jwks.json"))`
  - `jwtVerify(token, JWKS, { algorithms: ['RS256'], issuer: SUPABASE_URL, audience: 'authenticated' })`
- **TDD RED**: 유효 토큰 통과 / 변조 / HS256 / 만료 케이스 (M4 테스트로 통합)
- **매핑**: REQ-SEC-010, REQ-SEC-030 (logic.ts 배치), REQ-SEC-040~042 (핀 치)

### T-007: SUPABASE_URL 환경변수 바인딩
- **산출물**: `Deno.env.get('SUPABASE_URL')` 읽기. 누락 시 명시적 에러
- **매핑**: REQ-SEC-041 선행

## M2 — index.ts 게이트 교체 (REQ-SEC-011~012)

### T-008: index.ts에서 verifyAndExtractJwtSub 호출로 교체
- **산출물**: `index.ts:94-113` M-1 게이트를 `extractJwtSub` → `await verifyAndExtractJwtSub`로 교체
- **매핑**: REQ-SEC-011, REQ-SEC-031 (index.ts는 헬퍼 호출만, jose 직접 import 금지)

### T-009: 401 응답 경로
- **산출물**: `verifyAndExtractJwtSub` 반환값 `null` 시 HTTP 401 응답 + service_role 쿼리 미실행
- **매핑**: REQ-SEC-012

## M3 — extractJwtSub 폐지 (REQ-SEC-020~021)

### T-010: extractJwtSub @deprecated 마킹
- **산출물**: `logic.ts:135` extractJwtSub에 `@deprecated JSDoc + console.warn('Use verifyAndExtractJwtSub')` 추가
- **매핑**: REQ-SEC-020

### T-011: 호출부 0건 검증
- **산출물**: grep 기반 CI/lint 검사 — process-join-request 코드베이스 내 `extractJwtSub(` 호출부 0건 단정 (정의 제외)
- **매핑**: REQ-SEC-021

## M4 — 단위 테스트 (REQ-SEC-060~064)

### T-012: RS256 키페어 생성 유틸
- **산출물**: 테스트 헬퍼 — RS256 공개/개인 키페어 생성 + JWT 서명 함수
- **매핑**: REQ-SEC-060 선행

### T-013: 유효 서명 통과 테스트
- **매핑**: REQ-SEC-060

### T-014: 서명 변조 실패 테스트
- **매핑**: REQ-SEC-061

### T-015: HS256 혼동 실패 테스트
- **매핑**: REQ-SEC-062

### T-016: 만료 토큰 실패 테스트
- **매핑**: REQ-SEC-063

### T-017: JWKS fetch 모킹 인터셉터
- **산출물**: `fetch` global을 가로채어 JWKS 엔드포인트 응답을 고정하는 테스트 유틸
- **매핑**: REQ-SEC-064

## M5 — 런타임 smoke test (REQ-SEC-050~052)

### T-018: 로컬 smoke test
- **산출물**: `supabase functions serve` 로컬 — 유효 JWT 200 / 변조 401 수동 검증 문서화
- **매핑**: REQ-SEC-050

### T-019: 프로덕션 smoke test
- **산출물**: 프로덕션 배포 후 동일 검증 절차 문서화
- **매핑**: REQ-SEC-051

### T-020: 다른 함수 회귀 smoke test
- **산출물**: send-notification, kakao-book-search, naver-userinfo-proxy 3개 함수 기존 동작 유지 확인
- **매핑**: REQ-SEC-052

## 드리프트 가드 추적

| 태스크 | 예상 파일 | 실제 파일 | 차이 |
|--------|----------|----------|------|
| (구현 시작 후 갱신) | | | |

## 비고

- 총 20개 태스크. M0(A1)는 M1(jose)보다 먼저 완료 권장 (도입 조건 1).
- 미결정 사항 6.1(jose 스키마), 6.2(A1 구현 형태)는 각 T-005, T-001에서 해결.
- DB 마이그레이션 없음. deno.json import map 변경은 롤백 시 git-revert.
