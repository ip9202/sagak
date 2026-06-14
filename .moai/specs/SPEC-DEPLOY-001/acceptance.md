---
id: SPEC-DEPLOY-001
title: "Build, Deploy & CI/CD — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: medium
issue_number: 0
---

# SPEC-DEPLOY-001 인수 기준 (acceptance.md)

> 본 문서는 spec.md의 24개 REQ에 대한 인수 기준을 Given-When-Then(Gherkin) 형식으로 정의한다. 각 시나리오는 관찰 가능한 증거를 요구한다.

---

## HISTORY

| 날짜       | 버전   | 내용                  | 작성자       |
| ---------- | ------ | --------------------- | ------------ |
| 2026-06-14 | 1.0.0  | 최초 작성 — 인수 기준 | 강력쇠주먹 |

---

## 1. 빌드 인수 기준 (REQ-DEPLOY-BUILD)

### AC-DEPLOY-001: eas.json 프로필 존재

```gherkin
Feature: eas.json 빌드 프로필 정의
  REQ-DEPLOY-001 (Ubiquitous)

  Scenario: 세 개의 표준 프로필이 정의되어 있다
    Given eas.json 파일이 프로젝트 루트에 존재한다
    When eas.json의 build 섹션을 파싱한다
    Then "development", "preview", "production" 세 프로필이 모두 정의되어 있다
    And 각 프로필은 환경 변수(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SENTRY_DSN)를 포함한다
```

### AC-DEPLOY-002: iOS/Android 크로스 플랫폼 빌드

```gherkin
Feature: 크로스 플랫폼 빌드
  REQ-DEPLOY-002 (Event-Driven)

  Scenario: production 프로필로 양 플랫폼 빌드가 성공한다
    Given EAS Build가 활성화되어 있다
    When "eas build --profile production --platform all" 명령을 실행한다
    Then iOS 바이너리(.ipa)가 생성된다
    And Android 바이너리(.aab)가 생성된다
    And 두 빌드 모두 EAS 대시보드에서 "FINISHED" 상태로 표시된다
```

### AC-DEPLOY-003: 환경 분리 빌드

```gherkin
Feature: 환경별 빌드 분리
  REQ-DEPLOY-003 (State-Driven)

  Scenario: production 프로필은 prod 환경 변수만 사용한다
    Given .env.production 파일에 프로덕션 Supabase URL이 정의되어 있다
    When "eas build --profile production"을 실행한다
    Then 빌드된 바이너리의 번들에 프로덕션 환경 변수가 주입된다
    And dev/staging 환경 변수는 번들에 포함되지 않는다

  Scenario: dev/staging 변수가 프로덕션 빌드에 누락된다
    Given production 프로필 빌드가 완료된다
    When 빌드된 앱을 역컴파일하여 환경 변수를 확인한다
    Then dev/staging용 Supabase URL이나 키가 발견되지 않는다
```

### AC-DEPLOY-004: 빌드 재현성

```gherkin
Feature: 빌드 재현 가능성
  REQ-DEPLOY-004 (Ubiquitous)

  Scenario: 동일한 커밋과 프로필에서 재현 가능한 빌드
    Given 특정 git 커밋 해시가 있다
    When 같은 커밋에서 같은 eas.json 프로필로 두 번 빌드한다
    Then 두 빌드의 의존성(package-lock.json)이 동일하다
    And package-lock.json이 변경되면 빌드 캐시가 무효화된다
```

### AC-DEPLOY-005: 빌드 실패 알림

```gherkin
Feature: 빌드 실패 감지 및 알림
  REQ-DEPLOY-005 (Unwanted)

  Scenario: 빌드 실패 시 알림이 발생한다
    Given EAS Build가 실행 중이다
    When 빌드가 실패한다 (예: 컴파일 에러)
    Then GitHub Actions 워크플로우가 실패 상태로 종료된다
    And Sentry에 빌드 에러 이벤트가 기록된다
    And 담당자에게 알림이 발송된다 (이메일 또는 GitHub notification)
```

---

