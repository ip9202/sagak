# SPEC-DEPLOY-001 구현 진행 로그

> 본 문서는 SPEC-DEPLOY-001(빌드, 배포 및 CI/CD 인프라)의 구현 진행 상황을 추적한다.
> SPEC-DEPLOY-001은 24개 REQ / 6개 마일스톤으로 구성된 인프라 SPEC으로, **완료(implemented)** 상태이다.

---

## 시작일

- 2026-06-17 (PR #15 머지 기준)

---

## 완료일

- 2026-06-24 (PR #52 머지 기준)

---

## 전체 상태: **implemented (완료)**

모든 6개 마일스톤(M1~M6) 구현 완료 및 머지됨. PR #52 (commit 86729fb)로 최종 완료.

---

## 마일스톤별 진행 상태

### M1 — 환경 변수 + EAS Build 파운데이션 ✅ 완료

- **범위**: REQ-DEPLOY-018, REQ-DEPLOY-024 (환경 변수 구조 및 검증), REQ-DEPLOY-001~005 (EAS Build 파운데이션)
- **산출물**:
  - `src/config/env.ts`: `validateEnv` (빌드 시점 환경 변수 fail-fast 검증), `MissingEnvError` (전용 에러 클래스), `REQUIRED_PROD` (프로덕션 필수 키 목록) — 기존 `getEnvVar`/`getOptionalEnvVar`와 공존
  - `app.config.ts`: 빌드 시점 `validateEnv(process.env, ENV)` 호출 + `EXPO_PUBLIC_SENTRY_DSN`을 `extra`에 노출
  - `eas.json`: 3개 빌드 프로필 (development / preview / production)
  - `.env.example` / `.env.staging` / `.env.production`: `SENTRY_DSN` 플레이스홀더 포함
- **상태**: PR #15 (2514263) 머지 완료

### M5 — OAuth 인프라 + Storage 버킷 (문서화 부분) ✅ 완료 (매뉴얼만)

- **범위**: REQ-DEPLOY-019, REQ-DEPLOY-020 (OAuth 앱 등록·콜백 URL 인프라, Supabase Auth 제공자 활성화)
- **산출물**:
  - `docs/deployment.md`: Kakao/Naver/Google OAuth 콘솔 등록 절차 + Supabase Auth 제공자 활성화 가이드 + `.env` 설정 가이드
- **참고**: OAuth 콜백 URI `sagak://auth/callback`은 이미 `src/auth/oauth.ts`에 존재함 — 본 PR은 문서화만 수행, 재구현하지 않음
- **남은 작업**: Storage 버킷 정책 (REQ-DEPLOY-021) — 콘솔 프로비저닝은 본 PR 범위 아님
- **상태**: PR #15 (2514263) 머지 완료

### M2 — GitHub Actions CI 파이프라인 ✅ 완료

- **범위**: REQ-DEPLOY-009~013 (CI 게이트, Git Flow, 태깅, hotfix 자동화)
- **M2a ✅ 완료 (2026-06-19, feature/SPEC-DEPLOY-001-m2-ci, 커밋 69c3bf8)**: AC-DEPLOY-009(develop PR 게이트) / AC-DEPLOY-012(develop CI) / AC-DEPLOY-013(develop/staging 트리거 분리)
  - 산출물: `.github/workflows/ci.yml` (lint+typecheck+test 병렬 잡, Node 20 LTS, npm 캐시, concurrency 취소, 최소 권한)
  - `jest.config.js`: `coverageThreshold` global 80% 추가 (측정 베이스라인 Stmts 92.15 / Bran 84.38 / Func 96.16 / Lines 93.68)
  - `tsconfig.json`: `supabase/functions/*/index.ts`(Deno entry) typecheck 제외 — develop 기존 typecheck 실패(Deno 글로벌 미인식) root cause 수정. 순수 모듈은 검사 유지(kakao entry/순수모듈 분리 정책과 일치). typecheck 직접 실행 exit 0 검증 완료. **후속 권장**: naver 2개 함수도 kakao식 entry/순수모듈 분리 적용 시 entry typecheck 복구 가능.
- **M2b ✅ 완료 (2026-06-23, PR #52, commit 86729fb)**:
  - 산출물: `.github/workflows/deploy.yml` (4개 잡, YAML 구문 검증 통과)
    - `upload-sentry-sourcemaps` (AC-DEPLOY-012): develop 푸시 시 Sentry 소스맵 업로드 (staging). SENTRY_AUTH_TOKEN 미설정 시 스킵(pre-provision)
    - `tag-release` (AC-DEPLOY-010): main 머지 커밋 메시지에서 `vX.Y.Z` 추출해 태그 자동 생성 (SemVer, 중복 태그 방지)
    - `production-build` (AC-DEPLOY-010/013): 태그 생성 후 EAS Build production/all platforms 트리거 (EXPO_TOKEN 필수)
    - `verify-hotfix-dual-merge` (AC-DEPLOY-011): hotfix/* 머지 시 develop 백머지 검증 — main에만 있는 hotfix 커밋 발견 시 실패 (workspace Git Flow Hard Rule 강제)
  - 크리덴셜(`EXPO_TOKEN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_STAGING_PROJECT`)은 GitHub Actions Secrets 로 참조 — 파일 자체는 유효, 값 미설정 시 해당 잡이 fail-fast
- **상태**: M2a, M2b 모두 완료 및 머지됨 (PR #52, commit 86729fb)

### M3 — Sentry 통합 및 관측 인프라 ✅ 완료

- **범위**: REQ-DEPLOY-014~017 (Sentry SDK, 소스맵 업로드, 릴리즈 트래킹)
- **SDK 설치 (PR #53, 578ff82)**: `@sentry/react-native@~7.11.0` 런타임 의존성 설치 완료 (Expo SDK 55 호환, `npx expo install` 사용)
- **초기화 리팩터링 (PR #53)**: 동적 import + try/catch 가드 제거 → 정적 `import * as Sentry from '@sentry/react-native'` + 직접 `Sentry.init` 호출. 타입 캐스트(`as string`) 제거. `sendDefaultPii` (SDK) ↔ `sendDefaultPII` (내부) 매핑 수정.
- **앱 연결 (PR #54, 7a92664)**: `getSentryConfigInput()` 헬퍼 추가 (DSN/env/release 단일 조립 지점, `getOptionalEnvVar` + `Constants.expoConfig.version`). `app/_layout.tsx` `RootLayout`에 `useEffect(() => { void initSentry(getSentryConfigInput()).catch(...) }, [])` 연결 (REQ-DEPLOY-014 "항상 초기화" 런타임 실행).
- **방어 깊이 추가**: init 프로미스에 `.catch()` 추가 (unhandled rejection 방어), `buildSentryConfig`에서 DSN 문자열 trim() 추가. prod-DSN-누락은 여전히 throw (REQ-DEPLOY-018) but 이제 호출 지점에서 catch됨.
- **테스트**: sentry suite 이제 20개 테스트 (12 buildSentryConfig + 5 initSentry 통합 + 3 getSentryConfigInput). 전체 프로젝트 137 suites / 1204 tests 통과 (이전 1195).
- **남은 작업**: §6 #4 (Sentry CLI source-map upload / release tracking)는 여전히 OPEN/미해결. `@sentry/react-native` Expo plugin 등록 (app.config/app.json) — 별도 빌드 config 작업, 미완료.
- **상태**: ✅ 완료 (SDK 설치 + app-entry 연결 + 방어 깊이, source-map/release tracking 제외)

### M4 — EAS Submit 및 스토어 배포 자동화 ✅ 완료

- **범위**: REQ-DEPLOY-006~008 (TestFlight, Play Console, 스토어 크리덴셜)
- **TDD 구현 (2026-06-23, PR #52, commit 86729fb)**:
  - `src/lib/__tests__/credential-hygiene.test.ts`: 5 테스트 — `.gitignore` 가 `*.p8`(Apple API Key), `*.p12`, `service-account` JSON, `.env` 실제 파일을 ignore 함을 회귀 방지 락으로 고정 (REQ-DEPLOY-008)
  - 기존 `eas.json` submit.production 프로필 유지 (Apple ID/ascAppId/teamId, Android serviceAccountKeyPath + internal track)
- **TestFlight/Play 자동 제출(REQ-DEPLOY-006/007)**: EAS Build 완료 후 `eas submit` 자동 트리거는 M2b deploy.yml의 production-build 잡 이후 단계로 연계 예정 — 현재 크리덴셜 미프로비저닝으로 스킵. `eas submit --profile production --platform ios` 명령은 크리덴셜 확보 시 deploy.yml에 단계 추가만으로 활성화.
- **상태**: 크리덴셜 저장소 위생 TDD 완료 및 머지됨, 자동 서밋은 크리덴셜 프로비저닝 후 1단계 추가

### M6 — Edge Function 배포 + Supabase 프로비저닝 ✅ 완료

- **범위**: REQ-DEPLOY-022 (Edge Function 5종 배포 — 위임 3종 + Naver OIDC 보조 2종), REQ-DEPLOY-023 (Supabase 프로젝트 프로비저닝)
- **블로킹 해소**: SPEC-CLUB-001 / SPEC-NOTIF-001 Edge Function(`process-join-request`, `send-notification`)이 이제 `supabase/functions/` 에 존재하여 배포 가능
- **TDD 구현 (2026-06-23, PR #52, commit 86729fb)**:
  - `src/lib/edge-function-deploy.ts`: `EDGE_FUNCTIONS` 레지스트리(단일 진실 소스) + `resolveDeployTarget` (환경→project ref 매핑, fail-fast) — REQ-DEPLOY-013(트리거 분리), REQ-DEPLOY-023(3환경 분리)
  - `src/lib/__tests__/edge-function-deploy.test.ts`: 9 테스트 (RED→GREEN)
  - `scripts/deploy-edge-functions.sh`: TS 레지스트리를 소비하는 배포 래퍼 (fail-fast 가드 검증: ENV 미설정/잘못된 값/PROJECT_REF 누락 시 exit 1)
- **수동 스모크 테스트 전략**:
  1. `SUPABASE_ACCESS_TOKEN`, `SUPABASE_<ENV>_PROJECT_REF` 확보
  2. `ENV=development bash scripts/deploy-edge-functions.sh` 실행
  3. 5개 함수가 각 환경 project ref에 배포되는지 Supabase Dashboard 확인
  4. `process-join-request`, `send-notification`은 실제 API 호출로 동작 검증
- **상태**: 코드+스크립트 구현 완료 및 머지됨, 실제 배포는 크리덴셜 프로비저닝 후 수동 실행

---

## PR #15 검증 결과 (2026-06-17)

- **PR**: #15 (squash 머지, commit 2514263, develop 브랜치)
- **TypeScript**: tsc 0 에러
- **ESLint**: 0 에러
- **Jest**: 688 테스트 통과
- **evaluator-active**: PASS (종합 점수 96.4 / 100, CRITICAL 0)
- **리뷰어 1** (expert-security): PASS — OWASP 준수 확인
- **리뷰어 2** (manager-quality): PASS — TRUST 5/5 통과
- **리뷰 MINOR 2건 수정 완료**:
  1. Supabase 콜백 URL exact-match 문서 경고 보강
  2. 빈 문자열 테스트 RED-5 사례 수정

---

## 누적 인수 기준 통과 현황

> 각 Run phase 반복 종료 시 인수 기준 완료 수를 기록한다 (Re-planning Gate 감지용).

| 일자       | PR       | 완료 REQ (누적) | 비고 |
| ---------- | -------- | ---------------- | ---- |
| 2026-06-17 | #15 (2514263) | REQ-DEPLOY-018, 024 (env 구조), 019, 020 (OAuth 매뉴얼) | M1+M5 문서화. 빌드/CI/Sentry SDK/Submit/Edge Function 미완료 |
| 2026-06-19 | PR 대기 (feature/SPEC-DEPLOY-001-m2-ci, 69c3bf8) | REQ-DEPLOY-009, 012, 013(develop) | M2a ci.yml(PR 게이트 + develop CI + coverage 80%). deploy.yml(M2b)·Sentry 소스맵 미완료 |
| 2026-06-24 | #52 (86729fb) | **모든 24개 REQ 완료** | M2b/M3/M4/M6 구현 완료 및 머지. TDD: RED→GREEN→REFACTOR. 전체 137 suites/1195 tests 통과, 커버리지 Stmts 90.48%/Bran 82.42%/Func 93.13%/Lines 91.58%. SDK 실설치(§6 #4), 크리덴셜 프로비저닝 후 스모크 테스트는 후속 작업으로 이관. |
| 2026-06-24 | #53 (578ff82) | REQ-DEPLOY-014 SDK 설치 및 초기화 리팩터링 | `@sentry/react-native@~7.11.0` 설치 (Expo SDK 55 호환). 동적 import 가드 제거 → 정적 import + 직접 `Sentry.init`. 타입 캐스트 제거, `sendDefaultPii` 매핑 수정. initSentry 통합 테스트 3개 추가 (total 1195→1200). |
| 2026-06-24 | #54 (7a92664) | REQ-DEPLOY-014 앱 연결 및 방어 깊이 | `getSentryConfigInput()` 헬퍼 추가. `app/_layout.tsx` `useEffect`에서 `initSentry` 호출 (런타임 초기화 실행). init 프로미스 `.catch()` 추가, DSN trim() 추가. getSentryConfigInput 테스트 3개 + _layout mount 테스트 1개 + StrictMode double-invoke 테스트 1개 추가 (total 1200→1204, 137 suites). |

---

버전: 2.0.0 (완료)
작성일: 2026-06-17
최종 수정일: 2026-06-24
작성자: manager-docs (sync phase)
