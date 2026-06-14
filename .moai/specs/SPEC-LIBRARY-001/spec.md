---
# 8-field frontmatter (SPEC-DB-001 형식 준수)
id: SPEC-LIBRARY-001
title: "Personal Library Management"
version: "1.0.0"
status: draft
created: 2026-06-14
updated: 2026-06-14
author: "강력쇠주먹"
priority: high
issue_number: 0
labels: [library, user-books, progress-tracking, reading-status, visibility, crud, domain]
---

# SPEC-LIBRARY-001: 개인 서재 관리

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-06-14 | 1.0.0 | 최초 작성 — 서재 CRUD, 진도 추적, 독서 상태 관리, 공개/비공개 설정 정의 | 강력쇠주먹 |

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (SPEC-UI-001 파운데이션 위에 구축)
- **API 계층**: Supabase PostgREST (`user_books` 테이블 자동 REST API)
- **데이터 테이블**: `user_books` (개인 서재), `books` (도서 카탈로그, 읽기 전용 조인)
- **인증 컨텍스트**: Supabase Auth JWT → RLS `auth.uid()` 식별 (SPEC-DB-001 REQ-DB-015)
- **타입 시스템**: TypeScript strict + Supabase gen-types `Database['public']['Tables']['user_books']` (SPEC-API-001 REQ-API-008)
- **데이터 페칭**: SPEC-API-001 미결정 사항 6.1(React Query vs SWR vs 순수 훅) 확정 후 패턴 적용

### 단일 출처 (Single Source of Truth)

본 SPEC은 다음 문서를 복합 SSOT로 한다:
- `.moai/project/product.md` — "종이책 서재 관리" 핵심 기능, "진도 추적"
- `.moai/project/structure.md` — API 서피스 "Library CRUD (서재 관리)" 섹션 (4개 엔드포인트)
- `.moai/project/tech.md` — 백엔드/데이터베이스 섹션 (PostgREST, RLS)
- `.moai/project/db/schema.md` — `user_books` 테이블 스키마, 트리거, 보안 뷰
- `.moai/specs/SPEC-DB-001/spec.md` — REQ-DB-003(user_books 정의), REQ-DB-010(completion_reports 트리거), REQ-DB-013e(보안 뷰), REQ-DB-015(user_books RLS)
- `.moai/specs/INDEX.md` — Phase 2 의존성 그래프 (SPEC-BOOK-001 → SPEC-LIBRARY-001)

### 의존성

- **SPEC-DB-001** (선행): `user_books` 스키마 + RLS + 트리거 + 보안 뷰 완료 (v1.2.0)
- **SPEC-API-001** (선행): Supabase 클라이언트 싱글톤 + gen-types 타입 + 에러 처리 (v1.0.0)
- **SPEC-AUTH-001** (선행): `useSession()` 훅으로 `auth.uid()` 식별 (v1.0.0)
- **SPEC-BOOK-001** (선행): 책 등록 → `books` 행 존재 보장 (서재 추가 시 `book_id` FK)
- **SPEC-UI-001** (선행): `BookCard`, `ProgressBar` 컴포넌트 재사용 (v1.0.0)
- **후속 SPEC**: SPEC-EMOTION-001(책 컨텍스트), SPEC-CLUB-001(독자 목록), SPEC-COMPLETION-001(완독 다이어리 UI)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **DB 트리거가 자동 갱신을 담당한다** (SPEC-DB-001 REQ-DB-003). 본 SPEC(클라이언트)은
   `current_page` UPDATE만 수행하며, `last_progress_at` 갱신은 DB의
   `on_user_books_update` 트리거가 `now()`로 자동 처리한다. 클라이언트가
   `last_progress_at` 값을 직접 설정하지 않는다.
2. **완독 처리 시 `completion_reports` 자동 생성은 DB 트리거가 담당한다**
   (SPEC-DB-001 REQ-DB-010). `status`가 `reading`에서 `completed`로 전환되면
   `generate_completion_report_trigger`가 `completion_reports` 행을 자동 INSERT한다.
   본 SPEC은 `status` UPDATE만 수행하며, 트리거를 직접 호출하지 않는다.
