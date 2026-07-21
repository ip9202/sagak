---
# NOTE: 8-field frontmatter (SPEC-DB-001 형식 준수)
id: SPEC-API-001
title: "Supabase Client Integration & API Layer"
version: "1.0.0"
status: implemented
created: 2026-06-14
updated: 2026-06-15
author: "강력쇠주먹"
priority: high
issue_number: 3
labels: [infra, supabase, client, api, typescript, gen-types, environment]
---

# SPEC-API-001: Supabase 클라이언트 통합 및 API 레이어

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — Supabase 클라이언트 싱글톤, gen-types 타입 안전성, 공통 에러 처리, 환경 변수 관리 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (iOS/Android 모바일)
- **Supabase 클라이언트 라이브러리**: `@supabase/supabase-js` v2 (현재 `package.json`에 미설치 — 본 SPEC 구현 시 추가 필요)
- **백엔드**: Supabase (관리형 PostgreSQL + PostgREST + Realtime + Storage + Auth + Edge Functions)
- **인증**: Supabase Auth (JWT 세션, OAuth: 카카오/애플/구글 — 본 SPEC은 인증 헤더 주입 인프라만 제공, OAuth 로직은 SPEC-AUTH-001)
- **타입 시스템**: TypeScript strict 모드 (`tsconfig.json` strict:true, SPEC-UI-001 REQ-FE-002 준수)
- **타입 생성**: Supabase CLI `gen-types` (`supabase gen types typescript`) — `src/types/db.ts` 자동 생성
- **환경 변수 주입**: Expo Constants + `app.config.ts` (EAS Build 환경 분리 dev/staging/prod)
- **데이터 페칭 전략**: 미결정 (Open Question 6.1 — React Query vs SWR vs 순수 훅)

### 단일 출처 (Single Source of Truth)

본 SPEC의 API 서피스는 `.moai/project/structure.md` "API 서피스" 섹션을 단일 출처로 한다.
DB 엔터티 및 gen-types 타입 매핑은 `.moai/project/db/schema.md` (SPEC-DB-001 산출물)에 기반한다.
기술 스택 제약은 `.moai/project/tech.md`를 따른다.

### 의존성

- **SPEC-DB-001** (선행): 12개 엔터티 스키마 + 21개 RLS 정책 + 트리거 + 보안 뷰 완료 (v1.2.0)
- **SPEC-UI-001** (선행): 프론트엔드 파운데이션 — 디자인 토큰, ThemeProvider, 6개 컴포넌트 완료 (v1.0.0)
- **후속 SPEC**: SPEC-AUTH-001 (인증 플로우), SPEC-NAV-001 (라우팅), 모든 도메인 SPEC이 본 API 레이어 사용

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. Supabase 클라이언트는 앱 전역에서 단일 싱글톤 인스턴스로 유지된다. 다중 인스턴스 생성은
   세션 불일치와 메모리 낭비를 유발하므로 금지한다.
2. 클라이언트는 `anon_key`(또는 `SUPABASE_PUBLIC_KEY`)만 사용하며, `service_role` 키는
   절대 클라이언트 번들에 포함되지 않는다 (SPEC-DB-001 가정 2.2.2 준수 — service_role은
   Edge Functions 서버 측에서만 사용).
3. Supabase 세션(JWT)은 `@supabase/supabase-js` 내부 세션 관리자가 자동으로 AsyncStorage
   (또는 Expo SecureStore)에 영속화하고, 모든 PostgREST 요청에 `Authorization: Bearer
   <jwt>` 헤더를 자동 주입한다. 본 SPEC은 이 자동 주입 메커니즘에 의존한다.
4. `gen-types`로 생성된 `src/types/db.ts`는 수동 편집하지 않는다. 스키마 변경 시
   `supabase gen types` 재실행으로 재생성한다 (단일 진실 원칙).
5. RLS(Row-Level Security)가 모든 데이터 접근을 보호한다 (SPEC-DB-001 REQ-RLS). 클라이언트
   API 레이어는 RLS를 신뢰하며, 추가 클라이언트 측 권한 검사를 수행하지 않는다.

### 2.2 비즈니스 가정

1. 모든 API 엔드포인트(Auth/Books/Library/Records/Sessions/Clubs/Users/Edge Functions)는
   본 클라이언트 API 레이어를 통해 호출된다. 직접 `fetch()` 호출이나 하드코딩된 URL은 금지한다.
