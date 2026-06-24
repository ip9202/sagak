# 배포 가이드 (SPEC-DEPLOY-001)

본 문서는 sagak 앱의 빌드/배포 및 OAuth 콘솔 등록 수동 절차를 다룬다.
자동화 가능한 부분은 `eas.json` / `app.config.ts` 의 `validateEnv` 로 위임하고,
OAuth provider 콘솔 등록과 Supabase Auth 설정은 사람이 직접 수행해야 한다.

---

## 1. OAuth 콘솔 등록 (수동)

sagak 은 Kakao / Naver / Google OAuth 를 Supabase Auth provider 로 연동한다.
클라이언트는 OAuth redirect callback URI 만 알면 되며, 이 값은 코드에 고정되어 있다.

### 앱 딥링크 (Supabase redirectTo 전용, 변경 금지)

```
sagak://auth/callback
```

> 출처: `src/auth/oauth.ts` 의 `getOAuthRedirectUri()` →
> `Linking.createURL('/auth/callback')` + `app.json` 의 `"scheme": "sagak"`.
> 이 값은 AUTH 도메인이 소유하며 본 가이드는 문서화만 한다.

> ⚠️ **이 딥링크는 Supabase `signInWithOAuth` 의 `redirectTo` 옵션에만 사용됩니다 —
> Kakao/Naver/Google provider 콘솔에 등록하지 마세요.** Provider 콘솔은 https 스킴만
> 허용하므로 `sagak://` 같은 커스텀 스킴을 "유효하지 않은 URL"로 거부합니다.
> Provider 콘솔에는 아래 각 provider 절의 **Supabase 서버 callback**(
> `https://<your-project-ref>.supabase.co/auth/v1/callback`)을 등록합니다.

#### OAuth 2-단계 리다이렉션 흐름

1. 앱: `signInWithOAuth({ provider, redirectTo: sagak://auth/callback })` 호출 (`AuthContext.tsx`)
2. Supabase → provider 인증 페이지로 이동
3. provider 인증 완료 → **Supabase 서버 callback**으로 복귀 (provider 콘솔에 등록된 https callback)
4. Supabase → `redirectTo`(`sagak://auth/callback`)로 앱 딥링크
5. 앱: 딥링크 수신 → `onAuthStateChange` SIGNED_IN → 세션 획득

### 보안 주의사항 (AC-DEPLOY-019, CWE-601)

- Redirect URI 는 **정확히 일치(exact-match)** 하는 값만 등록한다.
- 와일드카드(`*`)나 패턴 매칭은 절대 사용하지 않는다 (Open Redirect 위험).
- 위 원칙은 클라이언트 deep-link(`sagak://auth/callback`)뿐 아니라 2절의
  Supabase server callback(`https://<project-ref>.supabase.co/auth/v1/callback`)에도
  동일하게 적용된다 — trailing slash(`.../callback/`)나 경로 와일드카드 없이 verbatim 으로 등록한다.

### Kakao Developers

1. https://developers.kakao.com 접속 → 내 애플리케이션 → 앱 추가
2. **플랫폼 > Android / iOS** 등록
   - Android: 패키지명 `com.sagak.app` (`app.json` 참조), 키해시 추가
   - iOS: Bundle ID `com.sagak.app`
3. **제품 설정 > 카카오 로그인 > Redirect URI** 에 다음 등록 (https 스킴만 허용, 커스텀 스킴 거부):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   > `<your-project-ref>`는 Supabase Dashboard > Project Settings > Reference ID.
4. **요약 정보** 에서 REST API 키(client_id) 확인 → Supabase 에 등록(아래 2절)

### Naver Developers

> 참고 (AC-DEPLOY-020): 2026년 6월 기준, Supabase 가 Naver 를 네이티브 provider
> 로 지원하지 않으므로 **Custom OIDC** 방식으로 연동한다.

