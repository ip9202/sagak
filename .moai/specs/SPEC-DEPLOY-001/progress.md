# SPEC-DEPLOY-001 구현 진행 로그

> 본 문서는 SPEC-DEPLOY-001(빌드, 배포 및 CI/CD 인프라)의 구현 진행 상황을 추적한다.
> SPEC-DEPLOY-001은 24개 REQ / 6개 마일스톤으로 구성된 인프라 SPEC으로, **부분 진행(in-progress)** 상태이다.

---

## 시작일

- 2026-06-17 (PR #15 머지 기준)

---

## 전체 상태: **in-progress (부분 완료)**

M1(환경 변수 + EAS Build 파운데이션)과 M5(OAuth 매뉴얼 문서화)만 머지됨. M2/M3/M4/M6은 미완료 또는 블로킹 상태.

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

### M2 — GitHub Actions CI 파이프라인 (M2a 완료 / M2b 대기)

- **범위**: REQ-DEPLOY-009~013 (CI 게이트, Git Flow, 태깅, hotfix 자동화)
- **M2a ✅ 완료 (2026-06-19, feature/SPEC-DEPLOY-001-m2-ci, 커밋 69c3bf8)**: AC-DEPLOY-009(develop PR 게이트) / AC-DEPLOY-012(develop CI) / AC-DEPLOY-013(develop/staging 트리거 분리)
  - 산출물: `.github/workflows/ci.yml` (lint+typecheck+test 병렬 잡, Node 20 LTS, npm 캐시, concurrency 취소, 최소 권한)
  - `jest.config.js`: `coverageThreshold` global 80% 추가 (측정 베이스라인 Stmts 92.15 / Bran 84.38 / Func 96.16 / Lines 93.68)
  - `tsconfig.json`: `supabase/functions/*/index.ts`(Deno entry) typecheck 제외 — develop 기존 typecheck 실패(Deno 글로벌 미인식) root cause 수정. 순수 모듈은 검사 유지(kakao entry/순수모듈 분리 정책과 일치). typecheck 직접 실행 exit 0 검증 완료. **후속 권장**: naver 2개 함수도 kakao식 entry/순수모듈 분리 적용 시 entry typecheck 복구 가능.
- **M2b ⏸️ 대기 (릴리스 준비 시점)**: AC-DEPLOY-010(release 태깅+EAS Build+GitHub Release) / AC-DEPLOY-011(hotfix 듀얼 머지+patch 태그) / AC-DEPLOY-013(production 분기) / AC-DEPLOY-012(Sentry 소스맵). `deploy.yml` 예정. EAS+Sentry+EXPO_TOKEN 자격증명 필요.
- **상태**: M2a 구현 완료(PR 대기), M2b 보류

### M3 — Sentry 통합 및 관측 인프라 ⏸️ 대기 (스캐폴드만)

- **범위**: REQ-DEPLOY-014~017 (Sentry SDK, 소스맵 업로드, 릴리즈 트래킹)
- **현재 상태**: 환경 변수 키(`EXPO_PUBLIC_SENTRY_DSN`) + 빌드 시점 fail-fast 게이트만 추가됨 (M1 범위). `@sentry/react-native` 패키지 자체는 **미설치** — M3에서 SDK 통합 예정
- **상태**: 스캐폴드만, SDK 통합 미착수

### M4 — EAS Submit 및 스토어 배포 자동화 ⏸️ 대기 (미착수)

- **범위**: REQ-DEPLOY-006~008 (TestFlight, Play Console, 스토어 크리덴셜)
- **상태**: 미착수

### M6 — Edge Function 배포 + Supabase 프로비저닝 🚫 블로킹

- **범위**: REQ-DEPLOY-022 (Edge Function 3종 배포), REQ-DEPLOY-023 (Supabase 프로젝트 프로비저닝)
- **블로킹 사유**: SPEC-CLUB-001 / SPEC-NOTIF-001이 아직 머지되지 않음 — 해당 SPEC의 Edge Function(`process-join-request`, `send-notification`)이 구현되어야 배포 가능
- **상태**: 의존성 블로킹

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

---

버전: 1.0.0
작성일: 2026-06-17
작성자: manager-docs (sync phase)