2. 환경 변수(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)는 빌드 시점에 `app.config.ts`를 통해
   주입되며, 런타임에 `expo-constants`로 읽는다. `.env` 파일은 `.gitignore`에 추가하고
   `.env.example`만 커밋한다.
3. 프로덕션 빌드에서 환경 변수가 누락된 경우, 앱은 명확한 에러 메시지와 함께 패닉(초기화
   거부)해야 한다. 잘못된 백엔드 연결은 조용한 실패보다 낫다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-API-CLIENT, REQ-API-TYPES, REQ-API-ERROR,
> REQ-API-ENV.

### REQ-API-CLIENT: Supabase 클라이언트 싱글톤 및 설정

**목적**: 앱 전역에서 재사용 가능한 단일 Supabase 클라이언트 인스턴스를 제공하고,
PostgREST/Realtime/Storage/Auth 모든 기능에 대한 통합 진입점을 정의한다.

#### REQ-API-001: 클라이언트 싱글톤 인스턴스

시스템은 **항상** `src/lib/supabase.ts`에 단일 Supabase 클라이언트 인스턴스(`supabase`)
를 싱글톤으로 유지해야 한다. 이 인스턴스는 `createClient()` 호출로 생성되며, 모듈
최상위에서 내보내져 앱 전역에서 동일 참조를 공유한다.

**WHEN** 앱의 어떤 모듈이 `supabase`를 임포트하면,
**THEN** 시스템은 항상 동일한 인스턴스 참조를 반환해야 한다 (모듈 캐싱 기반 싱글톤).

#### REQ-API-002: 클라이언트 설정 (세션 영속화, 자동 갱신)

시스템은 **항상** `createClient()` 호출 시 다음 설정을 적용해야 한다:
- `auth.persistSession: true` (세션 영속화 활성화)
- `auth.autoRefreshToken: true` (JWT 만료 전 자동 갱신)
- `auth.detectSessionInUrl: false` (모바일 환경 — URL 기반 세션 감지 비활성화)
- `auth.storage`: AsyncStorage 또는 Expo SecureStore 어댑터 (React Native 호환 저장소)

**WHILE** 클라이언트가 활성 세션을 가지고 있는 동안,
**THEN** 시스템은 모든 PostgREST/Realtime/Storage 요청에 현재 JWT를 `Authorization`
헤더로 자동 주입해야 한다 (`@supabase/supabase-js` 내부 세션 관리자가 처리).

#### REQ-API-003: Realtime 클라이언트 접근

시스템은 **항상** `supabase.channel()` API를 통해 Realtime 구독을 지원해야 한다.
이 채널 API는 `postgres_changes` 이벤트 구독(SPEC-FEED-001 피드 실시간 업데이트용)에
사용된다.

#### REQ-API-004: Edge Function 호출 래퍼

시스템은 **항상** `supabase.functions.invoke()`를 통해 Edge Function을 호출하는
공통 래퍼 함수(`invokeEdgeFunction`)를 제공해야 한다. 이 래퍼는 모든 Edge Function
호출(`kakao-book-search`, `process-join-request`, `generate-completion-report`,
`send-notification`)의 단일 진입점이다.

**WHEN** 클라이언트가 Edge Function을 호출하면,
**THEN** 시스템은 현재 세션 JWT를 `Authorization` 헤더로 자동 첨부해야 한다
(`supabase.functions.invoke()` 기본 동작).

#### REQ-API-005: 클라이언트 초기화 검증

**IF** `SUPABASE_URL` 또는 `SUPABASE_ANON_KEY` 환경 변수가 누락되거나 빈 문자열이면,
**THEN** 시스템은 클라이언트 초기화를 중단하고 명확한 에러 메시지
(`"Missing SUPABASE_URL or SUPABASE_ANON_KEY"`)를 발생시켜야 한다.
이 에러는 빌드/테스트 단계에서 조기 발견되도록 설계된 fail-fast 동작이다.

---

### REQ-API-TYPES: TypeScript gen-types 타입 안전성

**목적**: Supabase 데이터베이스 스키마를 TypeScript 타입으로 자동 생성하여, 모든
쿼리가 컴파일 시점에 타입 검증되도록 한다. 런타임 타입 불일치를 사전에 방지한다.