## 2. EAS Submit 인수 기준 (REQ-DEPLOY-SUBMIT)

### AC-DEPLOY-006: TestFlight 자동 제출

```gherkin
Feature: TestFlight 자동 제출
  REQ-DEPLOY-006 (Event-Driven)

  Scenario: iOS production 빌드 후 TestFlight에 업로드
    Given production 프로필 iOS 빌드가 성공적으로 완료된다
    When EAS Submit이 자동으로 트리거된다
    Then App Store Connect에 .ipa가 업로드된다
    And TestFlight 베타 리뷰가 시작된다
    And App Store Connect 웹에서 업로드된 빌드를 확인할 수 있다
```

### AC-DEPLOY-007: Google Play 자동 제출

```gherkin
Feature: Google Play Console 자동 제출
  REQ-DEPLOY-007 (Event-Driven)

  Scenario: Android production 빌드 후 Play Console에 업로드
    Given production 프로필 Android 빌드가 성공적으로 완료된다
    When EAS Submit이 자동으로 트리거된다
    Then Google Play Console "내부 테스트" 트랙에 .aab가 업로드된다
    And Play Console 웹에서 업로드된 빌드를 확인할 수 있다
```

### AC-DEPLOY-008: 서밋 크리덴셜 보안

```gherkin
Feature: 서밋 크리덴셜 노출 방지
  REQ-DEPLOY-008 (Unwanted)

  Scenario: 크리덴셜이 저장소에 커밋되지 않는다
    Given App Store Connect API 키와 Google Play 서비스 계정 JSON이 있다
    When 저장소 전체를 검색한다 (git log 포함)
    Then 크리덴셜 값이 단 한 건도 검색되지 않는다
    And 크리덴셜은 EAS Secrets 또는 GitHub Encrypted Secrets에만 존재한다

  Scenario: pre-commit 훅이 시크릿 노출을 차단한다
    Given pre-commit secret 스캐닝 도구가 설치되어 있다
    When 크리덴셜을 포함한 파일을 커밋하려 한다
    Then 커밋이 거부된다
```

---

## 3. CI/CD 파이프라인 인수 기준 (REQ-DEPLOY-CICD)

### AC-DEPLOY-009: PR 품질 게이트

```gherkin
Feature: 풀 리퀘스트 품질 게이트
  REQ-DEPLOY-009 (Event-Driven)

  Scenario: 모든 품질 검사를 통과한 PR만 머지 가능하다
    Given feature/* 브랜치에서 develop로 PR이 열린다
    When ci.yml 워크플로우가 실행된다
    Then ESLint 검사가 실행된다
    And TypeScript 타입체크(tsc --noEmit)가 실행된다
    And Jest 테스트가 실행된다
    And 테스트 커버리지가 80% 이상인지 확인된다
    And 모든 검사가 통과해야 "Merge" 버튼이 활성화된다

  Scenario: 검사 실패 시 머지 차단
    Given PR의 ESLint 검사가 실패한다
    When 개발자가 머지를 시도한다
    Then 머지가 차단된다
    And PR에 실패한 검사 항목이 표시된다
```

### AC-DEPLOY-010: release 브랜치 태깅 자동화

```gherkin
Feature: 릴리즈 태깅 자동화
  REQ-DEPLOY-010 (Event-Driven)

  Scenario: release/vX.Y.Z 머지 시 태그와 빌드가 자동 실행된다
    Given release/v1.2.0 브랜치가 main으로 머지된다
    When deploy.yml 워크플로우가 트리거된다
    Then main 브랜치에 v1.2.0 태그가 생성된다
    And EAS Build production 프로필이 자동 실행된다
    And GitHub Releases에 v1.2.0 릴리즈가 생성된다
```

### AC-DEPLOY-011: hotfix 듀얼 머지 검증

```gherkin
Feature: hotfix 듀얼 머지 검증
  REQ-DEPLOY-011 (State-Driven)

  Scenario: hotfix가 main에 머지되면 develop 머지를 검증한다
    Given hotfix/fix-crash 브랜치가 main에 머지된다
    When deploy.yml이 패치 태그(vX.Y.Z+1)를 생성한다
    Then 동일한 변경이 develop에도 머지되었는지 확인한다
    And develop 머지가 누락된 경우 워크플로우가 경고를 발생시킨다
```