1. https://developers.naver.com 접속 → Application > 애플리케이션 등록
2. **사용 API** 에 "네이버 로그인" 선택
3. **로그인 오픈 API 서비스 환경** - Android/iOS 앱 등록
   - 패키지명 / Bundle ID = `com.sagak.app`
4. **Callback URL** 에 다음 등록 (https 스킴만 허용, 커스텀 스킴 거부):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
5. Client ID / Client Secret 확보 → Supabase Custom OIDC 설정에 사용(아래 2절)

### Google Cloud Console

1. https://console.cloud.google.com 접속 → 프로젝트 생성/선택
2. **API 및 서비스 > 사용자 인증 정보 > 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**
3. 애플리케이션 유형: **Web application** (Android/iOS 유형이 아님 — Supabase 가 서버 사이드에서 Google 과 통신)
4. **승인된 리디렉션 URI**에 다음 등록 (https 스킴만 허용, 커스텀 스킴 거부):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
5. Client ID / Client Secret 확보 → Supabase Google provider 설정에 사용(아래 2절)

> 참고: Supabase Auth 의 Google 연동은 **Web application** OAuth 클라이언트 하나면 충분합니다.
> React Native 네이티브 Google Sign-In SDK(`@react-native-google-signin`)는 본 아키텍처에서 사용하지 않습니다 —
> Supabase `signInWithOAuth({ provider: 'google' })` 경로가 표준입니다.

---

## 2. Supabase Auth 제공자 활성화 (수동)

OAuth provider 설정은 **서버 사이드** 이므로 클라이언트 코드/`.env` 가 아닌
**Supabase Dashboard** 에서 등록한다.

### Kakao (네이티브 provider)

1. Supabase Dashboard > **Authentication > Providers > Kakao** 활성화
2. Kakao REST API 키 → **Client ID**
3. Kakao Client Secret → **Secret**
4. Supabase 가 표시하는 **Callback URL**(`https://<project-ref>.supabase.co/auth/v1/callback`)이
   1절 Kakao 3번에서 provider 콘솔에 등록한 값과 일치하는지 확인한다 (provider 콘솔 등록은 1절에서 완료).

### Google (네이티브 provider)

1. Supabase Dashboard > **Authentication > Providers > Google** 활성화
2. Google OAuth Client ID → **Client ID**
3. Google OAuth Client Secret → **Secret**
4. Supabase 가 표시하는 **Callback URL**(`https://<project-ref>.supabase.co/auth/v1/callback`)이
   1절 Google 4번에서 provider 콘솔에 등록한 값과 일치하는지 확인한다 (provider 콘솔 등록은 1절에서 완료).

### Naver (Custom OIDC, AC-DEPLOY-020)

> 2026년 6월 기준 Naver 는 Supabase 네이티브 provider 가 아니므로 Custom OIDC 로 연동한다.

1. Supabase Dashboard > **Authentication > Providers > Custom OIDC**(또는 Third-party Auth) 설정
2. Naver Client ID / Client Secret 입력
3. **Callback URL**(`https://<project-ref>.supabase.co/auth/v1/callback`)이
   1절 Naver 4번에서 provider 콘솔에 등록한 값과 일치하는지 확인한다 (provider 콘솔 등록은 1절에서 완료).

---

## 3. `.env` 주입 가이드

### 클라이언트 번들에 들어가는 키 (`EXPO_PUBLIC_*`)

이 키들은 빌드 시점에 인라인되므로 **안전한 값만** 사용한다 (anon key 등).

| 파일 | 용도 | ENV 값 |
|------|------|--------|
| `.env` (gitignored, 로컬) | 로컬 개발 | `development` |
| `.env.staging` (커밋됨, placeholder) | preview 빌드 | `staging` |
| `.env.production` (커밋됨, placeholder) | store 빌드 | `production` |

