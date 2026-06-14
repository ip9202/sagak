---
id: SPEC-API-001
title: "Supabase Client Integration & API Layer — Acceptance Criteria"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
---

# SPEC-API-001 인수 기준

## 개요

본 문서는 SPEC-API-001 요구사항(REQ-API-001 ~ REQ-API-019)의 인수 기준을
Given-When-Then(Gherkin) 형식으로 정의한다. 각 시나리오는 관찰 가능한 증거(테스트 출력,
파일 존재, 컴파일 결과)를 기반으로 검증 가능해야 한다.

---

## Module 1: REQ-API-CLIENT — 클라이언트 싱글톤 및 설정

### 시나리오 C1: 클라이언트 싱글톤 참조 일관성

**Given** `src/lib/supabase.ts`에 `supabase` 싱글톤 인스턴스가 내보내져 있다
**When** 두 개의 서로 다른 모듈에서 `import { supabase } from '@/lib/supabase'`를 실행한다
**Then** 두 참조가 동일한 객체(`===` 비교 true)여야 한다

**검증 방법**: Jest 단위 테스트 — `expect(supabaseA).toBe(supabaseB)`

### 시나리오 C2: 세션 영속화 설정

**Given** `createClient()` 호출 시 `auth.persistSession: true` 설정이 적용된다
**When** 사용자가 로그인하여 세션이 생성된다
**Then** 세션이 SecureStore(또는 AsyncStorage)에 영속화되어야 한다
**And** 앱 재시작 후 세션이 자동 복원되어야 한다

**검증 방법**: 통합 테스트 — 로그인 후 앱 재시작, `supabase.auth.getSession()`이 세션 반환

### 시나리오 C3: 자동 JWT 헤더 주입

**Given** 활성 세션이 존재한다 (`supabase.auth.getSession()`이 세션 반환)
**When** `supabase.from('users').select()` 쿼리를 실행한다
**Then** PostgREST 요청에 `Authorization: Bearer <jwt>` 헤더가 자동 첨부되어야 한다

**검증 방법**: 네트워크 모킹 테스트 — `fetch` 스파이로 헤더 검증

### 시나리오 C4: Realtime 채널 접근

**Given** `supabase` 클라이언트가 초기화되어 있다
**When** `supabase.channel('test-channel')`을 호출한다
**Then** Realtime 채널 객체가 반환되어야 한다
**And** `channel.on('postgres_changes', ...)` 구독이 가능해야 한다

**검증 방법**: 단위 테스트 — 채널 객체 타입 및 메서드 존재 확인

### 시나리오 C5: Edge Function 호출 래퍼

**Given** `invokeEdgeFunction` 래퍼 함수가 정의되어 있다
**When** `invokeEdgeFunction('kakao-book-search', { query: '호모 데우스' })`를 호출한다
**Then** `supabase.functions.invoke('kakao-book-search', { body: { query: '호모 데우스' } })`가
실행되어야 한다
**And** 현재 세션 JWT가 자동 첨부되어야 한다

**검증 방법**: 단위 테스트 — `supabase.functions.invoke` 모킹, 호출 인자 및 헤더 검증

### 시나리오 C6: 환경 변수 누락 시 fail-fast

**Given** `EXPO_PUBLIC_SUPABASE_URL` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 `undefined`이다
**When** `src/lib/supabase.ts` 모듈이 로드된다
**Then** 명확한 에러 메시지(`"Missing SUPABASE_URL or SUPABASE_ANON_KEY"`)와 함께
초기화가 중단되어야 한다

**검증 방법**: 단위 테스트 — 환경 변수 모킹, 모듈 로드 시 에러 throw 검증

---

## Module 2: REQ-API-TYPES — gen-types 타입 안전성

### 시나리오 T1: gen-types 파일 존재 및 자동 생성 표식

**Given** `src/types/db.ts` 파일이 존재한다
**When** 파일 내용을 읽는다
**Then** 파일 상단에 `// AUTO-GENERATED` (또는 동등한) 주석이 포함되어야 한다
**And** `Database` 인터페이스가 내보내져야 한다

**검증 방법**: 파일 존재 확인 + Grep으로 주석 및 export 문 확인

### 시나리오 T2: 타입 안전 클라이언트 제네릭 적용

**Given** `createClient<Database>(...)` 호출로 클라이언트가 생성된다
**When** `supabase.from('users')`를 호출한다
**Then** 반환 객체의 `select()` 메서드 반환 타입이 `User[]`로 추론되어야 한다

**검증 방법**: TypeScript 컴파일 — `tsc --noEmit` 통과, 타입 추론 확인

### 시나리오 T3: 12개 엔터티 타입 매핑