### AC-DEPLOY-012: develop 브랜치 CI

```gherkin
Feature: develop 브랜치 지속적 통합
  REQ-DEPLOY-012 (Event-Driven)

  Scenario: develop 푸시 시 CI 실행 및 staging 소스맵 업로드
    Given 코드가 develop 브랜치에 푸시된다
    When ci.yml 워크플로우가 실행된다
    Then 린트, 타입체크, 테스트가 실행된다
    And Sentry에 staging 환경 소스맵이 업로드된다
```

### AC-DEPLOY-013: 환경별 배포 트리거 분리

```gherkin
Feature: 배포 트리거 분기
  REQ-DEPLOY-013 (Ubiquitous)

  Scenario: develop 푸시는 staging 빌드만 트리거한다
    Given 코드가 develop에 푸시된다
    When 배포 파이프라인이 평가된다
    Then staging 환경 빌드가 실행된다
    And production 빌드는 실행되지 않는다

  Scenario: release 머지만 production 빌드를 트리거한다
    Given release/* 브랜치가 main에 머지된다
    When 배포 파이프라인이 평가된다
    Then production 빌드와 스토어 제출이 실행된다

  Scenario: hotfix 머지는 production 핫픽스 빌드를 트리거한다
    Given hotfix/* 브랜치가 main에 머지된다
    When 배포 파이프라인이 평가된다
    Then 패치 버전 production 빌드가 실행된다
```

---

## 4. Sentry/관측 인수 기준 (REQ-DEPLOY-OBSERVE)

### AC-DEPLOY-014: Sentry 초기화

```gherkin
Feature: Sentry 에러 추적 통합
  REQ-DEPLOY-014 (Ubiquitous)

  Scenario: 앱 시작 시 Sentry가 초기화된다
    Given 프로덕션 빌드에 EXPO_PUBLIC_SENTRY_DSN이 주입되어 있다
    When 앱이 실행된다
    Then Sentry.init()이 호출된다
    And 처리되지 않은 예외가 Sentry로 전송된다

  Scenario: 프로미스 거부가 추적된다
    Given 앱 내에서 처리되지 않은 Promise rejection이 발생한다
    When 해당 에러가 전파된다
    Then Sentry에 이벤트로 기록된다
```

### AC-DEPLOY-015: 환경별 Sentry 분리

```gherkin
Feature: Sentry 환경 분리
  REQ-DEPLOY-015 (State-Driven)

  Scenario: 프로덕션 빌드 이벤트는 production 환경으로 전송된다
    Given production 프로필로 빌드된 앱이 있다
    When 에러가 발생한다
    Then Sentry 이벤트의 environment 필드가 "production"이다

  Scenario: dev 빌드 이벤트는 development 환경으로 전송된다
    Given development 프로필로 빌드된 앱이 있다
    When 에러가 발생한다
    Then Sentry 이벤트의 environment 필드가 "development"이다
    And 프로덕션 환경과 섞이지 않는다
```

### AC-DEPLOY-016: 릴리즈 트래킹

```gherkin
Feature: Sentry 릴리즈 추적
  REQ-DEPLOY-016 (Event-Driven)

  Scenario: 태그 생성 시 Sentry 릴리즈가 생성된다
    Given vX.Y.Z 태그가 main에 생성된다
    When deploy.yml의 post-tag 잡이 실행된다
    Then Sentry CLI로 "vX.Y.Z" 릴리즈가 생성된다
    And 소스맵이 해당 릴리즈에 업로드된다
    And 에러가 발생하면 해당 릴리즈에 귀속된다
```

### AC-DEPLOY-017: 소스맵 보안

