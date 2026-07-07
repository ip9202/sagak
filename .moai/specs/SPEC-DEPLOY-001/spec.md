---
id: SPEC-DEPLOY-001
title: "Build, Deploy & CI/CD Infrastructure"
version: "1.0.0"
status: implemented
created: 2026-06-14
updated: 2026-06-24
author: "강력쇠주먹"
priority: medium
issue_number: 0

> **철회 공지 (2026-07-07, PR #140)**: 사용자 결정으로 Sentry 통합 제거. REQ-DEPLOY-014~017 무효. logToSentry(구조화 에러 로거)는 console.error 기반으로 보존됨.

---

# SPEC-DEPLOY-001: 빌드, 배포 및 CI/CD 인프라

> 사각(Sa-gak) MVP 14개 SPEC의 **최종 Phase(Phase 5)**.
> 모든 도메인 SPEC(13개)이 완료된 후 통합 빌드·배포·인프라 프로비저닝을 다룬다.

---

## HISTORY

| 날짜       | 버전   | 내용                                                                       | 작성자       |
| ---------- | ------ | -------------------------------------------------------------------------- | ------------ |
| 2026-06-14 | 1.0.0  | 최초 작성 — EAS Build/Submit, GitHub Actions CI/CD, Sentry, 환경 분리, OAuth 인프라, Storage 버킷, Edge Function 배포, Supabase 프로비저닝 정의 | 강력쇠주먹 |
| 2026-06-17 | 1.0.1  | OAuth 제공자 변경: apple → naver (REQ-DEPLOY-019, REQ-DEPLOY-020), 네이버 Custom OIDC 설정 추가, Apple 제외 사유 기술 | 강력쇠주먹 |
| 2026-06-19 | 1.0.2  | 네이버 Custom OIDC: auto-discovery → Manual (OAuth2) 모드 + userinfo proxy 전환. "missing provider id" 해결, email_verified 매핑으로 account linking 지원 (REQ-DEPLOY-019/020) | 강력쇠주먹 |
| 2026-06-24 | 1.0.3  | 최종 완료 — M2b/M3/M4/M6 구현 완료 및 머지 (PR #52, commit 86729fb). 모든 24개 REQ 완료. 상태를 in-progress → implemented로 변경 | 강력쇠주먹 |
| 2026-07-07 | 1.0.4  | **철회**: 사용자 결정으로 Sentry 통합 제거 (PR #140). REQ-DEPLOY-014~017 무효. logToSentry(구조화 에러 로거)는 console.error 기반으로 보존. | 강력쇠주먹 |

---

## 1. 환경 (Environment)

### 1.1 빌드·배포 도구

- **EAS Build** (Expo Application Services): iOS/Android 크로스 플랫폼 네이티브 빌드 (`eas build`)
- **EAS Submit**: TestFlight(Apple App Store Connect) / Google Play Console 자동 배포 (`eas submit`)
- **eas.json**: 빌드/서밋 프로필 정의 (development / staging / preview / production)

### 1.2 CI/CD 플랫폼

- **GitHub Actions**: `.github/workflows/` 기반 파이프라인
- **워크플로우 파일**: `ci.yml` (PR 품질 게이트), `deploy.yml` (배포 자동화)

### 1.3 관측·모니터링

- **Sentry**: React Native 에러 추적 (`@sentry/react-native`), 릴리즈 트래킹
- **sentry.properties / Sentry CLI**: 소스맵 업로드 (빌드 시점)

### 1.4 백엔드 인프라 도구

- **Supabase CLI** (`supabase`): 프로젝트 프로비저닝, migration 배포 (`supabase db push`), Edge Function 배포 (`supabase functions deploy`)
- **Supabase Dashboard / SQL Editor**: Storage 버킷 정책, Auth 제공자 설정 (수동 프로비저닝)

### 1.5 로컬 개발 환경 (tech.md 요구사항)

- **Node.js**: LTS 20.x 이상, npm 패키지 관리
- **Xcode + iOS SDK** (macOS): iOS 빌드·시뮬레이터
- **Android Studio + SDK**: Android 빌드·에뮬레이터
- **Expo CLI**: 전역 설치
- **Fastlane** (선택): 스토어 메타데이터·스크린샷 자동화 (미결정 — §6 참조)

### 1.6 외부 서비스 콘솔 (수동 프로비저닝)

- **Kakao Developers Console**: 카카오 OAuth 앱 등록, 콜백 URL
- **Naver Developers Console**: 네이버 OAuth 앱 등록, Client ID/Secret 발급 (Supabase Custom OIDC용)
- **Google Cloud Console + Google Play Console**: Google OAuth 클라이언트, Play 등록
- **Expo Push Notifications**: 푸시 토큰 인프라 (SPEC-NOTIF-001 산출물의 전송 채널)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. 사각은 **모바일 앱 스토어 배포 모델**(iOS App Store / Google Play)을 따른다. 데스크톱 웹 버전은 비목표(product.md 제약사항)이며, 따라서 블루-그린 배포, 카나리 릴리스 등 서버사이드 롤아웃 전략은 적용하지 않는다.
2. **Git Flow 브랜치 모델**(workspace 전역 규칙)을 준수한다: `main`(프로덕션), `develop`(통합), `feature/*`, `release/*`, `hotfix/*`. 본 SPEC의 CI/CD 파이프라인은 이 브랜치 모델을 존중하여 트리거를 분기한다.
3. **버전 명명은 SemVer**(MAJOR.MINOR.PATCH)를 따르며, 태그 `vX.Y.Z`는 `main` 브랜치에만 생성한다(workspace Git Flow 정책).
4. **환경 분리**: dev / staging / prod 세 환경을 분리한다. 각 환경은 별도의 Supabase 프로젝트(또는 최소한 별도 스키마/RLS 격리)와 별도 환경 변수 셋을 갖는다. Supabase 프로젝트 프로비저닝은 SPEC-API-001이 본 SPEC으로 위임한 항목이다(§5 추적성 참조).
5. EAS Build는 클라우드 빌드를 사용하며, 로컬 빌드(`--local`)는 CI 비용 절감 시에만 검토한다(미결정 — §6 참조).
6. Edge Function은 Deno 기반 Supabase 런타임에서 실행되며, 배포는 `supabase functions deploy`로 수행한다.

### 2.2 비즈니스 가정

1. 사각은 **1인 운영 MVP**(product.md 제약사항)이므로, CI/CD 자동화를 통해 빌드·테스트·배포·릴리즈 태깅의 운영 부담을 최소화한다.
2. 초기 출시는 **한국 시장 우선**(카카오 OAuth + 한국어 UI)이며, App Store / Play Store 모두 한국어 스토어 등록으로 시작한다.
3. 트래픽은 니치 시장 집중 전략(product.md 비목표: 대중 스케일 추구 안 함)에 따라 MVP 단계에서는 소규모이며, 다중 리전·오토스케일링 인프라는 다루지 않는다.
4. 앱스토어 심사 리드타임(iOS 최대 7일, Android 1-3일)으로 인해, 긴급 핫픽스는 `hotfix/*` 브랜치에서 `main` + `develop` 듀얼 머지 후 각 스토어에 리뷰 요청한다(workspace Git Flow Hotfix Flow 준수).
5. MVP에서는 스토어 메타데이터(스크린샷, 설명, 키워드) 수동 관리를 기본으로 하며, Fastlane 등 자동화 도구 도입은 후순위(미결정 — §6 참조).

---

## 3. 요구사항 (Requirements)

### REQ-DEPLOY-BUILD: EAS Build (iOS/Android 크로스 플랫폼 빌드)

**목적**: 환경(dev/staging/prod)별로 분리된 iOS/Android 네이티브 바이너리를 클라우드에서 재현 가능하게 빌드한다.

#### REQ-DEPLOY-001: eas.json 프로필 정의

시스템은 **항상** `eas.json`에 다음 빌드 프로필을 정의해야 한다: `development`(내부 개발용, Expo Go 호환 또는 dev client), `preview`(내부 테스터용, ad-hoc/내부 배포), `production`(스토어 제출용, store archive). 각 프로필은 환경 변수(`SENTRY_DSN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)를 해당 환경 값으로 주입해야 한다.

#### REQ-DEPLOY-002: iOS/Android 크로스 플랫폼 빌드

**WHEN** 개발자가 `eas build --profile production --platform all` 명령을 실행하면, **THEN** 시스템은 iOS(.ipa)와 Android(.apk/.aab) 바이너리를 모두 생성해야 한다.

#### REQ-DEPLOY-003: 환경 분리 빌드

**IF** 빌드 프로필이 `development` / `preview` / `production` 중 하나로 지정되면, **THEN** 시스템은 해당 프로필에 대응하는 환경 변수(`.env.development` / `.env.staging` / `.env.production`)를 주입하여 빌드해야 한다. 프로덕션 빌드는 절대 dev/staging 환경 변수를 사용해서는 안 된다.

#### REQ-DEPLOY-004: 빌드 재현성 보장

시스템은 **항상** 동일한 커밋과 동일한 `eas.json` 프로필에서 재현 가능한 빌드를 생성해야 한다. 빌드 캐시(EAS Build Cache)를 활용하되, 의존성 잠금 파일(`package-lock.json`)이 변경되면 캐시를 무효화해야 한다.

#### REQ-DEPLOY-005: 빌드 실패 알림

**IF** EAS Build가 실패하면, **THEN** 시스템은 GitHub Actions 워크플로우를 실패로 표시하고, Sentry에 빌드 에러를 기록하며, 담당자에게 알림을 발송해야 한다.

---

### REQ-DEPLOY-SUBMIT: EAS Submit (TestFlight / Play Console 자동 배포)

**목적**: 프로덕션 빌드 산출물을 Apple TestFlight와 Google Play Console에 자동으로 제출한다.

#### REQ-DEPLOY-006: TestFlight 자동 제출 (iOS)

**WHEN** `production` 프로필 iOS 빌드가 완료되면, **THEN** 시스템은 EAS Submit을 통해 App Store Connect에 바이너리를 업로드하고 TestFlight 베타 리뷰를 트리거해야 한다.

#### REQ-DEPLOY-007: Google Play Console 자동 제출 (Android)

**WHEN** `production` 프로필 Android 빌드가 완료되면, **THEN** 시스템은 EAS Submit을 통해 Google Play Console(내부 테스트 트랙)에 `.aab`를 업로드해야 한다.

#### REQ-DEPLOY-008: 서밋 크리덴셜 관리

시스템은 **절대** Apple App Store Connect API 키나 Google Play 서비스 계정 JSON을 코드 저장소에 커밋해서는 안 된다. 이 크리덴셜은 EAS Secrets 또는 GitHub Actions Encrypted Secrets에 저장해야 한다.

---

### REQ-DEPLOY-CICD: GitHub Actions 파이프라인

**목적**: 코드 푸시 시 자동으로 린트·타입체크·테스트·빌드를 실행하고, Git Flow 브랜치 모델에 따라 배포를 자동화한다.

#### REQ-DEPLOY-009: PR 품질 게이트 (ci.yml)

**WHEN** `feature/*` 또는 `release/*` 브랜치에서 `develop` 또는 `main`으로의 PR이 열리면, **THEN** GitHub Actions `ci.yml` 워크플로우가 ESLint, TypeScript 타입체크(`tsc --noEmit`), Jest 테스트, 커버리지 검사(80% 이상)를 실행해야 한다. 모든 검사가 통과해야 머지가 가능하다.

#### REQ-DEPLOY-010: release 브랜치 태깅 자동화

**WHEN** `release/vX.Y.Z` 브랜치가 `main`에 머지되면, **THEN** `deploy.yml` 워크플로우가 `vX.Y.Z` 태그를 `main`에 생성하고, EAS Build `production` 프로필을 트리거해야 한다(workspace Git Flow Release Flow 준수).

#### REQ-DEPLOY-011: hotfix 듀얼 머지 검증

**IF** `hotfix/*` 브랜치가 `main`에 머지되면, **THEN** `deploy.yml`은 패치 버전 태그(`vX.Y.(Z+1)`) 생성 후, 동일한 변경이 `develop`에도 머지되었는지 검증해야 한다(workspace Git Flow Hard Rule: hotfix 듀얼 머지 필수).

#### REQ-DEPLOY-012: develop 브랜치 CI

**WHEN** 코드가 `develop`에 푸시되면, **THEN** `ci.yml`이 린트·타입체크·테스트를 실행하고, Sentry 소스맵을 staging 환경에 업로드해야 한다.

#### REQ-DEPLOY-013: 환경별 배포 트리거 분리

시스템은 **항상** 배포 트리거를 다음과 같이 분리해야 한다: `develop` 푸시 → staging 빌드(내부 테스터), `release/*` 머지 → production 빌드(스토어 제출), `hotfix/*` 머지 → production 핫픽스 빌드.

---

### REQ-DEPLOY-OBSERVE: Sentry 에러 추적 + 환경 분리

**목적**: 프로덕션 에러를 실시간으로 추적하고, dev/staging/prod 환경을 격리한다.

#### REQ-DEPLOY-014: Sentry 통합

시스템은 **항상** `@sentry/react-native`를 초기화하고, 처리되지 않은 예외와 프로미스 거부를 Sentry로 전송해야 한다. Sentry DSN은 `EXPO_PUBLIC_SENTRY_DSN` 환경 변수로 주입한다(SPEC-API-001 REQ-API-016와 일치).

#### REQ-DEPLOY-015: 환경별 Sentry 프로젝트 분리

**IF** 빌드 환경이 `production`이면, **THEN** Sentry 이벤트는 프로덕션 프로젝트로 전송되어야 한다. dev/staging 빌드는 별도 Sentry 환경(environment 태그)으로 분리되어야 한다.

#### REQ-DEPLOY-016: 릴리즈 트래킹

**WHEN** `vX.Y.Z` 태그가 생성되면, **THEN** 시스템은 Sentry CLI로 해당 버전의 릴리즈를 생성하고 소스맵을 업로드해야 한다(미결정 항목 §6 참조 — 구현 여부 확정 필요).

#### REQ-DEPLOY-017: 소스맵 업로드

시스템은 **절대** 소스맵을 프로덕션 클라이언트 번들에 포함해서는 안 된다. 소스맵은 빌드 시점에 Sentry로만 업로드한다.

#### REQ-DEPLOY-018: 환경 변수 누락 fail-fast

**IF** 프로덕션 빌드에서 필수 환경 변수(`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`)가 누락되면, **THEN** 빌드를 즉시 중단하고 명확한 에러 메시지를 출력해야 한다(SPEC-API-001 REQ-API-018와 일치).

---

### REQ-DEPLOY-INFRA: OAuth 인프라, Storage 버킷, Edge Function 배포, Supabase 프로비저닝

**목적**: 다른 도메인 SPEC이 본 SPEC으로 위임한 인프라 프로비저닝 항목을 정의한다. 이 모듈은 13개 도메인 SPEC의 실행 가능한 인프라 기반을 제공한다.

#### REQ-DEPLOY-019: OAuth 앱 등록 및 콜백 URL (위임 항목)

시스템은 **항상** 카카오(Kakao Developers), 네이버(Naver Developers), 구글(Google Cloud Console) 세 OAuth 제공자에 앱을 등록하고, 각 제공자에 딥링크 콜백 URL(SPEC-AUTH-001 REQ-AUTH-002의 `makeRedirectUri()` 결과)을 설정해야 한다. 이 항목은 SPEC-DB-001 §5-1, SPEC-API-001 §5-2, SPEC-AUTH-001 §4-1이 본 SPEC으로 위임한 것이다.

**별도 설치 단계 (Naver Custom OIDC)**:

1. **Naver Developers Console 설정**:
   - 앱 등록: [NAVER Developers](https://developers.naver.com/)에서 앱 생성
   - Client ID/Secret 발급: OAuth 로그인용 client_id, client_secret 획득
   - 콜백 URL 등록: Supabase Auth 콜백 URL `https://<project>.supabase.co/auth/v1/callback` 추가

2. **Supabase Custom OIDC 제공자 설정** (OAuth2 모드 + userinfo proxy):
   - Supabase Dashboard → Authentication → Providers → New Provider → **Manual (OAuth2)**
   - 식별자(Identifier): `custom:naver` (`custom:` 접두사는 Supabase 공식 요구사항 — 빌트인 provider와 구분)
   - Naver 콘솔에서 획득한 Client ID, Client Secret 입력
   - Authorization URL: `https://nid.naver.com/oauth2.0/authorize`
   - Token URL: `https://nid.naver.com/oauth2.0/token`
   - **Userinfo URL: `https://<project>.supabase.co/functions/v1/naver-userinfo-proxy`** (Edge Function — 네이버 비표준 userinfo 평탄화)
   - Scopes: `openid`, `profile`, `email` (proxy가 email 반환)
   - **email_optional: true** (필수 — 네이버가 email을 반환하지 않을 경우 대응)
   - Redirect URI: Supabase가 표시하는 Callback URL (`https://<project>.supabase.co/auth/v1/callback`)

> **정합성 메모 (2026-06-19 실기기 검증 반영, account linking 확인)**:
> - 네이버 userinfo(`/v1/nid/me`)는 비표준 `response.{id,email,nickname,profile_image}` 중첩 구조로, 최상위 `sub`가 없어 Supabase가 "missing provider id" 실패. 이를 해결하기 위해 OAuth2 모드 + userinfo proxy Edge Function으로 전환함.
> - proxy는 네이버 비표준 구조를 표준 `{sub,email,name,picture, email_verified:true}`로 평탄화. 원본 userinfo를 직접 지정하면 인증 실패함.
> - proxy가 `email_verified:true`를 반환하므로 Supabase가 `auth.users.email`을 기록함. 같은 email의 다른 provider(카카오)와 account linking(auto-linking)이 작동함을 2026-06-19 실기기에서 확인(IP: `ip9202@naver.com`, `providers: ["kakao","custom:naver"]`).
> - `custom:naver` 인증 시 `auth.users.raw_app_meta_data.provider = 'custom:naver'`. DB `users.provider` CHECK(`kakao`/`naver`/`google`) 준수를 위해 `handle_new_user` 트리거가 `REPLACE(provider,'custom:','')`로 정규화 (migration `20240618000004`).
> - 클라이언트(`AuthContext.signInWithProvider`)는 `provider='naver'`일 때 Supabase에 `'custom:naver'`로 매핑 전달. 앱 도메인 식별자(`naver`)와 DB CHECK 값은 `naver` 유지.

> **Apple 제외 사유**: App Store Guideline 4.8 한국 예외 조항(한국 타겟 앱의 Apple Sign in 강제 요구사항 제외) 적용. 네이버로 대체하여 한국 시장 주류 OAuth 조합(카카오/네이버/구글) 완성.

#### REQ-DEPLOY-020: Supabase Auth 제공자 활성화 (위임 항목)

시스템은 **항상** Supabase Dashboard에서 다음 제공자를 활성화하고, 클라이언트 ID/시크릿과 콜백 URL을 구성해야 한다(SPEC-DB-001 §5-1 위임):

**Native 제공자** (Supabase 내장, 원클릭 설정):
- **Kakao**: Kakao 제공자 활성화, Kakao Developers Console에서 획득한 Client ID/Secret 입력
- **Google**: Google 제공자 활성화, Google Cloud Console에서 획득한 Client ID/Secret 입력

**Custom OIDC 제공자** (OAuth2 모드 + userinfo proxy):
- **Naver**: Custom OIDC 제공자 식별자 `custom:naver` 활성화, Naver Developers Console에서 획득한 client_id/client_secret 입력
  - Authorization URL: `https://nid.naver.com/oauth2.0/authorize`
  - Token URL: `https://nid.naver.com/oauth2.0/token`
  - Userinfo URL: `https://<project>.supabase.co/functions/v1/naver-userinfo-proxy` (Edge Function)
  - Scopes: `openid`, `profile`, `email` (proxy가 email 반환)
  - email_optional: `true` (필수)
  - DB 정규화: `handle_new_user` 트리거가 `custom:naver` → `naver` 매핑 (migration `20240618000004`)
  - 상세 설정 단계는 REQ-DEPLOY-019 "별도 설치 단계" 참조

Supabse Auth의 콜백 URL은 `https://<project>.supabase.co/auth/v1/callback`이어야 하며, 이 URL을 각 제공자 콘솔의 콜백 URL 목록에 등록해야 한다.

#### REQ-DEPLOY-021: Storage 버킷 정책 (위임 항목)

시스템은 **항상** 다음 두 Storage 버킷을 생성하고 RLS 기반 접근 정책을 적용해야 한다: `book-covers`(책 표지 이미지, 공개 읽기/인증 쓰기), `avatars`(사용자 아바타, 소유자만 쓰기/공개 읽기). 이 항목은 SPEC-DB-001 §5-6이 위임한 것이다.

#### REQ-DEPLOY-022: Edge Function 배포 (위임 항목)

**WHEN** 각 도메인 SPEC이 Edge Function 산출물을 완성하면, **THEN** 시스템은 `supabase functions deploy` 명령으로 다음 세 함수를 배포해야 한다: `kakao-book-search`(SPEC-BOOK-001), `process-join-request`(SPEC-CLUB-001), `send-notification`(SPEC-NOTIF-001). 각 함수는 환경별 Supabase 프로젝트에 배포된다.

#### REQ-DEPLOY-023: Supabase 프로젝트 프로비저닝 (위임 항목)

시스템은 **항상** dev / staging / prod 세 환경에 대해 별도 Supabase 프로젝트를 프로비저닝하고, `supabase db push`로 SPEC-DB-001의 migration(15개)과 RLS 정책(21개)을 각 프로젝트에 배포해야 한다(SPEC-API-001 §5-8 위임). 프로젝트 참조 URL과 anon key는 각 환경 변수 파일에 주입된다.

> **정책 변경 (2026-07-01, PR #105 f07404e, §6-6 해결)**: 단일 클라우드(lqltwbpocbgoxvhlmjdo) prod 승격 정책으로 amended. dev=로컬 Docker Supabase, staging/prod=동일 클라우드(ENV flag/Sentry DSN 구분). 별도 프로젝트 3개 생성은 MVP 이후 검토. REQ-DEPLOY-023 본질(환경별 구성 격리)은 런타임 환경변수 주입으로 달성.

#### REQ-DEPLOY-024: 배포 매뉴얼 및 환경 변수 문서화

시스템은 **항상** `docs/deployment.md`(배포 매뉴얼)와 `.env.example`(환경 변수 템플릿)을 유지해야 한다. `.env.example`은 모든 필수 환경 변수 키를 포함하되 실제 값은 포함하지 않는다.

---

## 4. 제외 범위 (Exclusions)

1. **데스크톱 웹 버전**: product.md 비목표. 웹 배포 파이프라인, PWA, SSR은 다루지 않는다.
2. **A/B 테스트 인프라**: 확장 단계. Firebase Remote Config, LaunchDarkly 등은 MVP 범위 밖이다.
3. **블루-그린 / 카나리 배포**: 모바일 앱 스토어 정책상 의미 없음(스토어 롤아웃 단계로 대체).
4. **다중 리전 / 글로벌 CDN 인프라**: 니치 시장 집중 전략(product.md)에 따라 MVP에서 제외.
5. **다중 Supabase 프로젝트 DB 복제 자동화**: 수동 프로비저닝만 다룬다(스키마 복제 스크립트 자동화는 후순위).
6. **Fastlane 기반 스토어 메타데이터 자동화**: 미결정(§6 참조). MVP에서는 수동 스토어 등록.
7. **관리자 모듈 배포**: `role='admin'` 권한 정책은 비목표(INDEX.md §5).
8. **데이터 마이그레이션/시드 자동화**: 비목표(INDEX.md §5).
9. **Docker 컨테이너화**: 서버리스 아키텍처(tech.md)이므로 적용하지 않는다.
10. **Kubernetes / 오케스트레이션**: 동일 이유로 제외.

---

## 5. 추적성 (Traceability)

### 5.1 SSOT 소스 문서

| 소스 문서                              | 활용                                                   |
| -------------------------------------- | ------------------------------------------------------ |
| `.moai/project/product.md`             | 비목표(데스크톱 웹 제외), 제약사항(1인 운영 MVP)      |
| `.moai/project/structure.md`           | 시스템 아키텍처(Client/Backend/External), 외부 연동(OAuth) |
| `.moai/project/tech.md`                | "빌드 및 배포" 섹션(EAS, GitHub Actions, TestFlight, Play, 태깅), "개발 환경 요구사항"(Node LTS, Supabase CLI, Xcode, Android Studio, Sentry) |
| `.moai/specs/INDEX.md`                 | Phase 5 최종 위치, 14개 SPEC 카탈로그                  |
| workspace CLAUDE.md (Git Flow)         | 브랜치 모델, release/hotfix 플로우, SemVer, 태깅 정책  |
| `package.json`, `app.json`             | 현재 Expo 설정(버전 1.0.0, SDK 55)                     |

### 5.2 위임받은 인프라 항목 (다른 SPEC → 본 SPEC)

| 위임 항목                         | 위임한 SPEC          | 본 SPEC REQ           |
| --------------------------------- | -------------------- | --------------------- |
| OAuth 앱 등록·콜백 URL 설정       | SPEC-DB-001 §5-1, SPEC-AUTH-001 §4-1 | REQ-DEPLOY-019 |
| Supabase Auth 제공자 활성화       | SPEC-DB-001 §5-1, SPEC-API-001 §5-2  | REQ-DEPLOY-020 |
| Storage 버킷 정책(book-covers, avatars) | SPEC-DB-001 §5-6 | REQ-DEPLOY-021 |
| Edge Function 배포(3종)           | SPEC-BOOK-001, SPEC-CLUB-001, SPEC-NOTIF-001 | REQ-DEPLOY-022 |
| Supabase 프로젝트 프로비저닝      | SPEC-API-001 §5-8    | REQ-DEPLOY-023        |
| 환경 변수 구조 정의               | SPEC-API-001 REQ-API-016 | REQ-DEPLOY-018, REQ-DEPLOY-024 |

### 5.3 본 SPEC이 의존하는 선행 SPEC

| 선행 SPEC       | 의존 내용                                                 |
| --------------- | --------------------------------------------------------- |
| SPEC-DB-001     | 15개 migration, 21개 RLS 정책 — 배포 대상 DB 스키마      |
| SPEC-API-001    | 환경 변수 구조(REQ-API-ENV), app.config.ts 주입 패턴     |
| SPEC-AUTH-001   | OAuth 딥링크 콜백 URL 생성 로직(makeRedirectUri)         |
| SPEC-BOOK-001   | kakao-book-search Edge Function 산출물                    |
| SPEC-CLUB-001   | process-join-request Edge Function 산출물                 |
| SPEC-NOTIF-001  | send-notification Edge Function 산출물                    |
| 모든 13개 도메인 SPEC | 통합 빌드 산출물에 포함되는 모든 클라이언트 코드    |

### 5.4 REQ ↔ EARS 유형 매핑

| REQ ID           | EARS 유형       | 검증 가능 여부 |
| ---------------- | --------------- | -------------- |
| REQ-DEPLOY-001   | Ubiquitous      | eas.json 존재  |
| REQ-DEPLOY-002   | Event-Driven    | 빌드 산출물    |
| REQ-DEPLOY-003   | State-Driven    | 환경 변수 주입 |
| REQ-DEPLOY-004   | Ubiquitous      | 재현성         |
| REQ-DEPLOY-005   | Unwanted        | 알림 발송      |
| REQ-DEPLOY-006   | Event-Driven    | TestFlight 업로드 |
| REQ-DEPLOY-007   | Event-Driven    | Play 업로드    |
| REQ-DEPLOY-008   | Unwanted        | 크리덴셜 미커밋 |
| REQ-DEPLOY-009   | Event-Driven    | CI 통과        |
| REQ-DEPLOY-010   | Event-Driven    | 태그+빌드      |
| REQ-DEPLOY-011   | State-Driven    | 듀얼 머지 검증 |
| REQ-DEPLOY-012   | Event-Driven    | develop CI     |
| REQ-DEPLOY-013   | Ubiquitous      | 트리거 분리    |
| REQ-DEPLOY-014   | Ubiquitous      | Sentry 초기화  |
| REQ-DEPLOY-015   | State-Driven    | 환경 분리      |
| REQ-DEPLOY-016   | Event-Driven    | 릴리즈 생성    |
| REQ-DEPLOY-017   | Unwanted        | 소스맵 미포함  |
| REQ-DEPLOY-018   | State-Driven    | fail-fast      |
| REQ-DEPLOY-019   | Ubiquitous      | OAuth 콘솔 등록 |
| REQ-DEPLOY-020   | Ubiquitous      | Auth 활성화    |
| REQ-DEPLOY-021   | Ubiquitous      | 버킷 존재      |
| REQ-DEPLOY-022   | Event-Driven    | 함수 배포      |
| REQ-DEPLOY-023   | Ubiquitous      | 3 프로젝트     |
| REQ-DEPLOY-024   | Ubiquitous      | 문서 존재      |

---

## 6. 미결정 사항 (Open Questions)

| #  | 미결정 항목                                      | 상태        | 비고                                                            |
| -- | ------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| 1  | CI/CD 트리거 분기 정책 (PR vs push to develop vs tag) | **해결됨**  | REQ-DEPLOY-013으로 확정: develop→staging, release 태그→prod     |
| 2  | 빌드 캐시 전략 (EAS Build Cache 임계값)          | **미해결**  | 빌드 시간 vs 비용 트레이드오프, 런 단계에서 프로파일링 후 결정  |
| 3  | Fastlane 기반 스토어 메타데이터(스크린샷/설명) 자동화 여부 | **미해결** | MVP에서는 수동, 릴리즈 안정화 후 도입 검토                     |
| 4  | Sentry 릴리즈 트래킹 연동 (소스맵 자동 업로드)    | **미해결**  | REQ-DEPLOY-016으로 정의했으나, Sentry CLI 통합 방식은 런 단계에서 확정 |
| 5  | 로컬 빌드(`eas build --local`) vs 클라우드 빌드 비용 최적화 | **미해결** | EAS 무료 quota 소진 후 검토                                     |
| 6  | 환경 분리 실제 구현 방식 (별도 Supabase 프로젝트 vs 단일 프로젝트 스키마 분리) | **해결됨** | 해결됨 (2026-07-01, PR #105 f07404e) — 단일 클라우드(lqltwbpocbgoxvhlmjdo) prod 승격, dev=로컬 Docker, staging=prod 동일 클라우드 ENV flag 구분. 별도 프로젝트 생성 없음(MVP 이후 검토). REQ-DEPLOY-023는 단일 프로젝트 정책으로 amended. |

---

## 7. 비고

- 본 SPEC은 **14개 MVP SPEC의 최종 Phase**이다. 모든 도메인 SPEC(13개)의 구현이 완료된 후 통합 빌드·배포를 수행한다.
- 본 SPEC은 **인프라 정의 문서**이며, 구현 코드(EAS 설정, 워크플로우 YAML, 콘솔 설정)는 `/moai run SPEC-DEPLOY-001` 단계에서 작성된다.
- Git Flow(workspace 전역 규칙)를 엄격히 준수한다. 본 SPEC의 CI/CD 파이프라인은 `main`/`develop`/`feature`/`release`/`hotfix` 브랜치 모델과 SemVer 태깅 정책을 전제로 설계되었다.
- OAuth 앱 등록, Storage 버킷 정책, Supabase 프로젝트 프로비저닝은 **수동 콘솔 작업**이 포함되며, 이는 자동화 스크립트가 아닌 배포 매뉴얼(`docs/deployment.md`)로 문서화한다.
- v1.0.1(2026-06-17) 변경: OAuth 제공자 apple → naver, 네이버 Custom OIDC 설정 절차 추가(REQ-DEPLOY-019, REQ-DEPLOY-020)
- v1.0.2(2026-06-19) 변경: 네이버 Custom OIDC auto-discovery → Manual (OAuth2) 모드 + naver-userinfo-proxy 전환. 비표준 userinfo 평탄화로 "missing provider id" 해결, email_verified 매핑으로 카카오/네이버 account linking 지원.

---

버전: 1.0.0
분류: SPEC (Feature — 인프라)
상태: draft (사용자 승인 대기)