#### REQ-API-006: gen-types 자동 생성 파일 유지

시스템은 **항상** `src/types/db.ts` 파일을 Supabase CLI `gen-types` 명령으로
생성된 내용으로 유지해야 한다. 이 파일은 `Database` 인터페이스(스키마 전체 타입)를
내보내며, 수동 편집이 금지된다 (파일 상단에 `// This file is auto-generated. Do not edit.`
주석 포함).

**WHEN** SPEC-DB-001 스키마(migration)가 변경되면,
**THEN** 시스템은 `supabase gen types typescript --project-id <id> > src/types/db.ts`
재실행으로 타입을 재생성해야 한다.

#### REQ-API-007: 타입 안전 클라이언트 타이핑

시스템은 **항상** `src/lib/supabase.ts`의 `createClient<Database>()` 호출이
`src/types/db.ts`의 `Database` 타입을 제네릭으로 받도록 구성해야 한다.
이를 통해 `supabase.from('users')`, `supabase.from('emotion_records')` 등의
모든 테이블 접근이 컴파일 시점에 검증된다.

#### REQ-API-008: 엔터티별 도메인 타입 매핑

시스템은 **항상** `db/schema.md`에 정의된 12개 엔터티(users, books, user_books,
emotion_records, sticker_reactions, clubs, club_members, join_requests,
reading_sessions, completion_reports, point_logs, notifications)에 대해
gen-types `Database['public']['Tables']['{table}']['Row']` 타입을 도출하여
사용해야 한다.

예시 매핑 (구현 시 `src/types/db.ts`에서 도출):
- `User = Database['public']['Tables']['users']['Row']`
- `Book = Database['public']['Tables']['books']['Row']`
- `EmotionRecord = Database['public']['Tables']['emotion_records']['Row']`
- `Club = Database['public']['Tables']['clubs']['Row']`
- 나머지 8개 엔터티 동일 패턴

**WHILE** 개발자가 `supabase.from('{table}').select()` 쿼리를 작성하는 동안,
**THEN** 시스템은 반환 타입을 자동으로 `Database['public']['Tables']['{table}']['Row'][]`
로 추론해야 한다 (수동 타입 단언 불필요).

#### REQ-API-009: ENUM 타입 매핑 (sticker_type)

시스템은 **항상** `sticker_type` ENUM(empathy, touching, comforted)을 gen-types
생성 타입으로 노출해야 한다. 이 타입은 SPEC-UI-001 `StickerReaction` 컴포넌트 및
SPEC-EMOTION-001 스티커 반응 로직에서 사용된다.

#### REQ-API-010: 보안 뷰 타입 매핑

시스템은 **항상** `user_profiles` 및 `user_books_public` 보안 뷰(SPEC-DB-001
REQ-DB-013e)에 대한 타입을 gen-types에서 도출하여 제공해야 한다.
이는 Track A 독자 목록(SPEC-CLUB-001) 및 타인 공개 프로필 조회에 사용된다.

---

### REQ-API-ERROR: 공통 에러 처리 및 재시도

**목적**: Supabase API 호출에서 발생하는 에러를 일관되게 처리하고, 일시적 네트워크
장애에 대해 자동 재시도를 수행하며, 사용자 친화적 에러 메시지를 제공한다.

#### REQ-API-011: 에러 정규화 함수

시스템은 **항상** Supabase 에러 객체(`SupabaseError`, `{ message, code, details, hint }`)
를 앱 내부 에러 타입(`ApiError`)으로 변환하는 정규화 함수(`normalizeError`)를
제공해야 한다. 이 함수는 네트워크 에러, RLS 거부, 인증 만료, 서버 에러를 구분한다.

#### REQ-API-012: 에러 분류 체계

**WHEN** 에러 정규화 함수가 호출되면,
**THEN** 시스템은 에러를 다음 카테고리로 분류해야 한다:
- `NETWORK`: 네트워크 연결 실패, 타임아웃 (재시도 가능)
- `AUTH`: 세션 만료, 인증 토큰 무효 (재인증 필요 — SPEC-AUTH-001 연동)
- `RLS_DENIED`: RLS 정책에 의한 접근 거부 (사용자 권한 부족)
- `VALIDATION`: CHECK 제약 위반, UNIQUE 충돌, NOT NULL 위반
- `NOT_FOUND`: 행이 존재하지 않음
- `SERVER`: 5xx 서버 에러 (재시도 가능)
- `UNKNOWN`: 분류 불가