```gherkin
Feature: 소스맵 클라이언트 번들 미포함
  REQ-DEPLOY-017 (Unwanted)

  Scenario: 프로덕션 번들에 소스맵이 포함되지 않는다
    Given production 프로필 빌드가 완료된다
    When 빌드된 클라이언트 번들을 검사한다
    Then .map 파일이나 인라인 소스맵이 발견되지 않는다
    And 소스맵은 Sentry로만 업로드된다
```

### AC-DEPLOY-018: 환경 변수 fail-fast

```gherkin
Feature: 환경 변수 누락 빌드 중단
  REQ-DEPLOY-018 (State-Driven)

  Scenario: 프로덕션 빌드에서 필수 환경 변수 누락 시 중단
    Given .env.production에서 EXPO_PUBLIC_SENTRY_DSN이 누락된다
    When production 빌드를 실행한다
    Then 빌드가 즉시 중단된다
    And 누락된 환경 변수 이름이 포함된 에러 메시지가 출력된다

  Scenario: 빌드 시점 검증
    Given app.config.ts에 환경 변수 검증 로직이 있다
    When 빌드를 실행한다
    Then 빌드 시점에 환경 변수가 검증된다
    And 런타임이 아닌 빌드 시점에 실패한다
```

---

## 5. 인프라 프로비저닝 인수 기준 (REQ-DEPLOY-INFRA)

### AC-DEPLOY-019: OAuth 앱 등록 및 콜백 URL

```gherkin
Feature: OAuth 제공자 앱 등록
  REQ-DEPLOY-019 (Ubiquitous) — 위임 항목 (SPEC-DB-001, SPEC-AUTH-001)

  Scenario: 세 OAuth 제공자에 앱이 등록된다
    Given Kakao Developers, Apple Developer, Google Cloud Console 계정이 있다
    When 각 콘솔에서 사각 앱을 등록한다
    Then 카카오 앱에 딥링크 콜백 URL이 설정된다
    And Apple Services ID에 Return URL이 설정된다
    And Google OAuth 클라이언트에 승인된 리다이렉트 URI가 설정된다
    And 모든 콜백 URL은 expo-linking makeRedirectUri() 결과와 일치한다
```

### AC-DEPLOY-020: Supabase Auth 제공자 활성화

```gherkin
Feature: Supabase Auth OAuth 활성화
  REQ-DEPLOY-020 (Ubiquitous) — 위임 항목 (SPEC-DB-001, SPEC-API-001)

  Scenario: 세 제공자가 Supabase에 활성화된다
    Given Supabase Dashboard에 접근할 수 있다
    When Auth → Providers 설정을 연다
    Then Kakao, Apple, Google 세 제공자가 모두 "Enabled" 상태다
    And 각 제공자에 클라이언트 ID와 시크릿이 구성된다
    And 콜백 URL이 https://<project>.supabase.co/auth/v1/callback로 설정된다

  Scenario: OAuth 로그인이 성공한다
    Given 세 제공자가 활성화되어 있다
    When 클라이언트에서 카카오/애플/구글 로그인을 시도한다 (SPEC-AUTH-001)
    Then 세 제공자 모두 로그인이 성공한다
    And Supabase auth.users에 사용자 행이 생성된다
```

### AC-DEPLOY-021: Storage 버킷 정책

```gherkin
Feature: Storage 버킷 및 RLS 정책
  REQ-DEPLOY-021 (Ubiquitous) — 위임 항목 (SPEC-DB-001)

  Scenario: book-covers 버킷이 생성된다
    Given Supabase Storage에 접근할 수 있다
    When book-covers 버킷을 생성한다
    Then 버킷이 public 읽기 권한을 갖는다
    And 인증된 사용자만 쓸 수 있다
    And 책 표지 이미지가 URL로 접근 가능하다

  Scenario: avatars 버킷이 소유자 정책을 갖는다
    Given avatars 버킷을 생성한다
    When 사용자가 자신의 아바타를 업로드한다
    Then 업로드가 성공한다
    And 다른 사용자의 아바타 폴더에는 쓸 수 없다
    And 공개 읽기로 아바타 이미지를 조회할 수 있다
```

### AC-DEPLOY-022: Edge Function 배포