3. **`completed_at` 자동 설정은 DB 트리거가 담당한다** (SPEC-DB-001 REQ-DB-003).
   `status`가 `reading`에서 `completed`로 전환되면 DB가 `completed_at`을 `now()`로
   설정한다. 클라이언트는 `completed_at`을 포함하지 않은 UPDATE 본문만 전송한다.
4. **RLS가 데이터 격리를 보장한다** (SPEC-DB-001 REQ-DB-015). `auth.uid() = user_id`
   조건으로 자기 서재 행만 조회/수정/삭제 가능하며, 타인 서재는 베이스 테이블에서
   숨겨진다. 클라이언트는 추가 권한 검사를 수행하지 않는다.
5. **Supabase 클라이언트 싱글톤이 이미 초기화되어 있다** (SPEC-API-001 REQ-API-001).
   본 SPEC은 `supabase.from('user_books')` API를 소비한다.

### 2.2 비즈니스 가정

1. **같은 책 중복 등록은 불가하다** (SPEC-DB-001 REQ-DB-003: `UNIQUE(user_id, book_id)`).
   이미 서재에 있는 책을 다시 추가하려 하면 DB UNIQUE 제약에 의해 409 Conflict가
   반환된다. 클라이언트는 사용자에게 "이미 서재에 있는 책입니다" 메시지를 표시한다.
2. **`status` 전환은 클라이언트 UPDATE로 트리거된다**. 클라이언트가 `status` 컬럼을
   `reading`/`completed`/`shelved` 중 하나로 UPDATE하면, DB CHECK 제약이 값을
   검증하고, 전환 조건에 따라 트리거가 `completed_at` 및 `completion_reports`를
   처리한다.
3. **`is_public` 기본값은 `true`다** (SPEC-DB-001 REQ-DB-003). 사용자가 명시적으로
   비공개로 설정하지 않는 한, 서재 항목은 Track A 독자 목록에 노출된다
   (`user_books_public` 보안 뷰).
4. **책 추가 시 `current_page`는 0으로 시작한다** (SPEC-DB-001 REQ-DB-003 default 0).
   `started_reading_at`은 첫 진도 업데이트 또는 `status` 전환 시점에 설정된다
   (미결정 사항 6.1 — 현재 DB 트리거 동작 기준, 클라이언트가 명시적 UPDATE 가능).
5. **`books` 행은 서재 추가 전에 존재해야 한다** (FK 제약). SPEC-BOOK-001이 책 등록을
   담당하며, 본 SPEC은 이미 등록된 `book_id`를 서재에 추가한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 4개 요구사항 모듈로 구성된다: REQ-LIB-CRUD, REQ-LIB-PROGRESS,
> REQ-LIB-STATUS, REQ-LIB-VISIBILITY.

### REQ-LIB-CRUD: 서재 추가·조회·삭제

**목적**: 사용자가 자신의 서재에 책을 추가하고, 목록을 조회하며, 삭제하는 기본 CRUD
기능을 제공한다. 모든 조작은 RLS에 의해 본인 서재로 제한된다.

#### REQ-LIB-001: 서재 책 추가 (POST /library)

**WHEN** 사용자가 책 상세 화면 또는 검색 결과에서 "서재에 추가" 버튼을 탭하면,
**THEN** 시스템은 `user_books` 테이블에 새 행을 INSERT해야 한다. 이 행은 다음
필드를 포함한다:
- `user_id`: 현재 인증 사용자 ID (`auth.uid()`)
- `book_id`: 대상 책 ID (SPEC-BOOK-001 산출물)
- `status`: 기본값 `'reading'`
- `current_page`: 기본값 `0`
- `is_public`: 기본값 `true`

`started_reading_at`은 INSERT 시점에 `now()`로 설정한다 (최초 등록 = 읽기 시작).