#### REQ-API-013: 재시도 로직 (지수 백오프)

**WHILE** 에러 카테고리가 `NETWORK` 또는 `SERVER`(재시도 가능)인 동안,
**THEN** 시스템은 최대 3회 지수 백오프(1s, 2s, 4s)로 자동 재시도를 수행해야 한다.

**IF** 에러 카테고리가 `AUTH`, `RLS_DENIED`, `VALIDATION`, `NOT_FOUND`이면,
**THEN** 시스템은 재시도하지 않고 즉시 에러를 반환해야 한다 (재시도 무의미).

#### REQ-API-014: 사용자 친화적 에러 메시지

시스템은 **항상** 기술적 에러 메시지를 한국어 사용자 친화적 메시지로 매핑하는
함수(`getUserFriendlyMessage`)를 제공해야 한다.
예: `RLS_DENIED` → "접근 권한이 없습니다", `NETWORK` → "네트워크 연결을 확인해 주세요",
`VALIDATION`(UNIQUE 충복) → "이미 등록된 항목입니다".

#### REQ-API-015: 에러 로깅 (Sentry 연동 준비)

**WHEN** 에러가 발생하면,
**THEN** 시스템은 `UNKNOWN` 카테고리 에러와 3회 재시도 후 실패한 에러를
구조화 로그로 기록해야 한다. tech.md에 명시된 Sentry 통합(SPEC-DEPLOY-001)을
위해 로그 형식은 Sentry `captureException` 호환 구조를 따른다.

---

### REQ-API-ENV: 환경 변수 관리 및 검증

**목적**: dev/staging/prod 환경 분리를 통해 개발 데이터와 프로덕션 데이터를 격리하고,
환경 변수 누락을 빌드 시점에 감지한다.

#### REQ-API-016: 환경 변수 파일 구조

시스템은 **항상** 다음 환경 변수 파일 구조를 유지해야 한다:
- `.env` (로컬 개발용, `.gitignore`에 추가 — 커밋 금지)
- `.env.example` (템플릿, 커밋 대상 — 실제 값 없이 키만 포함)
- `.env.staging` (staging 빌드용, EAS Build에서만 사용)
- `.env.production` (프로덕션 빌드용, EAS Build에서만 사용)

`.env.example`은 다음 키를 포함해야 한다:
- `EXPO_PUBLIC_SUPABASE_URL` (Supabase 프로젝트 URL)
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase anon/public key)
- `EXPO_PUBLIC_KAKAO_REST_API_KEY` (Kakao Book Search API — SPEC-BOOK-001에서 사용)
- `EXPO_PUBLIC_SENTRY_DSN` (Sentry DSN — SPEC-DEPLOY-001에서 사용)

> Expo SDK 55의 `EXPO_PUBLIC_` 접두사는 클라이언트 번들에 환경 변수를 주입하는
> 공식 메커니즘이다 (`process.env.EXPO_PUBLIC_*`로 접근).

#### REQ-API-017: app.config.ts 환경 변수 주입

시스템은 **항상** `app.config.ts`(또는 `app.config.js`)를 통해 빌드 시점에
환경 변수를 읽어 Expo Config에 주입해야 한다. 이 값은 런타임에
`expo-constants`(`Constants.expoConfig.extra`)로 접근한다.

**WHILE** 앱이 실행 중일 때,
**THEN** 시스템은 `Constants.expoConfig.extra.supabaseUrl` 및
`Constants.expoConfig.extra.supabaseAnonKey`를 통해 환경 변수를 읽어야 한다.

#### REQ-API-018: 환경 변수 검증 (fail-fast)

**IF** 런타임에 `Constants.expoConfig.extra.supabaseUrl` 또는
`supabaseAnonKey`가 `undefined`이거나 빈 문자열이면,
**THEN** 시스템은 클라이언트 초기화를 거부하고 에러를 발생시켜야 한다
(REQ-API-005와 연동). 이 동작은 프로덕션에서 잘못된 백엔드 연결을 방지한다.