```gherkin
Feature: Edge Function 환경별 배포
  REQ-DEPLOY-022 (Event-Driven) — 위임 항목 (3개 도메인 SPEC)

  Scenario: kakao-book-search 함수가 배포된다
    Given SPEC-BOOK-001의 kakao-book-search 함수 코드가 완성된다
    When "supabase functions deploy kakao-book-search"를 실행한다
    Then 함수가 각 환경(dev/staging/prod) Supabase 프로젝트에 배포된다
    And POST /functions/kakao-book-search 엔드포인트가 응답한다

  Scenario: process-join-request 함수가 배포된다
    Given SPEC-CLUB-001의 process-join-request 함수가 완성된다
    When 배포를 실행한다
    Then 함수가 각 환경에 배포된다
    And POST /functions/process-join-request가 응답한다

  Scenario: send-notification 함수가 배포된다
    Given SPEC-NOTIF-001의 send-notification 함수가 완성된다
    When 배포를 실행한다
    Then 함수가 각 환경에 배포된다
    And POST /functions/send-notification이 푸시 알림을 발송한다
```

### AC-DEPLOY-023: Supabase 프로젝트 프로비저닝

```gherkin
Feature: 환경별 Supabase 프로젝트 프로비저닝
  REQ-DEPLOY-023 (Ubiquitous) — 위임 항목 (SPEC-API-001)

  Scenario: 세 환경에 별도 Supabase 프로젝트가 존재한다
    Given Supabase 조직 계정이 있다
    When dev, staging, prod 세 프로젝트를 생성한다
    Then 각 프로젝트에 고유 참조 URL과 anon key가 발급된다
    And .env.development, .env.staging, .env.production에 각각 주입된다

  Scenario: SPEC-DB-001 migration이 각 프로젝트에 배포된다
    Given SPEC-DB-001의 15개 migration 파일이 있다
    When "supabase db push"를 각 프로젝트에 실행한다
    Then 12개 엔터티 테이블이 각 프로젝트에 생성된다
    And 21개 RLS 정책이 각 프로젝트에 적용된다
    And 트리거가 활성화된다
```

### AC-DEPLOY-024: 배포 매뉴얼 및 환경 변수 문서

```gherkin
Feature: 배포 문서화
  REQ-DEPLOY-024 (Ubiquitous)

  Scenario: docs/deployment.md가 존재한다
    Given 배포 매뉴얼이 작성된다
    When docs/deployment.md를 확인한다
    Then 빌드 절차, 배포 절차, OAuth 콘솔 설정, Storage 버킷 설정이 단계별로 문서화되어 있다
    And 각 단계는 재현 가능하다

  Scenario: .env.example이 모든 키를 포함한다
    Given .env.example 파일이 있다
    When 내용을 확인한다
    Then 모든 필수 환경 변수 키가 포함되어 있다
    And 실제 값은 포함되지 않는다
    And 각 키에 설명 주석이 있다
```

---

## 6. 통합 시나리오 (End-to-End)

### AC-DEPLOY-E2E-001: 최초 프로덕션 릴리즈 전체 플로우

```gherkin
Feature: 첫 프로덕션 릴리즈 통합 시나리오

  Scenario: 코드 머지부터 스토어 등록까지 전체 파이프라인
    Given 모든 13개 도메인 SPEC이 구현 완료된다
    And develop 브랜치에서 release/v1.0.0 브랜치를 생성한다
    When release/v1.0.0이 main에 머지된다
    Then deploy.yml이 v1.0.0 태그를 main에 생성한다
    And EAS Build production(iOS+Android)이 실행된다
    And Sentry v1.0.0 릴리즈가 생성된다
    And EAS Submit이 TestFlight와 Play Console에 업로드한다
    And GitHub Release v1.0.0이 생성된다

  Scenario: 프로덕션 앱이 정상 동작한다
    Given 첫 프로덕션 빌드가 TestFlight에서 설치된다
    When 카카오 로그인을 시도한다
    Then OAuth 로그인이 성공한다 (REQ-DEPLOY-019, 020)
    And 온보딩 프로필 설정이 가능하다
    And 책 검색(kakao-book-search)이 동작한다 (REQ-DEPLOY-022)
    And 에러 발생 시 Sentry에 environment=production으로 기록된다 (REQ-DEPLOY-015)
```