#### REQ-LIB-002: 중복 추가 방지 (UNIQUE 제약 처리)

**IF** 사용자가 이미 서재에 등록된 책(`UNIQUE(user_id, book_id)` 위반)을 다시
추가하려 하면,
**THEN** 시스템은 DB에서 반환되는 409 Conflict 에러를 감지하여, 사용자에게
"이미 서재에 있는 책입니다" 메시지를 표시해야 한다. 중복 행을 생성하지 않는다.

> 근거: SPEC-DB-001 REQ-DB-003의 `UNIQUE(user_id, book_id)` 제약. 클라이언트는
> 에러 카테고리 `VALIDATION`(SPEC-API-001 REQ-API-012)로 분류된 이 에러를
> 사용자 친화적 메시지로 변환한다 (REQ-API-014).

#### REQ-LIB-003: 서재 목록 조회 (GET /library)

시스템은 **항상** `user_books` 테이블에서 `auth.uid() = user_id` 조건으로 현재
사용자의 서재 목록을 조회하는 함수(`getLibrary`)를 제공해야 한다. 이 조회는
`books` 테이블을 조인하여 책 메타데이터(제목, 저자, 표지, 총 페이지 수)를 함께
반환한다.

**WHILE** 서재 목록 조회 중일 때,
**THEN** 시스템은 `status` 필터(`reading`/`completed`/`shelved` 또는 전체)와
정렬 기준(`last_progress_at` 내림차순, `created_at` 내림차순, `title` 가나다순)을
쿼리 파라미터로 지원해야 한다. 기본 정렬은 미결정 사항 6.2 — 현재
`last_progress_at` 내림차순을 가정.

#### REQ-LIB-004: 서재 항목 삭제 (DELETE /library/{book_id})

**WHEN** 사용자가 서재 항목 삭제를 확인하면,
**THEN** 시스템은 `user_books`에서 `user_id = auth.uid() AND book_id = {book_id}`
조건으로 행을 DELETE해야 한다.

> 주의: FK `ON DELETE RESTRICT` 정책(SPEC-DB-001 REQ-DB-003)에 의해,
> `emotion_records`, `completion_reports` 등 자식 행이 존재하는 서재 항목은
> 삭제가 거부될 수 있다. 클라이언트는 삭제 전 확인 다이얼로그를 표시하고,
> RESTRICT 위반 시 "이 책에 감정 기록이 있어 삭제할 수 없습니다" 메시지를
> 표시한다 (미결정 사항 6.3 — 소프트 삭제 vs 하드 삭제 정책).

#### REQ-LIB-005: 서재 조회 권한 (RLS 준수)

**WHILE** 인증된 사용자가 서재를 조회할 때,
**THEN** 시스템은 RLS 정책(SPEC-DB-001 REQ-DB-015)에 의해 자기 행만 반환됨을
보장받는다. 타인의 서재 행은 베이스 테이블에서 숨겨지며, 타인의 공개 서재
정보는 `user_books_public` 보안 뷰를 통해서만 접근한다 (SPEC-CLUB-001 영역).

---

### REQ-LIB-PROGRESS: 진도 추적 (current_page → last_progress_at)

**목적**: 사용자가 현재 읽고 있는 페이지를 업데이트하고, DB 트리거가 활성도
판정용 타임스탬프를 자동 갱신하도록 한다.

#### REQ-LIB-010: 진도 업데이트 (PUT /library/{book_id})

**WHEN** 사용자가 책 상세 화면에서 현재 페이지를 입력하고 저장하면,
**THEN** 시스템은 `user_books`에서 `user_id = auth.uid() AND book_id = {book_id}`
조건으로 `current_page`를 UPDATE해야 한다.

이 UPDATE 본문은 `current_page` 값만 포함하며, `last_progress_at`은 포함하지
않는다. `last_progress_at` 갱신은 DB의 `on_user_books_update` 트리거가
`now()`로 자동 처리한다 (SPEC-DB-001 REQ-DB-003).