#### REQ-API-019: 환경 분리 (dev/staging/prod)

**WHILE** EAS Build가 특정 프로필(dev/staging/production)로 실행 중일 때,
**THEN** 시스템은 해당 프로필에 대응하는 환경 변수 파일(`.env`,
`.env.staging`, `.env.production`)의 값만 주입해야 한다.
개발 환경(dev)의 Supabase URL과 프로덕션 환경(production)의 URL은 서로 달라야 한다
(데이터 격리).

---

## 4. API 서피스 매핑 (API Surface Mapping)

본 API 레이어는 `.moai/project/structure.md` "API 서피스" 섹션에 열거된 모든 엔드포인트의
클라이언트 측 진입점을 제공한다. 각 엔드포인트 그룹의 구현은 해당 도메인 SPEC에 위임되며,
본 SPEC은 공통 인프라(클라이언트, 타입, 에러 처리)만 제공한다.

| 엔드포인트 그룹 | PostgREST / Edge Function | 사용 도메인 SPEC |
|----------------|---------------------------|------------------|
| Authentication | Supabase Auth (`signInWithOAuth`, `signOut`, `getSession`) | SPEC-AUTH-001 |
| Books (검색/스캔/상세) | `books` SELECT/INSERT, Edge Function `kakao-book-search` | SPEC-BOOK-001 |
| Library CRUD | `user_books` CRUD | SPEC-LIBRARY-001 |
| Records CRUD + sticker | `emotion_records`, `sticker_reactions` CRUD | SPEC-EMOTION-001 |
| Sessions (독서 세션/타이머) | `reading_sessions` CRUD | SPEC-ROUTINE-001 |
| Clubs CRUD | `clubs`, `club_members`, `join_requests` CRUD, Edge Function `process-join-request` | SPEC-CLUB-001, SPEC-CLUB-002 |
| Club Feed (실시간) | `emotion_records` SELECT + Realtime `postgres_changes` | SPEC-FEED-001 |
| Users profile + notifications | `users` SELECT/UPDATE, `notifications` CRUD, Edge Function `send-notification` | SPEC-PROFILE-001, SPEC-NOTIF-001 |
| Completion reports | `completion_reports` SELECT, Edge Function `generate-completion-report` | SPEC-COMPLETION-001 |

> 본 표의 각 도메인 SPEC은 `supabase` 싱글톤과 `src/types/db.ts` 타입을 임포트하여
> 사용한다. 본 SPEC은 엔드포인트 구현 로직을 포함하지 않는다.

---

## 5. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **Edge Function 구현 로직**: `kakao-book-search`, `process-join-request`,
   `generate-completion-report`, `send-notification` Edge Function의 서버 측 로직은
   각 도메인 SPEC(SPEC-BOOK-001, SPEC-CLUB-001, SPEC-COMPLETION-001, SPEC-NOTIF-001)이
   처리한다. 본 SPEC은 `supabase.functions.invoke()` 호출 인프라만 제공한다.
2. **OAuth 제공자 설정**: 카카오/애플/구글 OAuth 앱 등록, 콜백 URL 설정, Supabase Auth
   제공자 활성화는 SPEC-AUTH-001 및 SPEC-DEPLOY-001 영역이다. 본 SPEC은 인증 헤더 자동
   주입 인프라만 제공한다.
3. **인증 플로우 UI 및 로직**: 로그인 화면, 온보딩, 세션 갱신 훅, AuthContext는
   SPEC-AUTH-001이 구현한다. 본 SPEC은 세션 영속화 설정만 정의한다.
4. **데이터 페칭 라이브러리 선택**: React Query, SWR, 순수 React 훅 중 어느 것을
   사용할지는 미결정 사항(Open Question 6.1)이며, 본 SPEC 범위 밖이다. 본 SPEC은
   `supabase` 클라이언트만 제공하며, 데이터 페칭 전략은 후속 SPEC 또는 런타임 결정에서
   확정한다.
5. **오프라인 캐싱 전략**: 네트워크 오프라인 시 로컬 캐싱, 큐잉, 동기화 전략은 미결정
   사항(Open Question 6.2)이며, MVP 범위 밖 또는 후순위 기능이다.