### AC-DEPLOY-E2E-002: 핫픽스 전체 플로우

```gherkin
Feature: 핫픽스 파이프라인

  Scenario: 프로덕션 크래시 핫픽스
    Given 프로덕션에서 크래스가 발생하여 Sentry에 보고된다
    When main에서 hotfix/fix-crash 브랜치를 생성한다
    And 수정 후 main에 머지한다
    Then deploy.yml이 v1.0.1 태그를 생성한다
    And develop에도 동일한 변경이 머지되었는지 검증한다 (REQ-DEPLOY-011)
    And 패치 빌드가 양 스토어에 제출된다
```

---

## 7. 품질 게이트 (Quality Gates)

### 7.1 TRUST 5 검증

| 항목        | 기준                                                                  | 검증 방법                          |
| ----------- | --------------------------------------------------------------------- | ----------------------------------- |
| Tested      | CI 통과, 커버리지 80%+ (인프라 설정은 매뉴얼 검증 포함)               | GitHub Actions 로그                 |
| Readable    | 워크플로우 YAML, eas.json, 배포 매뉴얼이 명확한 주석 포함             | 코드 리뷰                          |
| Unified     | ESLint/Prettier/TypeScript 일관성 (워크플로우 YAML은 yamllint)        | CI lint 잡                          |
| Secured     | 크리덴셜 미커밋, 환경 변수 분리, fail-fast 검증                       | AC-DEPLOY-008, 017, 018            |
| Trackable   | 모든 배포에 vX.Y.Z 태그, 컨벤셔널 커밋, CHANGELOG                      | git log, GitHub Releases            |

### 7.2 Definition of Done (DoD)

본 SPEC의 인수가 완료되려면 다음이 모두 충족되어야 한다:

- [ ] 24개 REQ에 대한 인수 기준(AC-DEPLOY-001 ~ AC-DEPLOY-024) 모두 통과
- [ ] 통합 시나리오(AC-DEPLOY-E2E-001, 002) 통과
- [ ] 첫 프로덕션 릴리즈(v1.0.0)가 App Store와 Google Play 모두에 심사 제출 완료
- [ ] 세 환경(dev/staging/prod) Supabase 프로젝트 프로비저닝 완료
- [ ] 세 OAuth 제공자(카카오/애플/구글) 활성화 및 로그인 검증 완료
- [ ] Storage 버킷(book-covers, avatars) 생성 및 RLS 정책 적용 완료
- [ ] Edge Function 3종(kakao-book-search, process-join-request, send-notification) 각 환경 배포 완료
- [ ] Sentry 프로덕션 통합 검증 완료(에러 추적, 소스맵, 릴리즈 트래킹)
- [ ] `.env.example`, `docs/deployment.md` 작성 완료
- [ ] TRUST 5 품질 게이트 5/5 통과

---

## 8. 검증 방법 및 도구

| 검증 항목              | 도구/방법                                      | 자동화 여부 |
| ---------------------- | ---------------------------------------------- | ----------- |
| CI 품질 게이트         | GitHub Actions (ESLint, tsc, Jest)             | 자동        |
| 빌드 성공              | EAS Build 대시보드                             | 자동        |
| 스토어 제출            | App Store Connect, Google Play Console         | 반자동      |
| Sentry 에러 추적       | Sentry 대시보드                                | 자동        |
| OAuth 로그인           | 수동 테스트(각 제공자) + E2E 자동화            | 반자동      |
| Storage 버킷 정책      | Supabase Dashboard + SQL 검증                  | 수동        |
| 환경 변수 보안         | pre-commit secret scan + git log 검색          | 자동        |
| hotfix 듀얼 머지       | deploy.yml 자동 검증                           | 자동        |

---

버전: 1.0.0
분류: 인수 기준 (Acceptance Criteria)
상태: draft (사용자 승인 대기)