#### REQ-LIB-011: 페이지 값 검증

**WHILE** 진도 업데이트 값을 검증하는 동안,
**THEN** 시스템은 다음 규칙을 적용해야 한다:
- `current_page`는 0 이상의 정수여야 한다 (음수 거부)
- `current_page`는 해당 책의 `books.total_pages`를 초과할 수 없다
  (초과 시 "마지막 페이지를 초과했습니다" 에러)
- `books.total_pages`가 `null`(수동 입력 도서)인 경우, 상한 검사를 생략한다

**IF** 검증 실패 시,
**THEN** 시스템은 UPDATE를 전송하지 않고 클라이언트 측 에러 메시지를 표시한다.

#### REQ-LIB-012: 진도률 계산 (파생값)

시스템은 **항상** 서재 목록 및 책 상세 화면에서 진도률 백분율을 계산하여
표시해야 한다. 공식: `progress = (current_page / books.total_pages) * 100` (소수점
버림). `total_pages`가 `null`이거나 0인 경우, 진도률은 표시하지 않는다.

> UI 표시는 SPEC-UI-001 `ProgressBar` 컴포넌트를 재사용한다.

#### REQ-LIB-013: 진도 동기화 낙관적 업데이트

**WHERE** 네트워크 지연 시 사용자 경험을 개선하기 위해,
**THEN** 시스템은 진도 업데이트 시 낙관적 업데이트(optimistic update)를 적용할
수 있다. 즉, 서버 응답을 기다리지 않고 즉시 UI의 `current_page`를 갱신한 뒤,
서버 UPDATE 완료 시 확정한다.

**IF** 서버 UPDATE가 실패하면,
**THEN** 시스템은 UI를 이전 값으로 롤백하고 에러 메시지를 표시해야 한다.

> 낙관적 업데이트 적용 여부는 데이터 페칭 라이브러리 선택(SPEC-API-001 미결정
> 사항 6.1)에 따라 달라진다. React Query 선택 시 `useMutation`의 `onMutate`
> 옵션으로 구현한다.

---

### REQ-LIB-STATUS: 독서 상태 관리 (reading/completed/shelved)

**목적**: 사용자가 서재 항목의 독서 상태를 전환하고, DB 트리거가 파생 데이터
(`completed_at`, `completion_reports`)를 자동 처리하도록 한다.

#### REQ-LIB-020: 상태 전환 (PUT /library/{book_id} status)

**WHEN** 사용자가 책 상세 화면에서 독서 상태를 변경하면 (예: "완독 처리" 버튼),
**THEN** 시스템은 `user_books`에서 `user_id = auth.uid() AND book_id = {book_id}`
조건으로 `status`를 UPDATE해야 한다. 허용되는 값은 `'reading'`, `'completed'`,
`'shelved'`이다 (SPEC-DB-001 REQ-DB-003 CHECK 제약).

이 UPDATE 본문은 `status` 값만 포함하며, `completed_at`은 포함하지 않는다.
`completed_at` 설정은 DB 트리거가 자동 처리한다.

#### REQ-LIB-021: 완독 처리 (reading → completed)

**WHEN** 사용자가 `status`를 `'reading'`에서 `'completed'`로 전환하면,
**THEN** 시스템은 `status='completed'` UPDATE만 전송한다. 이후 DB가 자동으로
수행하는 작업은 본 SPEC 범위 밖이나, 다음을 보장받는다:
- `completed_at`이 `now()`로 설정됨 (SPEC-DB-001 REQ-DB-003 트리거)
- `completion_reports` 행이 자동 생성됨 (SPEC-DB-001 REQ-DB-010 트리거,
  멱등성 보장 — `ON CONFLICT DO NOTHING`)

> 완독 다이어리 UI 시각화는 SPEC-COMPLETION-001 영역이다. 본 SPEC은 상태
> 전환 UPDATE까지만 담당한다.

