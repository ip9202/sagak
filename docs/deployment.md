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
3. 애플리케이션 유형: **Android** / **iOS** 각각 생성
   - 패키지명: `com.sagak.app`
   - SHA-1 인증서 지문: release/debug 빌드 인증서 지문 추가 (EAS build 후 획득)
4. **승인된 리디렉션 URI**(Web 클라이언트 항목)에 다음 등록 (https 스킴만 허용, 커스텀 스킴 거부):
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
5. Client ID / Client Secret 확보 → Supabase Google provider 설정에 사용(아래 2절)

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

## 관련 코드

- `src/auth/oauth.ts` — OAuth redirect URI 소스 (`getOAuthRedirectUri()`)
- `app.config.ts` — build-time 환경변수 검증 호출 지점
- `src/config/env.ts` — `validateEnv`, `REQUIRED_PROD`, `MissingEnvError`
- `eas.json` — EAS build profile 정의