**Given** `src/types/db.ts`에 12개 테이블 타입이 정의되어 있다
**When** 각 엔터티의 Row 타입을 도출한다
**Then** 다음 타입 별칭이 유효해야 한다: `User`, `Book`, `UserBook`, `EmotionRecord`,
`StickerReaction`, `Club`, `ClubMember`, `JoinRequest`, `ReadingSession`,
`CompletionReport`, `PointLog`, `Notification`

**검증 방법**: TypeScript 컴파일 — 각 타입 별칭이 에러 없이 사용 가능

### 시나리오 T4: 존재하지 않는 테이블 컴파일 에러

**Given** 클라이언트가 `Database` 제네릭으로 타입 안전하다
**When** `supabase.from('nonexistent_table')`를 호출한다
**Then** TypeScript 컴파일 에러가 발생해야 한다

**검증 방법**: `tsc --noEmit` 실행 시 해당 라인에서 에러 출력

### 시나리오 T5: ENUM 타입 노출

**Given** `sticker_type` ENUM이 DB에 정의되어 있다 (empathy, touching, comforted)
**When** gen-types를 실행한다
**Then** `Database['public']['Enums']['sticker_type']` 타입이
`'empathy' | 'touching' | 'comforted'`로 생성되어야 한다

**검증 방법**: 타입 검사 — `StickerType` 별칭이 세 값만 허용

### 시나리오 T6: 보안 뷰 타입 노출

**Given** `user_profiles` 및 `user_books_public` 보안 뷰가 DB에 존재한다
**When** gen-types를 실행한다
**Then** `Database['public']['Views']['user_profiles']['Row']` 타입이
`{ id: string, nickname: string, avatar_url: string | null }`으로 생성되어야 한다
**And** `Database['public']['Views']['user_books_public']['Row']` 타입이
`{ book_id: string, current_page: number, started_reading_at: string | null, user_id: string }`으로
생성되어야 한다

**검증 방법**: 타입 검사 — 뷰 Row 타입 컬럼 일치

### 시나리오 T7: gen-types 재실행 후 타입 동기화

**Given** SPEC-DB-001 migration으로 새 컬럼이 추가되었다
**When** `supabase gen types typescript`를 재실행한다
**Then** `src/types/db.ts`가 재생성되어 새 컬럼이 타입에 반영되어야 한다
**And** 기존 타입 단언 없이 자동 추론으로 새 컬럼 접근이 가능해야 한다

**검증 방법**: 스키마 변경 시뮬레이션 — gen-types 전후 타입 비교

---

## Module 3: REQ-API-ERROR — 공통 에러 처리 및 재시도

### 시나리오 E1: 에러 정규화 함수 동작

**Given** `normalizeError` 함수가 정의되어 있다
**When** Supabase 에러 객체(`{ message, code, details, hint }`)를 입력한다
**Then** `ApiError` 타입 객체(`{ category, message, originalError, userFriendlyMessage }`)를
반환해야 한다

**검증 방법**: 단위 테스트 — 입력/출력 구조 검증

### 시나리오 E2: NETWORK 에러 분류 및 재시도

**Given** 네트워크 연결이 끊어진 상태이다
**When** `supabase.from('users').select()` 쿼리를 실행한다
**Then** 에러 카테고리가 `NETWORK`로 분류되어야 한다
**And** 1초, 2초, 4초 간격으로 최대 3회 자동 재시도가 수행되어야 한다
**And** 3회 실패 후 최종 에러가 반환되어야 한다

**검증 방법**: 단위 테스트 — `fetch` 모킹, 타이머 모킹(`jest.useFakeTimers`), 재시도 횟수 및 간격 검증

### 시나리오 E3: RLS_DENIED 에러 분류 (재시도 없음)

**Given** RLS 정책이 사용자 접근을 거부한다
**When** 쿼리를 실행한다
**Then** 에러 카테고리가 `RLS_DENIED`로 분류되어야 한다
**And** 재시도 없이 즉시 에러가 반환되어야 한다
**And** 사용자 친화적 메시지("접근 권한이 없습니다")가 제공되어야 한다

**검증 방법**: 단위 테스트 — RLS 거부 에러 모킹, 재시도 미발생 검증

### 시나리오 E4: AUTH 에러 분류 (재시도 없음)

**Given** 세션이 만료되었다
**When** 쿼리를 실행한다
**Then** 에러 카테고리가 `AUTH`로 분류되어야 한다
**And** 재시도 없이 즉시 에러가 반환되어야 한다

**검증 방법**: 단위 테스트 — 401 에러 모킹

### 시나리오 E5: VALIDATION 에러 분류 (UNIQUE 충돌)

**Given** UNIQUE 제약 위반(예: 동일 `(user_id, book_id)` 조합 중복 등록)이 발생한다
**When** INSERT 쿼리를 실행한다
**Then** 에러 카테고리가 `VALIDATION`으로 분류되어야 한다
**And** 사용자 친화적 메시지("이미 등록된 항목입니다")가 제공되어야 한다