#### REQ-LIB-022: 상태 전환 역방향 (completed → reading) — 조건부

**IF** 사용자가 이미 완독한 책(`status='completed'`)의 상태를 다시 `'reading'`으로
전환하려 하면,
**THEN** 시스템은 이 전환을 허용하되, `completion_reports` 행은 유지됨을
사용자에게 알려야 한다 (DB UNIQUE(user_book_id) + `ON CONFLICT DO NOTHING`으로
재완독 시 기존 리포트가 갱신되지 않음).

> 이 역방향 전환 허용 여부는 미결정 사항 6.1 — 현재 "허용하되 경고" 정책으로
> 작성됨. 사용자 승인 시 "전면 금지" 또는 "리포트 재생성" 정책으로 전환 가능.

#### REQ-LIB-023: 서재 정리 (reading → shelved)

**WHEN** 사용자가 읽기를 중단하고 보관하려면,
**THEN** 시스템은 `status='shelved'` UPDATE를 전송한다. `shelved` 상태의
서재 항목은 기본 서재 목록(진행 중인 책)에서 필터링되어 표시되거나 별도
"보관함" 섹션에 표시된다 (UI 구현은 SPEC-NAV-001 및 본 SPEC 화면 산출물).

---

### REQ-LIB-VISIBILITY: 공개/비공개 설정 (is_public)

**목적**: 사용자가 자신의 서재 항목을 Track A 독자 목록에 노출할지 제어한다.

#### REQ-LIB-030: 공개 범위 토글 (PUT /library/{book_id} is_public)

**WHEN** 사용자가 책 상세 화면에서 "공개" 토글을 전환하면,
**THEN** 시스템은 `user_books`에서 `user_id = auth.uid() AND book_id = {book_id}`
조건으로 `is_public`을 UPDATE해야 한다 (`true` ↔ `false`).

#### REQ-LIB-031: 공개 설정의 Track A 영향

**WHILE** `is_public=true`인 서재 항목은,
**THEN** 해당 항목의 제한 컬럼(`book_id`, `current_page`, `started_reading_at`,
`user_id`)이 `user_books_public` 보안 뷰(SPEC-DB-001 REQ-DB-013e)를 통해
Track A 독자 목록에 노출된다.

**WHILE** `is_public=false`인 서재 항목은,
**THEN** 해당 항목은 `user_books_public` 뷰에서 숨겨지며, Track A 독자 목록에
나타나지 않는다. 본인은 자기 서재에서 계속 조회 가능하다.

> Track A 독자 목록 표시 로직은 SPEC-CLUB-001 영역이다. 본 SPEC은 `is_public`
> 토글 UPDATE까지만 담당한다.

#### REQ-LIB-032: 공개 설정 기본값 안내

시스템은 **항상** 책을 서재에 추가할 때 `is_public=true`(기본값)임을 사용자에게
명시적으로 안내해야 한다. 사용자가 공개를 원하지 않는 경우, 추가 직후 또는
언제든 책 상세 화면에서 토글할 수 있음을 표시한다.

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다:

1. **완독 다이어리 UI**: `completion_reports.report_data` 시각화(감정 곡선, 하이라이트,
   총 기록 수)는 SPEC-COMPLETION-001이 처리한다. 본 SPEC은 `status` 전환
   UPDATE까지만 담당하며, DB 트리거가 자동 생성한 리포트의 시각화는 다루지 않는다.
2. **감정 기록 CRUD**: 페이지별 감정 기록(단어/한 줄), 스티커 반응은
   SPEC-EMOTION-001이 처리한다. 본 SPEC은 `user_books`와 `emotion_records`의
   조인 조회를 수행하지 않는다 (감정 타임라인은 SPEC-EMOTION-001).
3. **Track A 독자 목록 표시**: `user_books_public` 보안 뷰를 통한 타인 공개 서재
   조회, "같이 읽어요" 요청 UI는 SPEC-CLUB-001이 처리한다. 본 SPEC은 본인 서재의
   `is_public` 토글까지만 담당한다.