포함 키: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`, `ENV`

> `.env.staging` / `.env.production` 은 placeholder 전용이며 커밋된다 (`.gitignore` 예외).
> **실제 값** 은 로컬 `.env`(gitignored) 또는 CI/EAS secret 으로 주입한다.

### 서버 사이드 Secret (절대 클라이언트 .env 금지)

| Secret | 저장 위치 |
|--------|-----------|
| Supabase `service_role` 키 | Edge Functions 환경변수 (Supabase) |
| Kakao / Naver / Google OAuth client_secret | Supabase Dashboard > Authentication > Providers |

> OAuth client secret 을 `EXPO_PUBLIC_*` 접두사로 클라이언트에 넣으면 RLS 우회 및
> 토큰 탈취 위험이 있다. 절대 금지 (DoD #11).

---

## 4. 빌드 명령 참조 (REQ-DEPLOY-002)

> 본 절은 명령을 **문서화** 한다. 실제 빌드 실행은 본 SPEC 범위 밖이다.

```bash
# production 빌드 (iOS + Android)
eas build --profile production --platform all

# preview (internal distribution) 빌드
eas build --profile preview --platform all

# development (개발 클라이언트) 빌드
eas build --profile development --platform all
```

빌드 시 `app.config.ts` 의 `validateEnv(process.env, ENV)` 가 호출된다.
`ENV=production` 일 때 `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN` 중 하나라도 비어 있으면
`MissingEnvError` 로 빌드가 중단된다 (REQ-DEPLOY-003 fail-fast).

---

## 5. Storage 버킷 참조 (AC-DEPLOY-021)

다음 버킷은 Supabase Dashboard 에서 수동 생성한다 (본 가이드는 참조만).

| 버킷명 | 공개 여부 | 정책 |
|--------|-----------|------|
| `book-covers` | public read | 누구나 읽기 가능, 업로드는 인증 사용자 |
| `avatars` | private | owner 정책 (본인 파일만 R/W) |

---

## 6. Sentry 크리덴셜 프로비저닝 (수동)

sagak 은 Sentry 를 통해 프로덕션 크래시 모니터링 및 sourcemap 디버깅을 수행한다.
GitHub Actions CI 에서 sourcemap 을 Sentry 로 업로드하며, 런타임에서는 `@sentry/react-native` SDK 가 이벤트를 전송한다.

### 프로비저닝 개요

다음 3가지 자격증명이 필요하다:

| 크리덴셜 | 용도 | 저장 위치 |
|---------|------|-----------|
| `SENTRY_AUTH_TOKEN` | sourcemap 업로드 API 인증 | GitHub Secrets |
| `SENTRY_ORG` | 조직 식별(slug) | GitHub Secrets |
| `SENTRY_STAGING_PROJECT` | staging 프로젝트 식별(slug) | GitHub Secrets |
| `EXPO_PUBLIC_SENTRY_DSN` | 런타임 SDK 전송용 DSN | `.env.staging` (staging) / `.env.production` (production) |

> **보안 주의사항**: Auth Token 및 실제 DSN 은 절대 repo 에 커밋하지 않는다.
> `.env.staging` / `.env.production` 은 placeholder(빈 문자열) 상태로 커밋되며,
> 실제 값은 로컬(`.env`, gitignored) 또는 GitHub Secrets / EAS secrets 로만 주입한다.
> 프로젝트의 secret 보호 컨벤션은 `src/lib/__tests__/credential-hygiene.test.ts` 를 참조한다.

### 6.1 Sentry 계정/조직/프로젝트 생성

1. **계정 생성**: https://sentry.io/signup/ 에서 회원가입 (계정이 없는 경우)
2. **조직 확인/생성**: Sentry dashboard 에서 조직 slug 기억 (예: `my-org-slug`) — 이 값이 `SENTRY_ORG`
3. **프로젝트 생성**:
   - **Projects > Create Project** 클릭
   - Platform 선택: **React Native**
   - 프로젝트 이름 입력 (예: `sagak-staging`, `sagak-production`)
   - **staging 환경용 프로젝트 1개를 먼저 생성** (production 은 별도 프로젝트 권장)

> **참고**: Sentry UI는 변경될 수 있으므로, 정확한 메뉴 경로는 [Sentry React Native 문서](https://docs.sentry.io/platforms/react-native/) 를 참조한다.

### 6.2 DSN 확보 (Client Key)

DSN(Data Source Name)은 런타임 SDK 가 이벤트를 Sentry 로 전송할 때 사용하는 엔드포인트 식별자다.

1. 생성한 프로젝트 dashboard 로 이동
2. **Settings > Client Keys** (또는 **Project Settings > Client Keys**)
   - UI 가 변경될 수 있으므로 정확한 경로는 [공식 문서](https://docs.sentry.io/product/sentry-basics/integrate-frontend/create-new-project/) 를 확인
3. DSN 값 복사 (예: `https://examplePublicKey@o0.ingest.sentry.io/123456`)
   - 이 값이 `EXPO_PUBLIC_SENTRY_DSN`