**검증 방법**: 단위 테스트 — PostgREST 409 Conflict 에러 모킹

### 시나리오 E6: SERVER 에러 분류 및 재시도

**Given** Supabase 백엔드가 500 에러를 반환한다
**When** 쿼리를 실행한다
**Then** 에러 카테고리가 `SERVER`로 분류되어야 한다
**And** 최대 3회 지수 백오프 재시도가 수행되어야 한다

**검증 방법**: 단위 테스트 — 500 에러 모킹

### 시나리오 E7: 한국어 사용자 친화적 메시지 매핑

**Given** `getUserFriendlyMessage` 함수가 정의되어 있다
**When** 각 에러 카테고리(NETWORK, AUTH, RLS_DENIED, VALIDATION, NOT_FOUND, SERVER, UNKNOWN)를
입력한다
**Then** 한국어 메시지가 반환되어야 한다:
- NETWORK → "네트워크 연결을 확인해 주세요"
- AUTH → "로그인이 필요합니다"
- RLS_DENIED → "접근 권한이 없습니다"
- VALIDATION → "입력값을 확인해 주세요" (또는 구체적 메시지)
- NOT_FOUND → "요청한 항목을 찾을 수 없습니다"
- SERVER → "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요"
- UNKNOWN → "알 수 없는 오류가 발생했습니다"

**검증 방법**: 단위 테스트 — 각 카테고리별 메시지 반환 검증

### 시나리오 E8: UNKNOWN 에러 Sentry 로깅

**Given** 분류 불가한 에러(UNKNOWN 카테고리)가 발생한다
**When** 에러 처리 파이프라인을 통과한다
**Then** 구조화 로그(Sentry `captureException` 호환 포맷)로 기록되어야 한다
**And** 로그에 `{ category, message, originalError, timestamp }` 구조가 포함되어야 한다

**검증 방법**: 단위 테스트 — 로깅 함수 모킹, 호출 인자 구조 검증

---

## Module 4: REQ-API-ENV — 환경 변수 관리 및 검증

### 시나리오 V1: 환경 변수 파일 구조

**Given** 프로젝트 루트에 환경 변수 파일이 존재한다
**When** 파일 시스템을 확인한다
**Then** 다음 파일이 존재해야 한다: `.env.example` (커밋 대상), `.env` (gitignore)
**And** `.env.example`에 `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_ANON_KEY` 키가 포함되어야 한다

**검증 방법**: 파일 존재 확인 + Grep으로 키 존재 검증

### 시나리오 V2: .env 파일 gitignore 제외

**Given** `.gitignore` 파일이 존재한다
**When** 내용을 확인한다
**Then** `.env`, `.env.staging`, `.env.production`이 gitignore에 추가되어 있어야 한다
**And** `.env.example`은 gitignore에 없어야 한다 (커밋 대상)

**검증 방법**: Grep으로 `.gitignore` 내용 검증

### 시나리오 V3: app.config.ts 환경 변수 주입

**Given** `app.config.ts`가 정의되어 있다
**When** 빌드 시점에 환경 변수를 읽는다
**Then** `process.env.EXPO_PUBLIC_SUPABASE_URL` 및
`EXPO_PUBLIC_SUPABASE_ANON_KEY`가 `extra` 필드에 주입되어야 한다

**검증 방법**: 설정 파일 확인 + 빌드 후 `Constants.expoConfig.extra` 검증

### 시나리오 V4: 런타임 환경 변수 접근

**Given** 앱이 실행 중이다
**When** `Constants.expoConfig.extra.supabaseUrl`을 읽는다
**Then** `app.config.ts`에서 주입한 값이 반환되어야 한다

**검증 방법**: 단위 테스트 — Constants 모킹, 값 반환 검증

### 시나리오 V5: 환경 변수 누락 시 fail-fast

**Given** `Constants.expoConfig.extra.supabaseUrl`이 `undefined`이다
**When** `src/config/env.ts`의 검증 함수를 호출한다
**Then** 명확한 에러 메시지와 함께 에러가 발생해야 한다

**검증 방법**: 단위 테스트 — Constants 모킹, 에러 throw 검증

### 시나리오 V6: 환경 분리 (dev/prod URL 상이)

**Given** dev 환경과 production 환경의 Supabase URL이 다르다
**When** 각 환경 프로필로 빌드한다
**Then** dev 빌드는 dev Supabase URL을, production 빌드는 production URL을 주입해야 한다

**검증 방법**: EAS Build 프로필별 빌드 산출물에서 `Constants.expoConfig.extra` 비교

### 시나리오 V7: .env.example 템플릿 완전성