4. **책 검색 및 등록**: Kakao Book Search API 연동, 바코드 스캔, 수동 검색,
   `books` 테이블 업서트는 SPEC-BOOK-001이 처리한다. 본 SPEC은 이미 등록된
   `book_id`를 서재에 추가하는 것까지만 담당한다.
5. **독서 세션/타이머**: `reading_sessions` 테이블(시작/종료 시간, 지속 시간)은
   SPEC-ROUTINE-001이 처리한다. 본 SPEC의 진도 추적은 페이지 번호 업데이트만
   포함하며, 세션 시간 측정은 다루지 않는다.
6. **Edge Function 구현 로직**: `generate-completion-report` Edge Function은
   SPEC-DB-001에서 예비용으로 예약되어 있으며(DB 트리거가 이미 자동 생성),
   본 SPEC은 Edge Function을 호출하지 않는다.
7. **백엔드 스키마 변경**: `user_books` 테이블, 트리거, RLS 정책, 보안 뷰는
   SPEC-DB-001에 이미 구현되어 있으며, 본 SPEC은 변경하지 않는다.
8. **데이터 페칭 라이브러리 선택**: React Query vs SWR vs 순수 훅은
   SPEC-API-001 미결정 사항 6.1이며, 본 SPEC 범위 밖이다. 본 SPEC은 라이브러리
   무관하게 인터페이스를 정의한다.

---

## 5. 미결정 사항 (Open Questions)

### 5.1 완독 처리 취소(completed → reading 역전환) 허용 여부 — 미해결

**질문**: 사용자가 완독 처리한 책을 다시 `reading` 상태로 되돌릴 수 있는가?

**옵션**:
- (A) 허용하되 경고 — 기존 `completion_reports`는 유지됨을 알림 (기본 정책, v1.0.0)
- (B) 전면 금지 — 완독은 종단 상태, 역전환 불가
- (C) 리포트 재생성 — 역전환 후 재완독 시 `completion_reports`를 갱신(트리거 수정 필요)

**영향**: (A)는 DB UNIQUE + `ON CONFLICT DO NOTHING`으로 재완독 시 기존 리포트가
갱신되지 않아 감정 데이터가 누락될 수 있음. (B)는 사용자 실수(조기 완독 처리) 시
되돌릴 수 없음. (C)는 SPEC-DB-001 트리거 수정이 필요하여 범위 확장.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A) 정책으로 작성됨
(REQ-LIB-022). (C) 선택 시 SPEC-DB-001 버전 업 및 마이그레이션 필요.

### 5.2 서재 정렬 기본값 — 미해결

**질문**: 서재 목록의 기본 정렬 기준은 무엇인가?

**옵션**:
- (A) `last_progress_at` 내림차순 — 최근 활동 순 (기본 가정, v1.0.0)
- (B) `created_at` 내림차순 — 최근 추가 순
- (C) `title` 가나다순 — 가독성 우선
- (D) 상태별 그룹화 + 각 그룹 내 `last_progress_at` 내림차순

**영향**: (A)는 오래 안 읽은 책이 아래로 밀려 사용자가 잊을 수 있음. (B)는 추가
순서가 읽기 우선순위와 다를 수 있음. (C)는 시계열 정보 손실. (D)는 가장 정보성이
높으나 구현 복잡도 증가.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A)를 기본으로 지원하되,
사용자가 설정에서 변경 가능하도록 설계(REQ-LIB-003).

### 5.3 서재 항목 삭제 시 자식 데이터 처리 정책 — 미해결

**질문**: `emotion_records`, `completion_reports`가 있는 서재 항목을 삭제할 때
어떻게 처리하는가?