6. **각 도메인 화면 구현**: 홈/서재/모임/마이 화면의 UI 구현은 각 도메인 SPEC이 처리한다.
7. **Storage 업로드 로직**: 책 표지 이미지, 프로필 아바타 업로드는 `supabase.storage`
   API를 사용하나, 구체적 업로드 로직은 각 도메인 SPEC(SPEC-BOOK-001, SPEC-AUTH-001)이
   처리한다. 본 SPEC은 Storage 클라이언트 접근성만 보장한다.
8. **Supabase 프로젝트 생성 및 마이그레이션 배포**: Supabase 프로젝트 프로비저닝,
   migration 배포(`supabase db push`)는 SPEC-DEPLOY-001 및 인프라 설정 영역이다.

---

## 6. 미결정 사항 (Open Questions)

### 6.1 데이터 페칭 라이브러리 선택 — 미해결

React Query(v5, `@tanstack/react-query`), SWR, 순수 React 훅(`useEffect` + `useState`)
중 어느 전략을 사용할지 미확정.

**후보 분석**:
- **React Query**: 캐싱, 백그라운드 갱신, 낙관적 업데이트, 무한 스크롤 내장. 번들 크기
  ~13KB. 커뮤니티 생태계 가장 큼. 학습 곡선 존재.
- **SWR**: 가벼움(~4KB), 간단한 API. 캐싱/재검증 내장. React Query 대비 기능 적음.
- **순수 훅**: 의존성 없음. 캐싱/재시도/로딩 상태 직접 구현 필요. 보일러플레이트 다수.

**영향 범위**: 이 결정은 모든 도메인 SPEC(Books, Library, Emotion, Clubs 등)의 데이터
페칭 패턴에 영향을 미친다. 본 SPEC은 클라이언트 인프라만 제공하므로 결정을 연기한다.

**해결 시점**: SPEC-AUTH-001 또는 첫 도메인 SPEC(SPEC-BOOK-001) 구현 시 확정 예정.
확정 시 본 SPEC 버전을 올리고 "데이터 페칭 전략" 섹션을 추가한다.

### 6.2 오프라인 캐싱 전략 — 미해결

네트워크 오프라인 시 데이터 캐싱, 쓰기 큐잉, 재접속 시 동기화 전략 미확정.

**상태**: MVP 범위 밖 또는 후순위. product.md 비목표("실시간 매칭")와 직접 관련 없으나,
모바일 환경에서 오프라인 경험은 사용자 만족도에 영향. Phase 4 이후 재검토.

### 6.3 세션 저장소 선택 — 미해결

`@supabase/supabase-js`의 `auth.storage` 옵션에 대해 AsyncStorage(`@react-native-async-storage/async-storage`)와 Expo SecureStore(`expo-secure-store`) 중 어느 것을 사용할지 미확정.

**후보 분석**:
- **AsyncStorage**: 평문 저장, 빠른 접근, 모든 RN 프로젝트에서 범용. JWT가 평문으로 저장됨.
- **Expo SecureStore**: iOS Keychain / Android Keystore 암호화 저장. 보안 강화. 용량 제한(2KB) — JWT 길이에 따라 제한 걸릴 수 있음.

**권장**: SecureStore 우선, 용량 초과 시 AsyncStorage 폴백 (구현 시 결정).

---

## 7. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-API-001 | REQ-API-001 ~ REQ-API-019 | `.moai/project/structure.md`(API 서피스), `.moai/project/tech.md`(기술 스택), `.moai/project/db/schema.md`(엔터티/ENUM/뷰), `.moai/specs/SPEC-DB-001/spec.md`(선행 의존성), `.moai/specs/SPEC-UI-001/spec.md`(프로젝트 구조), `.moai/specs/INDEX.md`(SPEC 카탈로그) |
| REQ-API-CLIENT | REQ-API-001 ~ REQ-API-005 | structure.md "시스템 아키텍처", tech.md "백엔드/데이터베이스" |
| REQ-API-TYPES | REQ-API-006 ~ REQ-API-010 | db/schema.md "Tables (12)", "Enums", "Views (2)" |
| REQ-API-ERROR | REQ-API-011 ~ REQ-API-015 | tech.md "에러 추적"(Sentry), structure.md API 서피스 |
| REQ-API-ENV | REQ-API-016 ~ REQ-API-019 | tech.md "빌드 및 배포"(EAS Build), "개발 환경 요구사항" |