**Given** `.env.example` 파일이 존재한다
**When** 내용을 확인한다
**Then** 다음 키가 모두 포함되어야 한다 (값은 빈 문자열 또는 플레이스홀더):
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`EXPO_PUBLIC_KAKAO_REST_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`

**검증 방법**: Grep으로 각 키 존재 검증

---

## 엣지 케이스 (Edge Cases)

### 엣지 케이스 1: 세션 만료 중 쿼리 실행

**Given** JWT가 방금 만료되었다
**When** 쿼리를 실행한다
**Then** `autoRefreshToken: true` 설정으로 인해 토큰이 자동 갱신된 후 쿼리가 재시도되어야 한다
**And** 갱신 실패 시 `AUTH` 카테고리 에러가 반환되어야 한다 (재시도 없음)

### 엣지 케이스 2: Realtime 채널 자동 재연결

**Given** Realtime 채널이 활성화되어 있다
**When** 네트워크가 일시적으로 끊겼다가 복구된다
**Then** `@supabase/supabase-js` v2 기본 동작으로 채널이 자동 재연결되어야 한다
**And** 놓친 이벤트가 복구 후 수신되어야 한다 (라이브러리 보장 범위)

### 엣지 케이스 3: SecureStore 용량 초과

**Given** JWT + 리프레시 토큰이 SecureStore 2KB 제한을 초과한다
**When** 세션 저장을 시도한다
**Then** AsyncStorage로 폴백 저장되어야 한다 (커스텀 어댑터)
**And** 세션 영속화 기능이 정상 동작해야 한다

### 엣지 케이스 4: gen-types 파일 수동 편집 시도

**Given** 개발자가 `src/types/db.ts`를 수동 편집한다
**When** 다음 gen-types 실행 시 파일이 덮어쓰기된다
**Then** 수동 편집 내용이 손실된다 (설계상 의도)
**And** 파일 상단 주석으로 수동 편집 금지 경고가 표시되어야 한다

### 엣지 케이스 5: 동시 다중 Edge Function 호출

**Given** 두 개의 Edge Function 호출이 동시에 발생한다
**When** `invokeEdgeFunction`을 병렬로 호출한다
**Then** 각 호출이 독립적으로 처리되어야 한다
**And** 한 호출의 실패가 다른 호출에 영향을 주지 않아야 한다

### 엣지 케이스 6: 프로덕션에서 service_role 키 누출 방지

**Given** 클라이언트 번들에 `service_role` 키가 포함되지 않아야 한다
**When** 프로덕션 빌드 번들을 검사한다
**Then** `EXPO_PUBLIC_SUPABASE_SERVICE_ROLE` 또는 유사한 키가 번들에 없어야 한다
**And** `EXPO_PUBLIC_*` 접두사가 붙은 키 중 anon_key만 존재해야 한다

**검증 방법**: 빌드 번들 문자열 검색 — `service_role` 패턴 부재 확인

---

## 품질 게이트 (Quality Gates)

### TRUST 5 준수

- **Tested**: 단위 테스트 커버리지 85%+ (클라이언트, 에러 처리, 환경 변수 모듈)
- **Readable**: 한국어 주석, 명확한 함수명(`normalizeError`, `getUserFriendlyMessage`)
- **Unified**: ESLint + Prettier 통과, TypeScript strict 모드
- **Secured**: `service_role` 키 번들 미포함, 환경 변수 `.gitignore` 처리
- **Trackable**: Conventional commits (`feat(api): add supabase client singleton` 등)

### LSP 품질 게이트 (run 단계)

- TypeScript 에러 0건 (`tsc --noEmit`)
- ESLint 에러 0건
- Jest 테스트 전체 통과

---

## Definition of Done (DoD)

본 SPEC의 구현이 완료되려면 다음을 모두 충족해야 한다:

1. [ ] `src/lib/supabase.ts` 클라이언트 싱글톤 구현 (REQ-API-001 ~ 005)
2. [ ] `src/types/db.ts` gen-types 생성 (REQ-API-006 ~ 010)
3. [ ] `src/lib/api/errors.ts` 에러 처리 구현 (REQ-API-011 ~ 015)
4. [ ] `src/config/env.ts` + `app.config.ts` 환경 변수 인프라 (REQ-API-016 ~ 019)
5. [ ] `.env.example` + `.gitignore` 환경 변수 파일 구조
6. [ ] 단위 테스트 커버리지 85%+
7. [ ] TypeScript strict 컴파일 에러 0건
8. [ ] ESLint 에러 0건
9. [ ] 모든 시나리오(C1-C6, T1-T7, E1-E8, V1-V7) 테스트 통과
10. [ ] 엣지 케이스 1-6 검증 완료
11. [ ] `service_role` 키 번들 미포함 검증 (보안 게이트)
