---
id: SPEC-DEPLOY-001
title: "Build, Deploy & CI/CD — Implementation Plan"
version: "1.0.0"
status: implemented
created: 2026-06-14
updated: 2026-06-24
author: "강력쇠주먹"
priority: medium
issue_number: 0

> **철회 공지 (2026-07-07, PR #140)**: 사용자 결정으로 Sentry 통합 제거. REQ-DEPLOY-014~017 무효. M3 마일스톤(Sentry 통합) 철회.

---

# SPEC-DEPLOY-001 구현 계획 (plan.md)

> 본 문서는 spec.md에 정의된 24개 REQ를 구현하기 위한 마일스톤, 기술 접근법, 아키텍처 방향, 리스크 대응 계획을 정의한다. 구현 코드가 아닌 계획 문서이다.

---

## HISTORY

| 날짜       | 버전   | 내용                  | 작성자       |
| ---------- | ------ | --------------------- | ------------ |
| 2026-06-14 | 1.0.0  | 최초 작성 — 구현 계획 | 강력쇠주먹 |
| 2026-06-24 | 1.0.1  | 최종 완료 — 모든 마일스톤 구현 완료. 상태를 draft → implemented로 변경 | 강력쇠주먹 |
| 2026-07-07 | 1.0.2  | **철회**: M3 마일스톤(Sentry 통합) 철회. 사용자 결정으로 Sentry 통합 제거 (PR #140). REQ-DEPLOY-014~017 무효. | 강력쇠주먹 |

---

## 1. 마일스톤 (우선순위 기반)

> 시간 추정은 TRUST 원칙(예측 가능성)에 따라 사용하지 않는다. 우선순위 라벨과 의존성 순서로 표현한다.

### Milestone 1: 환경 변수 및 EAS Build 파운데이션 (Priority High)

**목표**: 빌드 인프라의 기반을 확립한다. 모든 후속 마일스톤의 전제 조건이다.

- `.env.example`, `.env.development`, `.env.staging`, `.env.production` 파일 작성 (REQ-DEPLOY-018, REQ-DEPLOY-024)
- `eas.json` 3개 프로필(development/preview/production) 정의 (REQ-DEPLOY-001)
- `app.config.ts`(또는 `app.json` 확장) 환경 변수 주입 로직 (REQ-DEPLOY-003, SPEC-API-001 REQ-API-017와 연동)
- iOS/Android 크로스 플랫폼 빌드 검증 (REQ-DEPLOY-002)
- 빌드 재현성 확보 (REQ-DEPLOY-004)
- 환경 변수 누락 fail-fast 검증 (REQ-DEPLOY-018)

**완료 조건**: `eas build --profile production --platform all`이 양 플랫폼 바이너리를 생성하고, 환경 변수가 올바르게 주입되는 것을 확인.

**의존성**: SPEC-API-001(환경 변수 구조 확정), SPEC-UI-001(프로젝트 구조).

---

### Milestone 2: GitHub Actions CI 파이프라인 (Priority High)

**목표**: 코드 품질 게이트와 Git Flow 브랜치 모델을 자동화한다.

- `.github/workflows/ci.yml` 작성 — PR 품질 게이트 (REQ-DEPLOY-009)
- develop 브랜치 CI 잡 (REQ-DEPLOY-012)
- 환경별 배포 트리거 분리 (REQ-DEPLOY-013)
- release 브랜치 태깅 자동화 (REQ-DEPLOY-010)
- hotfix 듀얼 머지 검증 로직 (REQ-DEPLOY-011)
- 빌드 실패 알림 메커니즘 (REQ-DEPLOY-005)

**완료 조건**: `feature/*` → `develop` PR이 CI를 통과해야 머지 가능하며, `release/*` → `main` 머지 시 자동 태깅+빌드가 트리거되는 것을 확인.

**의존성**: Milestone 1 (EAS Build 설정 완료). workspace Git Flow 정책 준수.

---

### Milestone 3: Sentry 통합 및 관측 인프라 (Priority High)

**목표**: 프로덕션 에러 추적과 환경 분리를 확립한다.

- `@sentry/react-native` 통합 및 초기화 (REQ-DEPLOY-014)
- 환경별 Sentry 프로젝트/environment 태그 분리 (REQ-DEPLOY-015)
- 소스맵 업로드 로직 (빌드 시점, 클라이언트 번들 미포함) (REQ-DEPLOY-017)
- Sentry 릴리즈 트래킹 연동 (REQ-DEPLOY-016, 미결정 §6-4 참조)

**완료 조건**: 프로덕션 빌드에서 발생한 에러가 환경 태그와 함께 Sentry로 전송되고, 소스맵이 자동 업로드되는 것을 확인.

**의존성**: Milestone 1 (환경 변수 주입), Milestone 2 (CI 파이프라인에서 소스맵 업로드 트리거).

---

### Milestone 4: EAS Submit 및 스토어 배포 자동화 (Priority Medium)

**목표**: 프로덕션 빌드를 TestFlight와 Google Play Console에 자동 제출한다.

- TestFlight 자동 제출 (REQ-DEPLOY-006)
- Google Play Console 자동 제출 (REQ-DEPLOY-007)
- 서밋 크리덴셜(EAS Secrets / GitHub Encrypted Secrets) 관리 (REQ-DEPLOY-008)
- `.github/workflows/deploy.yml` 완성 (REQ-DEPLOY-010과 연동)

**완료 조건**: `release/*` → `main` 머지 후 EAS Build + EAS Submit 파이프라인이 TestFlight와 Play Console 모두에 바이너리를 업로드하는 것을 확인.

**의존성**: Milestone 1, 2. Apple Developer 계정, Google Play Console 계정, App Store Connect API 키, Google Play 서비스 계정 JSON 확보 필요.

---

### Milestone 5: OAuth 인프라 및 Storage 버킷 프로비저닝 (Priority Medium)

**목표**: 다른 도메인 SPEC이 위임한 인프라 항목을 프로비저닝한다. 이 마일스톤은 사전 조건이므로 Milestone 1-4와 병렬 진행이 가능한 부분도 있다.

- 카카오/애플/구글 OAuth 앱 등록 및 콜백 URL 설정 (REQ-DEPLOY-019)
- Supabase Auth 제공자 활성화 (REQ-DEPLOY-020)
- Storage 버킷 생성(`book-covers`, `avatars`) 및 RLS 정책 적용 (REQ-DEPLOY-021)
- 배포 매뉴얼 `docs/deployment.md` 작성 (REQ-DEPLOY-024)

**완료 조건**: 세 OAuth 제공자 로그인이 성공하고, Storage 버킷에 이미지 업로드/읽기가 RLS 정책에 따라 동작하는 것을 확인.

**의존성**: SPEC-AUTH-001(로그인 플로우 완료), SPEC-DB-001(Storage RLS 정책 확정).

---

### Milestone 6: Edge Function 배포 및 Supabase 프로젝트 프로비저닝 (Priority Medium)

**목표**: 도메인 SPEC 산출물(Edge Function 3종)을 환경별 Supabase 프로젝트에 배포한다.

- dev / staging / prod Supabase 프로젝트 프로비저닝 (REQ-DEPLOY-023)
- SPEC-DB-001 migration(15개) + RLS 정책(21개) 각 프로젝트에 배포 (`supabase db push`)
- `kakao-book-search` Edge Function 배포 (REQ-DEPLOY-022, SPEC-BOOK-001 산출물)
- `process-join-request` Edge Function 배포 (REQ-DEPLOY-022, SPEC-CLUB-001 산출물)
- `send-notification` Edge Function 배포 (REQ-DEPLOY-022, SPEC-NOTIF-001 산출물)

**완료 조건**: 세 환경(dev/staging/prod) 각각에서 Edge Function 3종이 정상 응답하고, migration이 적용된 것을 확인.

**의존성**: 모든 13개 도메인 SPEC 구현 완료. 이 마일스톤은 사실상 14개 SPEC의 **최종 통합 게이트**이다.

---

## 2. 기술 접근법 (Technical Approach)

### 2.1 EAS Build 구성 전략

- `eas.json`의 `build` 섹션에 3개 프로필을 정의한다:
  - `development`: `developmentClient: true`, Expo Go 호환 (내부 개발)
  - `preview`: `distribution: "internal"`, ad-hoc 배포 (내부 테스터)
  - `production`: `distribution: "store"`, 스토어 제출용 archive
- 각 프로필의 `env` 필드에서 `EXPO_PUBLIC_*` 환경 변수를 명시적으로 매핑한다.
- `credentialsSource: "remote"`를 사용하여 EAS가 크리덴셜을 관리하도록 한다(MVP 1인 운영에 적합).

### 2.2 GitHub Actions 워크플로우 구조

- `ci.yml`: 풀 리퀘스트 품질 게이트 (린트, 타입체크, 테스트, 커버리지)
- `deploy.yml`: `release/*` 브랜치 머지 시 EAS Build + Submit 트리거
- GitHub Actions는 EAS CLI를 호출(`eas build --non-interactive`)하며, `EXPO_TOKEN`과 서밋 크리덴셜은 GitHub Encrypted Secrets로 관리한다.

### 2.3 환경 분리 전략

- **기본 가정**: dev / staging / prod 각각 별도 Supabase 프로젝트 (REQ-DEPLOY-023)
- 환경 변수는 `EXPO_PUBLIC_` 접두사로 클라이언트 번들에 주입 (SPEC-API-001 REQ-API-016 패턴 준수)
- `.env.example`은 모든 키의 템플릿, 실제 `.env.*` 파일은 `.gitignore`에서 제외

### 2.4 Sentry 통합 전략

- `@sentry/react-native` 패키지 추가, `App.tsx`(또는 `_layout.tsx`)에서 `Sentry.init()` 호출
- `environment` 필드로 dev/staging/prod 구분 (REQ-DEPLOY-015)
- EAS Build의 `postBuild` 훅(또는 GitHub Actions 잡)에서 Sentry CLI로 소스맵 업로드
- 릴리즈 트래킹은 Sentry CLI의 `sentry-cli releases new $VERSION` 명령으로 연동(미결정 §6-4)

### 2.5 Git Flow 준수 전략 (workspace 전역 규칙)

본 SPEC의 CI/CD는 workspace CLAUDE.md의 Git Flow를 엄격히 준수한다:

| 브랜치 패턴      | CI/CD 동작                                         | 연관 REQ           |
| ---------------- | -------------------------------------------------- | ------------------ |
| `feature/*` → PR | ci.yml 품질 게이트 실행                             | REQ-DEPLOY-009     |
| push to `develop` | ci.yml + staging 소스맵 업로드                     | REQ-DEPLOY-012     |
| `release/vX.Y.Z` → `main` 머지 | deploy.yml: 태그 생성 + production 빌드 + 스토어 제출 | REQ-DEPLOY-010, 013 |
| `hotfix/*` → `main` 머지 | deploy.yml: 패치 태그 + 검증(develop 머지 필수)   | REQ-DEPLOY-011     |

버전 명명: SemVer (MAJOR.MINOR.PATCH). 태그 `vX.Y.Z`는 `main`에만 생성.

---

## 3. 아키텍처 방향 (Architecture Direction)

### 3.1 빌드 산출물 파이프라인

```
[코드 푸시]
     │
     ▼
[ci.yml: 품질 게이트] ── 실패 ──→ 머지 차단
     │
     ▼ (develop 머지)
[staging 빌드 + Sentry 소스맵 업로드]
     │
     ▼ (release/vX.Y.Z 브랜치 생성)
[deploy.yml: production 빌드]
     │
     ├─→ EAS Build (iOS .ipa + Android .aab)
     │
     ├─→ EAS Submit → TestFlight (iOS)
     │
     └─→ EAS Submit → Play Console 내부 테스트 (Android)
     │
     ▼ (main 머지 + vX.Y.Z 태그)
[Sentry 릴리즈 생성]
```

### 3.2 환경 분리 아키텍처

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  dev 환경        │  │  staging 환경    │  │  prod 환경       │
│                 │  │                 │  │                 │
│  Supabase proj  │  │  Supabase proj  │  │  Supabase proj  │
│  (dev)          │  │  (staging)      │  │  (prod)         │
│                 │  │                 │  │                 │
│  .env.develop   │  │  .env.staging   │  │  .env.production│
│                 │  │                 │  │                 │
│  EAS profile:   │  │  EAS profile:   │  │  EAS profile:   │
│  development    │  │  preview        │  │  production     │
│                 │  │                 │  │                 │
│  Sentry env:    │  │  Sentry env:    │  │  Sentry env:    │
│  development    │  │  staging        │  │  production     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3.3 인프라 프로비저닝 분류

본 SPEC이 다루는 인프라 항목은 자동화 가능 여부에 따라 두 그룹으로 분류된다:

- **스크립트/코드 기반 자동화**: EAS Build, EAS Submit, GitHub Actions 워크플로우, Edge Function 배포(`supabase functions deploy`), DB migration 배포(`supabase db push`)
- **수동 콘솔 작업 (매뉴얼 문서화)**: OAuth 앱 등록(Kakao/Apple/Google 콘솔), Supabase Auth 제공자 활성화, Storage 버킷 생성, App Store Connect / Play Console 앱 등록

수동 작업은 `docs/deployment.md`에 단계별 매뉴얼로 문서화하여 재현 가능성을 확보한다.

---

## 4. 리스크 및 대응 계획

| 리스크                                                | 확률   | 영향   | 대응 계획                                                                  |
| ----------------------------------------------------- | ------ | ------ | ------------------------------------------------------------------------- |
| Apple App Store 심사 리젝 (OAuth 로그인 필수 정책 등) | 중     | 높음   | Sign in with Apple 우선 구현(REQ-DEPLOY-019), 심사 전 TestFlight 사전 검증 |
| EAS Build 무료 quota 소진                             | 중     | 중     | 로컬 빌드(`--local`) 전환 검토(미결정 §6-5), 빌드 캐시 적극 활용           |
| 환경 변수 실수로 인한 dev→prod 데이터 침범            | 낮     | 치명   | fail-fast 검증(REQ-DEPLOY-018), 빌드 프로필별 환경 변수 하드 매핑         |
| 서밋 크리덴셜(Google Play JSON 등) 저장소 노출        | 낮     | 치명   | 절대 커밋 금지(REQ-DEPLOY-008), pre-commit secret 스캐닝 도구 도입        |
| Supabase 프로젝트 3개 비용 증가                       | 중     | 중     | 결정됨(§6-6, 2026-07-01, PR #105) — 단일 클라우드(lqltwbpocbgoxvhlmjdo) prod 승격으로 3프로젝트 비용 회피. dev=로컬 Docker. |
| Edge Function Deno 런타임 버전 불일치                 | 낮     | 중     | 배포 전 로컬 `supabase functions serve`로 사전 검증                        |
| hotfix 듀얼 머지 누락으로 인한 develop 불일치         | 중     | 높음   | deploy.yml 자동 검증(REQ-DEPLOY-011), PR 템플릿에 체크리스트 포함         |
| iOS/Android 네이티브 크래시 Sentry 미포착             | 중     | 중     | 네이티브 계층 Sentry 심볼릭케이션(symbols) 업로드 검증                     |

---

## 5. 전문가 협의 권장 (Expert Consultation)

본 SPEC은 인프라/DevOps 도메인이므로, `/moai run` 단계에서 다음 전문가 협의를 권장한다:

- **expert-devops**: CI/CD 파이프라인 설계, GitHub Actions 워크플로우 최적화, EAS Build/Submit 자동화 전략 검토
- **expert-backend**: Supabase 프로젝트 프로비저닝, Edge Function 배포 전략, Storage 버킷 RLS 정책 검토
- **expert-security**: 서밋 크리덴셜 관리, 환경 변수 보안, OAuth 콜백 URL 보안 검토, pre-commit secret 스캐닝
- **expert-frontend**: Sentry React Native 통합, 소스맵 업로드 로직, 빌드 크래시 추적 검증

---

## 6. Git Flow 준수 명시

본 SPEC의 CI/CD 파이프라인은 workspace CLAUDE.md에 정의된 Git Flow를 **엄격히 준수**한다:

- `main`: 프로덕션 안정. release/hotfix 머지만 허용.
- `develop`: 피처 통합 브랜치. `feature/*`에서 머지.
- `feature/SPEC-XXX-description`: 각 SPEC 구현 브랜치.
- `release/vX.Y.Z`: 릴리즈 준비. 버전 번호 포함 필수.
- `hotfix/*`: 프로덕션 긴급 수정.

**버전 명명(SemVer)**:
- MAJOR(X.0.0): DB 스키마 대폭 변경, 프레임워크 마이그레이션
- MINOR(X.Y.0): 하위 호환 기능 추가 (새 모듈, 새 화면)
- PATCH(X.Y.Z): 버그 수정, 핫픽스

**태그 정책**: `vX.Y.Z`는 `main`에만 생성. `vX.Y.Z-rc.N`은 QA 단계 릴리즈 후보.

**hotfix 듀얼 머지**: `hotfix/*` → `main` 머지 후 반드시 `develop`에도 머지(workspace Hard Rule). 본 SPEC의 deploy.yml이 이를 자동 검증한다(REQ-DEPLOY-011).

---

## 7. 다음 단계 (Next Steps)

1. 본 SPEC(spec.md + plan.md + acceptance.md) 사용자 승인
2. `/moai run SPEC-DEPLOY-001` 실행 — 단, 모든 13개 도메인 SPEC 구현 완료 후
3. 구현 순서: Milestone 1(환경 변수/EAS) → 2(CI) → 3(Sentry) → 4(Submit) → 5(OAuth/Storage) → 6(Edge Function/Supabase 프로비저닝)
4. 각 마일스톤 완료 후 `/moai sync SPEC-DEPLOY-001`로 문서 동기화
5. 최종: App Store / Google Play 첫 프로덕션 릴리즈

---

버전: 1.0.0
분류: 구현 계획 (Implementation Plan)
상태: draft (사용자 승인 대기)