---

## 8. 구현 노트 (Implementation Notes)

### 구현 완료: 2026-06-15

**구현 범위**: 19/19 REQ (100%) — REQ-008~010 gen-types 충족 (2026-07-06 재검증, `src/types/supabase.ts`)
- 완료: REQ-API-001~018 (전부)
- 연기 해제 (2026-07-06 재검증): REQ-API-008~010 — `src/types/supabase.ts`(gen-types 자동생성, `npm run gen-types`, 877줄)에 12 엔터티(books/club_members/clubs/completion_records/emotion_records/join_requests/notifications/point_logs/reading_sessions/sticker_reactions/user_books/users) + `sticker_type` ENUM(empathy/touching/comforted) + `user_profiles`/`user_books_public` 보안 뷰 전부 도출됨. DB-001 완료 후 이미 실행, 라벨 미갱신이었음 (lessons #23).

**머지 정보**:
- PR: #3
- Commit: e5d01d9 (develop 브랜치 squash merge)
- 브랜치: develop (Git Flow 준수)

**테스트 및 품질**:
- 총 198개 테스트 통과
- 코드 커버리지: 96%+
- TypeScript 컴파일: 0 에러
- ESLint: 0 경고
- 보안 리뷰: service_role 키 노출 이슈 발견/수정 (security-mitigations.md 참조)

**새로운 의존성**:
- `@react-native-async-storage/async-storage` 2.2.0 (세션 영속화 폴백)
- `@supabase/supabase-js` ^2.45.0 (활성화됨)
- `expo-secure-store` ~13.0.0 (활성화됨)
- `expo-constants` ~17.0.0 (활성화됨)

**공개 API 목록**:
1. `getSupabiceClient` — Supabase 클라이언트 싱글톤 (`src/lib/supabase/client.ts`)
2. `normalizeError` — 에러 표준화 (`src/lib/api/errors.ts`)
3. `classifyError` — 에러 카테고리 분류 (`src/lib/api/errors.ts`)
4. `retryWithBackoff` — 지수 백오프 재시도 (`src/lib/api/retry.ts`)
5. `getUserFriendlyMessage` — 사용자 표시용 메시지 (`src/lib/api/errors.ts`)
6. `logToSentry` — 에러 로깅 (`src/lib/api/errors.ts`)
7. `invokeEdgeFunction` — Edge Function 래퍼 (`src/lib/api/edgeFunctions.ts`)
8. `supabaseStorageAdapter` — 세션 저장소 어댑터 (`src/lib/supabase/storageAdapter.ts`)

**새로운 디렉토리 구조**:
- `src/config/` — 환경 변수 검증 및 접근 (`env.ts`)
- `src/lib/supabase/` — Supabase 클라이언트 및 세션 저장소 (`client.ts`, `storageAdapter.ts`)
- `src/lib/api/` — API 에러 처리 및 Edge Function 래퍼 (`errors.ts`, `retry.ts`, `edgeFunctions.ts`, `index.ts`)
- `src/errors/` — 공통 에러 클래스 계층 (`AppError.ts`)

**데이터 플로우**:
1. 환경 변수: `app.config.ts` extra → Constants.expoConfig.extra → env.ts 검증 → createClient
2. 에러 파이프라인: normalizeError → classifyError → retryWithBackoff → getUserFriendlyMessage/logToSentry
3. 세션 영속화: SecureStore(iOS Keychain/Android Keystore) → 2KB 초과 시 AsyncStorage 폴백

**보안 수정사항**:
- 리뷰에서 service_role 키가 클라이언트 번들에 포함된 이슈 발견
- 환경 변수 검증 로직 강화로 anon_key만 사용하도록 수정
- service_role은 Edge Functions 서버 측에서만 사용하도록 보안 정책 강화

**후속 의존성**:
- 모든 도메인 SPEC(SPEC-AUTH-001, SPEC-NAV-001, SPEC-BOOK-001, SPEC-LIBRARY-001 등)이 본 API 레이어 파운데이션 위에 구현됨
- REQ-API-008~010 완료 (2026-07-06 재검증): `src/types/supabase.ts`(gen-types 자동생성)로 12 엔터티 + ENUM + 보안 뷰 타입 도출됨. DB-001 완료 후 이미 실행되었음.