> **DSN 보안 노트**: DSN 자체는 client 노출이 허용되는 public 성격이지만,
> 환경별 분리(staging vs production)를 명확히 하고 실수로 production DSN을 staging 에 노출하는 것을 방지하기 위해
> `.env` 파일만으로 관리하고 repo 에는 빈 값으로 커밋하는 것을 권장한다.

### 6.3 Auth Token 생성 (sourcemap 업로드용)

GitHub Actions `upload-sentry-sourcemaps` job이 sourcemap을 Sentry 로 업로드하려면 Auth Token 이 필요하다.

> **CI 환경 권장 — Organization Token**: Sentry 공식 문서에 따르면 CI 환경에서는 **Organization Token**을 권장한다(권한이 미리 설정되어 최소 권한 원칙에 부합).

1. Sentry dashboard 우측 상단 **User Menu > Settings**
2. **Auth Tokens** (또는 **User Settings > Auth Tokens**) 메뉴
3. **Create New Token** 클릭
4. **Token type / scopes**:
   - **Organization Token**(권장): CI / sourcemap 업로드용으로 사전 설정된 권한 세트 사용
   - **Internal Integration**(custom scope 필요 시): `project:releases`(release 생성·sourcemap 업로드) + `org:read`(조직 정보). `project:write` 는 sourcemap 업로드에 통상 불필요하므로 최소 권한을 위해 제외한다.
   > **정확한 scope/type 명칭은 Sentry 버전에 따라 변경될 수 있으므로 [Auth Tokens 공식 문서](https://docs.sentry.io/account/auth-tokens/) 와 [CLI sourcemap 업로드 문서](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/cli/) 를 확인한다.
5. Token 생성 후 **값 복사** (재조회 불가 — 즉시 안전한 곳에 저장)

> **주의**: Auth Token 은 절대 repo 에 커밋하지 않는다. GitHub Secrets 에만 저장한다.

### 6.4 GitHub Secrets 등록

repo 설정에서 3개의 Secret 을 등록한다. 정확한 키명은 `.github/workflows/deploy.yml` 이 참조하므로 오타 없이 입력한다.

| GitHub Secret 키명 | 값 | 출처 |
|-------------------|-------|------|
| `SENTRY_AUTH_TOKEN` | 6.3절에서 생성한 Auth Token 값 | Sentry Auth Tokens 페이지 |
| `SENTRY_ORG` | 조직 slug (예: `my-org-slug`) | Sentry dashboard URL 또는 Settings |
| `SENTRY_STAGING_PROJECT` | staging 프로젝트 slug (예: `sagak-staging`) | Sentry dashboard 프로젝트 slug |

**등록 방법**:

**방법 A — GitHub UI**:
1. repo **Settings > Secrets and variables > Actions**
2. **New repository secret** 클릭
3. 위 3개를 각각 등록 (Name, Value 정확히 입력)

**방법 B — `gh` CLI**:
```bash
gh secret set SENTRY_AUTH_TOKEN
# 프롬프트에 Auth Token 값 입력

gh secret set SENTRY_ORG
# 프롬프트에 조직 slug 입력

gh secret set SENTRY_STAGING_PROJECT
# 프롬프트에 staging 프로젝트 slug 입력
```

> **배포.yml 매핑 참고**: `.github/workflows/deploy.yml` 의 `upload-sentry-sourcemaps` job은
> `SENTRY_STAGING_PROJECT` 키를 읽어 프로젝트 slug를 결정한다 (구현은 이미 완료된 상태).

### 6.5 `.env` DSN 설정 (placeholder 커밋 규칙)

> **보안 — 반드시 준수**: `.env.staging` / `.env.production` 은 `.gitignore` 예외로 **커밋된다**.
> 따라서 `EXPO_PUBLIC_SENTRY_DSN` 은 **항상 빈 문자열로 커밋**하고, 실제 DSN 값은 로컬 `.env`(gitignored)
> 또는 EAS 빌드 시점 secret 으로만 주입한다. `.env.staging`/`.env.production` 에 실제 DSN 을 쓰면 secret 이 repo 에 노출된다.

커밋되는 `.env.*` 파일의 DSN 은 빈 값으로 유지한다:

```bash
# .env.staging (커밋됨 — 반드시 빈 값 유지)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_SENTRY_DSN=
ENV=staging
```

```bash
# .env.production (커밋됨 — 반드시 빈 값 유지)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_SENTRY_DSN=
ENV=production
```

**실제 DSN 주입 경로** (커밋되지 않는 곳):
- **로컬 개발**: `.env`(gitignored)에 `EXPO_PUBLIC_SENTRY_DSN=<실제 DSN>` 작성
- **EAS 빌드**: `eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value <DSN>` — 빌드 시점 주입

### 6.6 검증

**CI sourcemap 업로드 검증**:
1. `develop` 브랜치에 push (→ staging 배포)
2. GitHub Actions **upload-sentry-sourcemaps** job 확인
3. "SENTRY_AUTH_TOKEN is empty, skipping sourcemap upload" 메시지가 **없고** job이 성공하면 성공
4. Sentry dashboard > **Releases** 에 sourcemap 이 연동된 release 가 생성되었는지 확인

**런타임 이벤트 수신 검증**:
1. 실기기/시뮬레이터에서 staging 빌드 앱 실행
2. 의도적으로 크래시 발생 (예: `throw new Error('Test crash')`)
3. Sentry dashboard > **Issues** 에 이벤트가 수신되는지 확인

### 6.7 OUT OF SCOPE

다음 항목은 본 가이드 범위 밖이다:

- **production sourcemap 업로드 job**: `.github/workflows/deploy.yml` 에 현재 staging 환경만 구현됨.
  production 프로젝트용 job은 SPEC-DEPLOY-001 §6 #4 해결 시 추가 예정.
- **Expo config plugin 등록**: `@sentry/react-native` 패키지의 expo config plugin 은
  PR #56 merge 시 이미 활성화됨 (NO-OP 옵션 제외 완료).
  본 가이드는 크리덴셜 확보만 다루며 plugin 설정은 코드에 이미 반환됨.
- **self-hosted Sentry**: on-prem Sentry 설치는 다루지 않는다.

### 6.8 문제 해결 참조

- [Sentry CLI Configuration](https://docs.sentry.io/cli/configuration/) — `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` 환경변수 설정
- [Sentry React Native Setup](https://docs.sentry.io/platforms/react-native/) — 프로젝트 생성 및 DSN 확인
- [Sentry Auth Tokens](https://docs.sentry.io/account/auth-tokens/) — Auth Token scope 및 생성

---

## 7. Edge Function 배포 (수동)

sagak 은 Supabase Edge Function 5종을 배포하여 OAuth 연동, 북클럽 가입 처리, 알림 발송 등 서버 사이드 로직을 수행한다. `scripts/deploy-edge-functions.sh` 스크립트가 함수 목록(SSOT: `supabase/functions/registry.json`)을 읽어 자동 배포한다.

### 프로비저닝 개요

다음 4가지 자격증명이 필요하다:

| 크리덴셜 | 용도 | 저장 위치 |
|---------|------|-----------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI 인증 (배포 API) | 로컬 `.env`(gitignored) 또는 GitHub Secrets |
| `SUPABASE_DEV_PROJECT_REF` | development 프로젝트 식별 | 로컬 `.env` 또는 GitHub Secrets |
| `SUPABASE_STAGING_PROJECT_REF` | staging 프로젝트 식별 | GitHub Secrets |
| `SUPABASE_PROD_PROJECT_REF` | production 프로젝트 식별 | GitHub Secrets |

> **보안 주의사항**: `SUPABASE_ACCESS_TOKEN` 및 실제 PROJECT_REF 값은 절대 repo 에 커밋하지 않는다.
> `.env.example` 은 빈 값(placeholder) 상태로 커밋되며, 실제 값은 로컬(`.env`, gitignored) 또는 GitHub Secrets 로만 주입한다.

### 7.1 Supabase 프로젝트 ref 확보

3개 환경(development/staging/production) 각각의 Supabase 프로젝트에서 Reference ID 를 확보한다.

1. Supabase Dashboard > **Project Settings > API** 로 이동
2. **Reference ID** 값 복사 (또는 Project URL `https://<ref>.supabase.co` 에서 `<ref>` 부분 추출)
3. 각 환경별 ref 가 `SUPABASE_DEV_PROJECT_REF`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_PROD_PROJECT_REF`

> **참고**: development 환경은 로컬 개발용이므로 ref 가 이미 있는 경우 `.env` 에만 설정한다.

### 7.2 ACCESS_TOKEN 생성

Supabase CLI 가 배포 API 를 호출하려면 Access Token 이 필요하다.

1. Supabase Dashboard > **Account Settings > Access Tokens** (https://supabase.com/dashboard/account/tokens) 로 이동
2. **Generate new token** 클릭
3. Token 형식: `sbp_0102...1920` (Supabase Access Token 접두사 `sbp_` + 32자 hex)
   - CLI 가 이 형식을 검증하므로 반드시 Supabase Dashboard 에서 생성해야 한다
   - 생성 시점에만 표시되므로 즉시 안전한 곳(패스워드 관리자 등)에 복사
4. 이 값이 `SUPABASE_ACCESS_TOKEN`

> **주의**: Access Token 은 절대 repo 에 커밋하지 않는다. 로컬 `.env`(gitignored) 또는 GitHub Secrets 에만 저장한다.

### 7.3 크리덴셜 주입 (로컬 / GitHub Secrets)

두 경로 중 하나를 선택한다.

**로컬 배포 경로** (development 환경):
- `.env`(gitignored)에 4개 변수 설정:
  ```bash
  SUPABASE_ACCESS_TOKEN=sbp_0102...1920
  SUPABASE_DEV_PROJECT_REF=abc123xyz
  SUPABASE_STAGING_PROJECT_REF=def456uvw
  SUPABASE_PROD_PROJECT_REF=ghi789rst
  ```
- `.env.example` 은 이미 빈 placeholder 로 커밋되어 있으므로 참고용
- `.env` 는 절대 커밋하지 않는다 (`.gitignore` 에 포함됨)

**CI 배포 경로** (staging/production 환경, GitHub Actions):
```bash
gh secret set SUPABASE_ACCESS_TOKEN
# 프롬프트에 Access Token 값 입력

gh secret set SUPABASE_DEV_PROJECT_REF
# 프롬프트에 development ref 입력

gh secret set SUPABASE_STAGING_PROJECT_REF
# 프롬프트에 staging ref 입력

gh secret set SUPABASE_PROD_PROJECT_REF
# 프롬프트에 production ref 입력
```

> **GitHub UI 대안**: repo **Settings > Secrets and variables > Actions** > **New repository secret** 에서 4개를 각각 등록

### 7.4 배포 실행

**development 환경 배포**:
```bash
ENV=development bash scripts/deploy-edge-functions.sh
```

**staging 환경 배포**:
```bash
ENV=staging bash scripts/deploy-edge-functions.sh
```

**production 환경 배포**:
```bash
ENV=production bash scripts/deploy-edge-functions.sh
```

**스크립트 동작**:
1. `ENV` 환경변수를 읽어 `SUPABASE_<ENV>_PROJECT_REF` 값을 결정 (fail-fast: 미설정/잘못된 값 시 exit 1)
2. `SUPABASE_ACCESS_TOKEN` 은 스크립트가 직접 읽거나 검증하지 않는다. `supabase functions deploy` CLI 가 런타임에 환경변수에서 인증하며, 형식 오류 시 CLI 단에서 `Invalid access token format` 에러를 낸다 (스크립트 exit 1 아님)
3. `supabase/functions/registry.json`(SSOT)에서 5개 함수명 읽기:
   - `kakao-book-search` (카카오 책 검색 위임, SPEC-BOOK-001)
   - `process-join-request` (북클럽 가입 처리, SPEC-CLUB-001)
   - `send-notification` (알림 발송, SPEC-NOTIF-001)
   - `naver-userinfo-proxy` (네이버 사용자 정보 프록시, SPEC-DEPLOY-001 REQ-DEPLOY-019 Naver OIDC)
   - `naver-discovery` (네이버 OIDC discovery 보조, SPEC-DEPLOY-001)
4. 각 함수에 대해 `supabase functions deploy <name> --project-ref <ref>` 실행
5. 배포 완료 메시지 출력: `==> Edge Function deploy complete (<env>)`

**CLI 설치** (이미 설치된 경우 생략):
```bash
brew install supabase/tap/supabase
```
> 현재 검증된 버전: v2.104.0

**참고**: `supabase link` 없이도 `--project-ref` + `SUPABASE_ACCESS_TOKEN`으로 원격 배포가 가능하다 (CLI 표준 동작). `supabase/config.toml`의 `project_id = "sagak"` 은 placeholder 이며 배포에 영향을 주지 않는다.

### 7.5 검증

**Dashboard 확인**:
1. Supabase Dashboard > **Edge Functions** 페이지로 이동
2. 5개 함수가 모두 배포되었는지 확인:
   - `kakao-book-search`
   - `process-join-request`
   - `send-notification`
   - `naver-userinfo-proxy`
   - `naver-discovery`

**런타임 동작 검증** (staging/production):

> 아래 예시는 배포 자체의 스모크 테스트용이다. 실제 요청 스키마·검증 규칙·인증 요구사항은 각 함수 구현(`supabase/functions/<name>/`, SPEC-CLUB-001 / SPEC-NOTIF-001) 을 참조한다. 인증된 사용자 세션(JWT) 이 필요한 함수도 있다.

1. `process-join-request` 호출 (`verify_jwt=true` 기본, JWT `sub` 가 `requester_id` 와 일치해야 함):
   ```bash
   curl -X POST https://<ref>.supabase.co/functions/v2/process-join-request \
     -H "Authorization: Bearer <user-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"requester_id": "<uuid>", "target_user_id": "<uuid>"}'
   ```
2. `send-notification` 호출 (body: `user_id` uuid + `type` ENUM 6종 + 선택 `ref_id`/`data`):
   ```bash
   curl -X POST https://<ref>.supabase.co/functions/v2/send-notification \
     -H "Authorization: Bearer <user-jwt>" \
     -H "Content-Type: application/json" \
     -d '{"user_id": "<uuid>", "type": "join_request", "ref_id": "<uuid>", "data": {}}'
   ```
3. 배포 로그 확인 (스크립트 표준 출력 형식):
   ```
   ==> Deploying 5 functions to development (project: <ref>)
       deploying kakao-book-search ...
       ...
   ==> Edge Function deploy complete (development)
   ```

### 7.6 OUT OF SCOPE

다음 항목은 본 가이드 범위 밖이다:

- **Edge Function 내부 로직 구현**: `kakao-book-search`, `process-join-request`, `send-notification`, `naver-userinfo-proxy`, `naver-discovery` 의 실제 코드는 각 SPEC(SPEC-BOOK-001, SPEC-CLUB-001, SPEC-NOTIF-001, SPEC-DEPLOY-001) 에서 다룬다. 본 절은 배포 인프라만 다룬다.
- **실제 크리덴셜 값**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_*_PROJECT_REF` 의 실제 값은 사용자가 Supabase Dashboard 에서 직접 확보해야 한다.
- **Supabase 프로젝트 생성**: 개발용/스테이징/프로덕션 프로젝트 생성은 Supabase Dashboard 에서 수동으로 수행한다.

### 7.7 문제 해결

| 증상 | 원인 | 해결 방법 |
|------|------|-----------|
| `mapfile: command not found` | 과거 이슈 (macOS bash 3.2 호환) | 현재 스크립트는 `while-read` 패턴으로 수정되어 해결됨. 최신 버전 사용 중인지 확인 |
| `Invalid access token format` | `SUPABASE_ACCESS_TOKEN`이 `sbp_...` 형식이 아님 | 7.2절에서 재발급. Supabase Dashboard 에서만 생성 가능 |
| `ERROR: SUPABASE_DEV_PROJECT_REF is not set` | `ENV=development` 이지만 `SUPABASE_DEV_PROJECT_REF` 미설정 | 7.3절 확인. 로컬 `.env` 또는 GitHub Secrets 에 ref 등록 |
| `ERROR: SUPABASE_STAGING_PROJECT_REF is not set` | `ENV=staging` 이지만 `SUPABASE_STAGING_PROJECT_REF` 미설정 | 7.3절 확인. GitHub Secrets 에 staging ref 등록 |
| `ERROR: SUPABASE_PROD_PROJECT_REF is not set` | `ENV=production` 이지만 `SUPABASE_PROD_PROJECT_REF` 미설정 | 7.3절 확인. GitHub Secrets 에 production ref 등록 |
| `supabase: command not found` | Supabase CLI 미설치 | `brew install supabase/tap/supabase` 실행 (v2.104.0 이상) |
| `Error deploying function: 401 Unauthorized` | `SUPABASE_ACCESS_TOKEN` 만료 또는 잘못됨 | 7.2절에서 재발급. Token 유효기간 확인 |
| `Error: Project not found` | PROJECT_REF 가 프로젝트와 일치하지 않음 | 7.1절에서 ref 재확인. Dashboard 의 Reference ID 와 정확히 일치해야 함 |

---

## 관련 코드

- `src/auth/oauth.ts` — OAuth redirect URI 소스 (`getOAuthRedirectUri()`)
- `app.config.ts` — build-time 환경변수 검증 호출 지점
- `src/config/env.ts` — `validateEnv`, `REQUIRED_PROD`, `MissingEnvError`
- `eas.json` — EAS build profile 정의
- `.github/workflows/deploy.yml` — CI sourcemap 업로드 job (이미 구현됨, `SENTRY_STAGING_PROJECT` 키 참조)
- `app/_layout.tsx` — 런타임 Sentry 초기화 호출 (`initSentry()`, REQ-DEPLOY-014)
