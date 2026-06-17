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

### M2 — GitHub Actions CI 파이프라인 ⏸️ 대기 (미착수)

- **범위**: REQ-DEPLOY-009~013 (CI 게이트, Git Flow, 태깅, hotfix 자동화)
- **산출물 (예정)**: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
- **상태**: 미착수

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

---

버전: 1.0.0
작성일: 2026-06-17
작성자: manager-docs (sync phase)