**옵션**:
- (A) 삭제 금지 + 안내 — FK RESTRICT 위반 시 에러 메시지 표시 (기본 정책, v1.0.0)
- (B) 소프트 삭제 — `status='shelved'`로 전환하여 보관함으로 이동
- (C) 하드 삭제 + 자식 CASCADE — 감정 기록, 완독 리포트까지 모두 삭제 (데이터 영구 손실)
- (D) 확인 다이얼로그 + 조건부 CASCADE — 사용자 확인 후 자식 행 명시적 DELETE 후 부모 DELETE

**영향**: (A)는 사용자가 실수로 삭제하는 것을 방지하나, 영구 삭제 불가. (B)는
"삭제"가 실제로는 보관함 이동이므로 혼란 가능. (C)는 감정 아카이브 가치 상실
(product.md 핵심 가치 훼손). (D)는 구현 복잡도 증가.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A)를 기본으로 하되,
(B) 소프트 삭제를 대안으로 제안 가능(REQ-LIB-004). SPEC-DB-001의
FK `ON DELETE RESTRICT` 정책은 유지됨.

### 5.4 대량 삭제 UX — 미해결

**질문**: 여러 서재 항목을 한 번에 삭제(다중 선택 → 일괄 삭제)하는 기능이
필요한가?

**옵션**:
- (A) 개별 삭제만 — 항목별로 하나씩 삭제 (기본 정책, v1.0.0)
- (B) 다중 선택 + 일괄 삭제 — 체크박스 UI + "N개 삭제" 버튼

**영향**: (A)는 구현 단순, 대량 정리 시 번거로움. (B)는 UX 개선이나 구현
복잡도 및 실수 방지 장치(확인 다이얼로그) 필요.

**상태**: 미해결 — 사용자 승인 대기. MVP v1.0.0은 (A)로 작성됨. 후속 버전에서
(B) 추가 가능.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-LIBRARY-001 | REQ-LIB-001 ~ REQ-LIB-032 | `.moai/project/product.md`("종이책 서재 관리", "진도 추적"), `.moai/project/structure.md`("Library CRUD" API 서피스), `.moai/project/tech.md`(백엔드/데이터베이스), `.moai/project/db/schema.md`(user_books 스키마/트리거/뷰), `.moai/specs/SPEC-DB-001/spec.md`(REQ-DB-003, REQ-DB-010, REQ-DB-013e, REQ-DB-015), `.moai/specs/INDEX.md`(Phase 2 의존성) |

### 하위 SPEC 의존성 (본 SPEC을 소비하는 SPEC)

| 소비자 SPEC | 소비 포인트 |
|-------------|-------------|
| SPEC-EMOTION-001 | 책 컨텍스트 — `user_books.id`를 감정 기록의 부모로 사용 |
| SPEC-CLUB-001 | 독자 목록 — `user_books_public` 뷰 + `is_public` 상태 조회 |
| SPEC-COMPLETION-001 | 완독 다이어리 — `status='completed'` 전환 이벤트 + `completion_reports` 조회 |
| SPEC-ROUTINE-001 | 독서 세션 — `user_books`를 세션의 책 컨텍스트로 사용 |

### 상위 SPEC 의존성 (본 SPEC이 소비하는 SPEC)

| 공급자 SPEC | 공급 포인트 |
|-------------|-------------|
| SPEC-DB-001 | REQ-DB-003(user_books 스키마 + UNIQUE + 트리거), REQ-DB-010(completion_reports 자동 생성), REQ-DB-013e(user_books_public 보안 뷰), REQ-DB-015(user_books RLS) |
| SPEC-API-001 | Supabase 클라이언트 싱글톤, gen-types 타입(`Database['public']['Tables']['user_books']`), 에러 처리(VALIDATION/RLS_DENIED 분류) |
| SPEC-AUTH-001 | `useSession()` 훅 — `auth.uid()` 식별 (RLS 컨텍스트) |
| SPEC-BOOK-001 | 책 등록 — `books` 행 존재 보장 (서재 추가 시 FK 유효) |
| SPEC-UI-001 | `BookCard`, `ProgressBar` 컴포넌트 (서재 목록/책 상세 화면 스타일링) |
