---
id: SPEC-LIBRARY-002
title: "Parallel Reading Support (다중 독서 병행)"
version: "0.2.0"
status: completed
created: 2026-07-27
updated: 2026-07-27
author: "강력쇠주먹"
priority: P1
phase: "v1.3.0"
module: "src/features/library, supabase/migrations, app/(tabs)"
lifecycle: spec-anchored
tags: "library, parallel-reading, multi-book, db-migration, home-ui, status-transition, public-visibility, amendment"
tier: M
depends_on: [SPEC-LIBRARY-001, SPEC-DB-001, SPEC-API-001]
amendment_of: SPEC-LIBRARY-001
---

# SPEC-LIBRARY-002: 병행 독서(다중 reading) 지원

## HISTORY

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2026-07-27 | 0.1.0 | 최초 작성 — enforce_single_reading 정책 철회, 메인 다중 표시, 상태 전환 정리, 공개 가시성 점검을 단일 SPEC으로 통합. SPEC-LIBRARY-001 정책 5.5 / REQ-LIB-020 / REQ-LIB-023을 in-place amendment 처리 권장 | 강력쇠주먹 |
| 2026-07-27 | 0.2.0 | plan-auditor iter1 FAIL (0.79, Tier M 임계 0.80 미달 + MP-7 critical) 개정. 사용자 합의 clarification 3종 반영 (D1: 홈 정렬=last_progress_at DESC / 헤더 CTA 제거 / amendment 타이밍=sync-phase D-NEW-1). 결함 D1-D11 해소 — 신규 REQ 5종 추가 (REQ-LIB2-007 pgTAP 품질 규약, REQ-LIB2-008 동시 INSERT 경쟁, REQ-LIB2-014 로딩 상태 분기, REQ-LIB2-042 EmotionInputScreen 회귀, REQ-LIB2-AMEND-001 sync-phase amendment). 총 REQ 22건, 총 AC 24건 | 강력쇠주먹 |

### Amendments (successor amendment)

본 SPEC(`SPEC-LIBRARY-002`)은 선행 SPEC `SPEC-LIBRARY-001`(version 1.0.0, status: completed)의 **successor amendment**다.

- **prior completed version**: SPEC-LIBRARY-001 v1.0.0 (2026-06-16 completed)
- **prior_completed_sha**: `unknown` (본 plan-phase 시점에서 SPEC-LIBRARY-001은 이미 completed 상태이나, sync-phase amendment 시점에 manager-spec이 `git log`로 산출물 SHA를 보강해야 한다 — `amendment_of` 라인이 이미 선언되어 있으므로 SHA 보강은 기계적 완료 단계다)
- **amendment rationale**: SPEC-LIBRARY-001 정책 5.5(reading 단일)가 실제 사용자 행동(다중 책 병행 독서)과 충돌함이 사용자 보고로 확인됨. 단일 reading 제약은 제품 가정 오류로 판명되었고, 무제한 병행 reading을 허용하도록 정책을 철회해야 한다. 동시에 메인 홈 UI, 서재에서의 상태 전환 로직, 공개 reader list 가시성까지 단일 SPEC으로 통합하여 일관성 있게 개선한다.
- **amendment scope (SPEC-LIBRARY-001 body — in-place amendment at sync-phase per D-NEW-1)**:
  - 정책 5.5 "reading 단일 정책 — 해결됨 (2026-06-30 채택)" → `정책 5.5 (RESCINDED by SPEC-LIBRARY-002)`로 상태 전환 + 철회 사유 기록
  - `REQ-LIB-020` 본문 내 "정책 5.5 (reading 단일)" 각주 → 철회 표시
  - `REQ-LIB-023` 본문 — "자동 shelved 배타 전환" 묘사 제거 (본 SPEC REQ-LIB2-020이 대체)
  - SPEC-LIBRARY-001 `제외 범위 7`의 "예외 (정책 5.5)" 문구 → 본 SPEC에서 스키마 변경을 주도하므로 예외 구문 자체를 철회 표시
  - `migration 20240630000001_enforce_single_reading_policy.sql` 회수 — 본 SPEC 신규 migration이 트리거/함수/인덱스를 DROP
  - SPEC-LIBRARY-001 frontmatter `partially_superseded_by: [SPEC-LIBRARY-002]` 추가 (sync-phase)
- **amendment 타이밍 (사용자 합의 clarification #3 — D1 해소)**: **sync-phase**에서 수행. 근거: `* → superseded` / `completed → in-progress (amendment)` 전환 및 선행 SPEC body 수정은 manager-spec 소관이며, sync-phase에서 SPEC-LIBRARY-001 body 수정은 manager-docs 금지(`.claude/rules/moai/development/spec-frontmatter-schema.md` forbidden crossings) → **D-NEW-1 경로**: manager-docs가 blocker report 반환 → orchestrator가 manager-spec에 재위임하여 수행.

> 본 SPEC은 SPEC-LIBRARY-001 전체를 대체하지 않는다. CRUD/진도 추적/공개 토글 등 나머지 동작은 SPEC-LIBRARY-001이 여전히 단일 진실 원천이며, 본 SPEC은 reading 단일 정책 철회 + 메인 다중 표시 + 상태 전환 정리 + 공개 가시성 점검 범위만을 소유한다.

---

## 1. 환경 (Environment)

- **클라이언트 런타임**: React Native 0.83.2 + Expo SDK 55 + React 19.2 (TypeScript strict)
- **백엔드**: Supabase PostgREST + PostgreSQL (RLS 활성)
- **데이터 테이블**: `user_books` (본 SPEC이 스키마 마이그레이션 주도)
- **데이터 페칭**: TanStack React Query v5 — `useLibrary({userId, status})` 훅
- **인증 컨텍스트**: `useSession()` → `auth.uid()` (SPEC-AUTH-001)
- **타입 시스템**: Supabase gen-types `Database['public']['Tables']['user_books']`

### 단일 출처 (Single Source of Truth)

- `.moai/project/product.md` — "종이책 서재 관리" 핵심 기능
- `.moai/project/tech.md` — 백엔드/데이터베이스 섹션, 데이터 페칭 계층
- `supabase/migrations/20240630000001_enforce_single_reading_policy.sql` — 철회 대상 (트리거 + 함수 + 부분 UNIQUE 인덱스)
- `supabase/migrations/20240614000003_create_user_books.sql` — `on_user_books_update` 트리거 (잔여 BEFORE ROW, 실행 순서 회귀 점검 대상)
- `supabase/migrations/20240701000001_expose_user_books_public_status.sql` — `is_public` 공개 범위
- `.moai/specs/SPEC-LIBRARY-001/spec.md` — 정책 5.5 / REQ-LIB-020 / REQ-LIB-023 (amendment 대상)
- `.moai/specs/SPEC-DB-001/spec.md` — REQ-DB-003 (user_books 스키마), REQ-DB-015 (RLS)
- `.moai/specs/SPEC-EMOTION-001/spec.md` — 감정 기록 연동 (회귀 범위)
- `.moai/specs/SPEC-CLUB-001/spec.md` — Track A 공개 reader list (영향 범위)

### 의존성

- **SPEC-LIBRARY-001** (선행, completed): `user_books` 클라이언트 인터페이스, 진도/상태/공개 토글 API — 본 SPEC이 정책 5.5 영역을 in-place amendment
- **SPEC-DB-001** (선행, completed): `user_books` 스키마 + RLS + 트리거 + 보안 뷰
- **SPEC-API-001** (선행, completed): Supabase 클라이언트 싱글톤 + gen-types
- **SPEC-EMOTION-001** (선행): 감정 기록 `/emotion/[bookId]` 라우트 — 본 SPEC이 메인에서 진입점 다중화
- **후속 영향**: SPEC-CLUB-001 (Track A 공개 reader list — reading 다수 노출 허용), SPEC-COMPLETION-001 (완독 처리 — 영향 없음 확인 필요)

---

## 2. 가정 (Assumptions)

### 2.1 아키텍처 가정

1. **DB 트리거/인덱스는 신규 migration으로 DROP된다**. 본 SPEC은 `20240630000001_enforce_single_reading_policy.sql`에서 생성한 3개 객체(`enforce_single_reading` 트리거, `enforce_single_reading()` 함수, `user_books_one_reading_per_user` 부분 UNIQUE 인덱스)를 모두 회수한다. 회수 후 `user_books` 테이블 자체의 CHECK 제약(`status IN ('reading','completed','shelved')`), `UNIQUE(user_id, book_id)`, RLS 정책, `on_user_books_update` 트리거는 그대로 유지된다.
2. **잔여 BEFORE ROW 트리거 실행 순서 회귀가 없다**. PostgreSQL BEFORE ROW 트리거는 `tgname` 알파벳순으로 실행된다 (메모리 교훈 #20). 기존 `enforce_single_reading` 트리거가 알파벳순 선행 위치에 있었으나, 본 SPEC이 이를 DROP한 후에도 남은 BEFORE 트리거(`on_user_books_update`)의 기능적 의존(`last_progress_at`, `completed_at` 자동 갱신)은 정상 동작해야 한다.
3. **`status` 기본값은 `'shelved'`를 유지한다** (결정 A). 사용자가 명시적으로 "읽기 시작" 액션을 취하기 전에는 서재 추가된 책이 보관 상태로 머무는 기존 동작을 그대로 둔다. 즉, "병행 reading 허용"이 "기본값 reading"으로 바뀌는 것은 아니다.
4. **기존 다중 reading 데이터는 자동 복구하지 않는다**. 과거 `enforce_single_reading` 정책에 의해 자동 `shelved`로 전환된 이력이 있더라도, 본 SPEC은 과거 데이터를 역산하여 `reading`으로 되돌리지 않는다. 사용자가 명시적으로 다시 "읽기 시작"해야 `reading`이 된다.
5. **감정 기록/진도 연동은 본 SPEC 범위 밖이나 회귀가 없어야 한다**. `emotion_records` ↔ `user_books.id` 부모-자식 관계, `/emotion/[bookId]` 라우트, `emotionRootKey(bookId, userId)` react-query invalidate 패턴은 본 SPEC이 건드리지 않는다 (메모리 교훈 #35).
6. **부분 UNIQUE 제거 후 쿼리 성능 회귀 대응은 조건부 일반 인덱스로 수행한다**. `WHERE status='reading' AND user_id = ?` 패턴의 쿼리 성능 회귀가 관측될 경우, run-phase M1에서 `CREATE INDEX IF NOT EXISTS idx_user_books_user_status ON user_books(user_id, status)` 일반 인덱스를 조건부 산출물로 추가한다 (D11 해소).

### 2.2 비즈니스 가정

1. **사용자는 실제로 여러 책을 병행 독서한다** (사용자 보고로 확인). 단일 reading 정책은 제품 가정 오류였으며, 본 SPEC은 이를 철회한다.
2. **"대표 책" 개념은 도입하지 않는다** (결정 B). 공개 reader list(Track A)는 기존 `is_public` 그대로 동작하며, reading 책이 여러 권이면 `is_public=true`인 책 모두가 노출된다. 단일 "지금 읽는 책 1권" 개념은 공개/비공개 모두 제거한다.
3. **사용자가 명시적으로 "보관(shelved)"을 선택할 때만 보관으로 이동한다**. 다른 책을 "읽기 시작"해도 기존 reading 책은 자동 shelved 되지 않는다 (사용자 요청 2).
4. **메인 홈의 각 reading 책에는 독립된 "기록하기" 진입점이 있다** (사용자 요청 3). 단일 헤더 CTA가 아닌, 각 BookCard 단위의 기록 버튼을 제공한다. **기존 홈 헤더의 "오늘의 감정 기록하기" CTA는 제거한다** (사용자 합의 clarification #2 — D1 해소).
5. **공개 reader list 가시성 회귀가 없다**. `user_books_public` 보안 뷰의 노출 컬럼(`book_id`, `current_page`, `started_reading_at`, `user_id`)과 `is_public` 게이트 로직은 변경하지 않는다 (메모리 교훈 #29).
6. **홈 reading 목록 정렬 순서는 `last_progress_at` DESC다** (사용자 합의 clarification #1 — D1 해소). 최근 진도 업데이트된 순서로 다중 reading을 표시한다. SPEC-LIBRARY-001 서재 기본값 가정과 일치한다.

---

## 3. 요구사항 (Requirements)

> 본 SPEC은 6개 요구사항 모듈로 구성된다: REQ-LIB2-POLICY (정책 철회 + DB migration), REQ-LIB2-HOME (메인 다중 표시), REQ-LIB2-TRANSITION (상태 전환 정리), REQ-LIB2-VISIBILITY (공개 가시성 점검), REQ-LIB2-REGRESSION (회귀 보장), REQ-LIB2-AMEND (선행 SPEC in-place amendment).

### REQ-LIB2-POLICY: 단일 reading 정책 철회 (DB migration)

**목적**: `enforce_single_reading` 정책을 완전히 제거하여 한 사용자가 동시에 여러 `status='reading'` 행을 보유할 수 있도록 허용한다.

#### REQ-LIB2-001: enforce_single_reading 트리거 제거

**When** `user_books` 테이블에 신규 migration이 적용되면, the 데이터베이스는 `enforce_single_reading` BEFORE INSERT OR UPDATE OF status 트리거를 DROP해야 한다. 트리거가 제거된 후 `status` 전환 시 같은 `user_id`의 다른 `reading` 행이 자동으로 `shelved`로 배타 전환되는 일이 없어야 한다.

> @MX:ANCHOR 대상 — 이 트리거 제거는 `on_user_books_update` 트리거의 실행 순서 의존성에 영향을 준다 (메모리 교훈 #20). run-phase에서 알파벳순 BEFORE ROW 실행 순서를 재검증해야 한다.

#### REQ-LIB2-002: enforce_single_reading 함수 제거

**When** REQ-LIB2-001의 트리거가 제거되면, the 데이터베이스는 `enforce_single_reading()` 함수도 DROP해야 한다. 함수 본문에 남은 의존성이 없어야 하며, 회수 후 `pg_proc`에 해당 함수가 존재하지 않아야 한다.

#### REQ-LIB2-003: 부분 UNIQUE 인덱스 user_books_one_reading_per_user 제거

**When** 신규 migration이 적용되면, the 데이터베이스는 `user_books_one_reading_per_user ON (user_id) WHERE status='reading'` 부분 UNIQUE 인덱스를 DROP해야 한다. 인덱스 제거 후 동일 `user_id`가 N개의 `status='reading'` 행을 갖는 INSERT/UPDATE가 `23505 unique_violation` 없이 성공해야 한다.

#### REQ-LIB2-004: 다중 reading 보유 허용 (회귀)

**While** REQ-LIB2-001 ~ REQ-LIB2-003이 모두 적용된 후, the 데이터베이스는 한 `user_id`가 0개, 1개, 또는 N개(N ≥ 2)의 `status='reading'` 행을 보유하는 것을 허용해야 한다. 각 `reading` 행은 서로 독립적으로 `current_page`, `last_progress_at`, `started_reading_at`을 유지한다. INSERT 및 UPDATE 두 경로 모두에서 다중 reading이 허용되어야 한다 (D10 해소 — UPDATE 시나리오뿐 아니라 초기 INSERT 시나리오도 포함).

#### REQ-LIB2-005: completed / shelved 기존 동작 유지

**While** 본 SPEC의 migration이 적용된 후에도, the 데이터베이스는 다음 기존 동작을 그대로 유지해야 한다:

- `status='completed'` 전환 시 `completed_at` 자동 설정 (`on_user_books_update` 트리거)
- `status='completed'` 전환 시 `completion_reports` 자동 생성 (기존 트리거)
- `status='shelved'`는 서재 목록 필터링 동작 유지
- `CHECK (status IN ('reading','completed','shelved'))` 제약 유지
- `UNIQUE(user_id, book_id)` 제약 유지 (동일 책 중복 등록 방지)

#### REQ-LIB2-006: 잔여 BEFORE ROW 트리거 실행 순서 회귀 부재

**When** `enforce_single_reading` 트리거가 DROP된 후, the 데이터베이스의 잔여 BEFORE ROW 트리거(`on_user_books_update` 등)가 기존 기능적 의존(`last_progress_at`, `completed_at` 자동 갱신)을 동일하게 수행해야 한다. pgTAP 회귀 테스트가 이를 검증해야 한다 (메모리 교훈 #20 — 트리거 이름 알파벳순 실행 순서).

#### REQ-LIB2-007: pgTAP 품질 규약 준수 (D2 해소)

**When** REQ-LIB2-001 ~ REQ-LIB2-003의 회수 검증 pgTAP 테스트가 작성되면, the 테스트는 `throws_ok(SQL, errcode, errmsg, description)` 4-arg 패턴 또는 `lives_ok(SQL, description)` 패턴을 준수해야 한다 (메모리 교훈 #18). 3-arg `throws_ok` 패턴은 금지된다. 본 REQ는 AC-LIB2-DB-007의 추적성 루트로, 회수 검증 품질 규약을 명시적 REQ로 승격한다.

#### REQ-LIB2-008: 동시 INSERT 경쟁 허용 (D6 해소 — P0 승격)

**When** 두 클라이언트가 동시에 같은 `user_id`로 서로 다른 `book_id`를 `status='reading'`으로 INSERT하면 (race condition), the 데이터베이스는 두 트랜잭션 모두 성공적으로 커밋되게 해야 한다. `23505 unique_violation`이나 직렬화 실패 없이 다중 reading이 허용되어야 한다. 본 REQ는 §G Edge 1의 경쟁 조건 시나리오를 필수 P0 검증 항목으로 승격한다 (선택적 → 필수).

---

### REQ-LIB2-HOME: 메인 페이지 병행 reading 표시

**목적**: 홈 화면에서 사용자의 모든 `status='reading'` 책을 표시하고, 각 책마다 독립된 감정 기록 진입점을 제공한다.

#### REQ-LIB2-010: reading 전체 목록 렌더링 (0/1/N권, last_progress_at DESC 정렬)

**When** 인증된 사용자가 홈 탭(`app/(tabs)/index.tsx`)에 진입하면, the 클라이언트는 `useLibrary({userId, status: 'reading'})` 결과를 단일 `currentBook`이 아닌 전체 `reading` 목록으로 렌더링해야 한다. 목록 길이는 0권(빈 상태), 1권, N권(N ≥ 2) 모두를 지원한다. **목록 정렬 순서는 `last_progress_at` DESC다** (사용자 합의 clarification #1 — D1 해소). 최근 진도 업데이트된 reading 책이 최상단에 표시된다.

> 기존 `readingList?.[0]` 단일 선택 패턴(`pickCurrentBook`)은 제거되며, 전체 `readingList`를 FlatList 형태로 렌더링한다. 정렬은 쿼리 계층(`libraryApi`) 또는 클라이언트 정렬 함수에서 수행한다.

#### REQ-LIB2-011: 각 읽는 책 BookCard + "기록하기" 버튼 (헤더 CTA 제거)

**While** REQ-LIB2-010의 렌더링이 수행되는 동안, the 클라이언트는 각 `reading` 항목마다 다음을 포함하는 `BookCard`를 표시해야 한다:

- 책 메타데이터(제목, 저자, 표지 — `books` 조인)
- 진도률(`progressRate.ts` 계산 결과, `ProgressBar` 컴포넌트)
- **"기록하기" 버튼** — 탭 시 `router.push('/emotion/[bookId]')` 로 해당 책의 감정 기록 화면으로 이동

각 BookCard의 "기록하기" 버튼은 서로 독립적이어야 하며, 어느 한 책의 기록 버튼이 다른 책의 것과 충돌하지 않아야 한다.

**헤더 CTA 제거 (사용자 합의 clarification #2 — D1 해소)**: 기존 홈 헤더의 단일 "오늘의 감정 기록하기" CTA는 **제거**한다. 감정 기록 진입은 각 BookCard의 "기록하기" 버튼으로 일원화한다. fallback CTA, "지금 읽는 책 중 선택" 다이얼로그 등의 대안 도입 없이 깔끔하게 제거한다.

#### REQ-LIB2-012: 빈 상태 분기 유지

**While** `reading` 목록이 0권인 경우 (로딩 완료 후), the 클라이언트는 기존 빈 상태 UI(예: "지금 읽는 책이 없어요" + 서재 탐색 유도 CTA)를 유지해야 한다. 빈 상태 분기 로직이 다중 reading 지원으로 인해 손상되지 않아야 한다. 로딩 중 상태(REQ-LIB2-014)와 빈 상태(본 REQ)는 서로 다른 분기여야 한다.

#### REQ-LIB2-013: 다중 스크롤 (FlatList 메모리 안전)

**Where** N이 클라우드 메모리/성능 임계치를 초과할 수 있는 환경(모바일 디바이스 다양성), the 클라이언트는 `FlatList` (또는 동등한 가상화 리스트)를 사용하여 N권의 reading 목록을 렌더링해야 한다. `contentContainerStyle` / 헤더/푸터의 `flex:1` 함정(메모리 교훈 #36)을 회피해야 하며, 스크롤이 차단되거나 헤더 높이가 0이 되는 회귀가 없어야 한다.

#### REQ-LIB2-014: 다중 reading 로딩 상태 분기 (D7 해소)

**While** `useLibrary({userId, status: 'reading'})` 쿼리가 로딩 중인 상태(`isLoading === true`)이고, the 클라이언트는 홈 화면에 로딩 스켈레톤 또는 스피너를 렌더링해야 한다. 로딩 중에는 빈 상태(0권, REQ-LIB2-012) UI가 렌더링되지 않아야 하며, 로딩 완료 후에만 실제 목록(0/1/N권)이 표시된다. 이 분기는 기존 단일 reading 환경에서 누락될 수 있었던 로딩/빈 상태 0매칭 회귀를 방지한다.

---

### REQ-LIB2-TRANSITION: 상태 전환 자동 배타 제거

**목적**: 서재(`BookDetailScreen`)에서 다른 책을 "읽기 시작"해도 기존 `reading` 책이 자동 `shelved`로 전환되지 않도록 클라이언트 동작을 정리한다.

#### REQ-LIB2-020: reading 전환 시 기존 reading 자동 shelved 금지

**When** 사용자가 서재의 특정 책을 `shelved` 또는 `completed`에서 `reading`으로 전환하면 (REQ-LIB-020 인터페이스 준수), the 클라이언트는 해당 책의 `status='reading'` UPDATE만 전송해야 한다. 같은 `user_id`의 다른 `reading` 행을 클라이언트가 자동으로 `shelved`로 만드는 추가 UPDATE를 전송하지 않아야 한다.

> 본 REQ는 DB 측 자동 배타(REQ-LIB2-001 제거)와 클라이언트 측 자동 배타(본 REQ)를 모두 제거한다. DB 트리거 제거 후에는 클라이언트가 배타 UPDATE를 보내더라도 DB가 막지 않지만, 본 REQ는 클라이언트가 그런 UPDATE를 애초에 생성하지 않도록 강제한다.

#### REQ-LIB2-021: 명시적 shelved 선택 시만 보관 이동

**When** 사용자가 특정 책을 명시적으로 "보관(shelved)" 상태로 선택하면, the 클라이언트는 해당 책의 `status='shelved'` UPDATE를 전송한다. 이 동작은 기존 REQ-LIB-023 인터페이스를 준수하되, "다른 책을 reading으로 전환했기 때문에 이 책이 자동 shelved 됨"이라는 사이드 이펙트는 발생하지 않아야 한다.

#### REQ-LIB2-022: completed 전환 기존 로직 유지

**While** 사용자가 `reading`에서 `completed`로 전환하면, the 클라이언트는 기존 `handleStatusChange` 로직(SPEC-LIBRARY-001 REQ-LIB-021)을 그대로 준수해야 한다. 본 SPEC은 completed 전환 경로를 변경하지 않는다. 회귀가 없어야 한다.

---

### REQ-LIB2-VISIBILITY: 공개 reader list 가시성 점검

**목적**: `is_public` 공개 범위가 reading 다수 보유 시에도 기존 동작을 유지함을 보장한다.

#### REQ-LIB2-030: is_public 동작 유지 — reading 다수 노출 허용

**While** 한 사용자가 N개의 `status='reading'` 행을 보유한 상태에서, the 데이터베이스의 `user_books_public` 보안 뷰는 각 행의 `is_public=true` 여부에 따라 독립적으로 노출해야 한다. 즉, N권의 reading 중 `is_public=true`인 모든 책이 Track A 독자 목록에 나타나며, `is_public=false`인 책은 숨겨진다.

> 본 REQ는 회귀 검증 항목이다. `user_books_public` 뷰의 노출 컬럼(`book_id`, `current_page`, `started_reading_at`, `user_id`)과 RLS 게이트는 본 SPEC이 변경하지 않는다 (메모리 교훈 #29).

#### REQ-LIB2-031: "대표 책" 개념 도입 안 함

**Where** reading 책이 여러 권인 공개 프로필 컨텍스트, the 시스템은 "대표 책 1권" 또는 "primary reading" 개념을 도입하지 않아야 한다 (결정 B). 모든 `is_public=true` reading 행이 동등하게 노출된다.

> 본 REQ는 미연의 범위 확장(spree)을 방지하기 위한 것이다. "대표 책" 선정 로직(가장 최근 업데이트, 진도률 순 등)은 본 SPEC의 명시적 비목표다.

---

### REQ-LIB2-REGRESSION: 회귀 보장

**목적**: 본 SPEC의 변경이 감정 기록, 진도 연동, react-query 캐시 무결성에 회귀를 일으키지 않음을 보장한다.

#### REQ-LIB2-040: 감정 기록(SPEC-EMOTION-001) 연동 정상 + 오염 부재 (D4 해소)

**While** 본 SPEC의 변경이 적용된 후, the 클라이언트의 감정 기록 플로우(`/emotion/[bookId]` 진입 → 감정 기록 저장 → `emotion_records` INSERT)가 정상 동작해야 한다. 다중 reading 컨텍스트에서 어느 한 reading 책(bookA)의 감정 기록 저장이 다른 reading 책(bookB)의 `emotion_records`에 INSERT를 유발하거나 캐시를 오염시키지 않아야 한다. 단일 reading 기존 동작이 다중 reading에서도 회귀 없이 유지되어야 한다.

#### REQ-LIB2-041: react-query invalidate 정상

**When** 감정 기록 저장 후, the 클라이언트는 `emotionRootKey(bookId, userId)` 기반의 react-query invalidate를 수행해야 한다 (메모리 교훈 #35 — queryKey 접두사 매칭). 다중 reading 컨텍스트에서 `bookId`가 다른 reading 책의 캐시를 실수로 무효화하지 않아야 한다. `useLibrary({status: 'reading'})` 쿼리 키가 감정 기록 후 올바르게 갱신되어야 한다. 본 REQ는 최근 통일된 queryKey 접두사 PR(#178)과 정렬 기준 일관성을 준수한다.

#### REQ-LIB2-042: EmotionInputScreen.onSubmit → last_progress_at 갱신 회귀 (D8 해소)

**When** 사용자가 `EmotionInputScreen`에서 감정 기록을 저장하면 (`onSubmit` 트리거), the 클라이언트는 다음 직렬 mutation 경로를 안전하게 수행해야 한다:

1. `EmotionInputScreen.onSubmit` 호출
2. `progressRate` 업데이트 (진도 변경이 수반되는 경우)
3. `user_books.last_progress_at` 갱신 (DB UPDATE)
4. `useLibraryItem(bookId)` queryKey invalidate (REQ-LIB2-041)

다중 reading 컨텍스트에서 이 직렬 mutation 경로가 **부분 실패(직렬 mutation 부분 실패, 메모리 교훈 #38)** 없이 안전하게 수행되어야 한다. 단일 reading의 기존 경로가 다중 reading에서도 회귀 없이 동작해야 하며, 특히 bookA 감정 기록 중 발생하는 `last_progress_at` 갱신이 bookB의 캐시나 상태를 침범하지 않아야 한다.

---

### REQ-LIB2-AMEND: 선행 SPEC in-place amendment (D3, D9 해소)

**목적**: SPEC-LIBRARY-001 정책 5.5 / REQ-LIB-020 / REQ-LIB-023 / 제외 범위 7의 in-place amendment를 **sync-phase**에서 수행한다 (사용자 합의 clarification #3 — D1 해소). D-NEW-1 소유권 경로: manager-docs는 본 작업 수행 금지 → blocker report 반환 → orchestrator가 manager-spec에 재위임.

#### REQ-LIB2-AMEND-001: SPEC-LIBRARY-001 body in-place amendment (sync-phase, P0)

**When** 본 SPEC-LIBRARY-002의 run-phase 구현이 완료되고 sync-phase가 시작되면, the 시스템은 sync-phase에서 SPEC-LIBRARY-001 spec.md 본문에 다음 in-place amendment를 적용해야 한다 (D-NEW-1 경로: manager-docs blocker report → orchestrator → manager-spec 재위임):

- **정책 5.5**: 제목에 `(RESCINDED by SPEC-LIBRARY-002)` 표시 + 본문에 철회 사유 ("사용자 보고: 실제 다중 reading 행동", "제품 가정 오류로 판명") 추가
- **REQ-LIB-020**: 본문 내 "정책 5.5 (reading 단일)" 각주 제거 또는 `(RESCINDED)` 표시
- **REQ-LIB-023**: 자동 shelved 배타 전환 묘사 제거, "본 SPEC-LIBRARY-002 REQ-LIB2-020 / REQ-LIB2-021 참조"로 대체
- **제외 범위 7** (예외 구문): 본 SPEC-LIBRARY-002가 스키마 변경을 주도함을 명시, 기존 예외 구문은 철회 표시
- **frontmatter**:
  - `updated:` 갱신 (sync-phase 날짜)
  - `partially_superseded_by: [SPEC-LIBRARY-002]` 추가
  - `status: completed` 유지 (in-place amendment이므로 completed → in-progress 역전환 없이 본문만 갱신 — sync-phase manager-spec 담당 허용 범위 내)

> 본 REQ는 AC-LIB2-AMEND-001의 추적성 루트다. commit subject: `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002` (D9 해소 — run-phase M4가 아닌 sync-phase에서 수행).

---

## 4. 제외 범위 (Exclusions)

본 SPEC은 다음을 포함하지 않는다.

### Out of Scope — 감정 기록 CRUD

- `emotion_records` 테이블 스키마, 감정 기록 저장/조회/삭제 로직, 스티커 반응은 SPEC-EMOTION-001이 소유한다. 본 SPEC은 `/emotion/[bookId]` 진입점 다중화까지만 담당한다.

### Out of Scope — 완독 다이어리 UI

- `completion_reports.report_data` 시각화는 SPEC-COMPLETION-001이 소유한다. 본 SPEC은 completed 전환 인터페이스를 변경하지 않는다 (REQ-LIB2-022).

### Out of Scope — Track A 독자 목록 표시 로직

- `user_books_public` 보안 뷰를 통한 타인 공개 서재 조회, "같이 읽어요" 요청 UI는 SPEC-CLUB-001이 소유한다. 본 SPEC은 `user_books_public` 뷰의 노출 컬럼/RLS 정책을 변경하지 않는다 (REQ-LIB2-030은 회귀 검증만 수행).

### Out of Scope — "대표 책" / "primary reading" 개념

- reading 다수 보유 시 "대표 책 1권" 선정 로직(진도율 순, 최근 업데이트 순 등)은 명시적 비목표다 (결정 B, REQ-LIB2-031). 본 SPEC은 모든 reading을 동등하게 취급한다.

### Out of Scope — 기존 자동 shelved 이력 데이터 복구

- 과거 `enforce_single_reading` 정책에 의해 자동 `shelved`로 전환된 이력을 역산하여 `reading`으로 되돌리는 데이터 마이그레이션은 수행하지 않는다 (가정 2.1.4). 사용자가 명시적으로 다시 "읽기 시작"해야 `reading`이 된다.

### Out of Scope — 서재 목록 정렬 기본값 변경

- SPEC-LIBRARY-001 미결정 사항 5.2(서재 정렬 기본값 — `last_progress_at` DESC 가정)은 본 SPEC이 변경하지 않는다. 홈 reading 목록의 정렬 순서는 `last_progress_at` DESC로 확정되었으나(사용자 합의 clarification #1), 서재(전체 status 뷰) 정렬은 본 SPEC 범위 밖이다.

### Out of Scope — 읽기 세션/타이머

- `reading_sessions` 테이블, 독서 세션 시간 측정은 SPEC-ROUTINE-001이 소유한다. 본 SPEC은 진도 페이지 업데이트와 상태 전환만 다룬다.

### Out of Scope — 알림·루틴 헬퍼

- 독서 알림, 루틴 타이머, 리마인더는 SPEC-NOTIF-001 / SPEC-ROUTINE-001 영역이다. 본 SPEC은 다중 reading 컨텍스트에서의 알림 정책 변경을 다루지 않는다.

### Out of Scope — run-phase M4에서의 SPEC-LIBRARY-001 body 수정

- SPEC-LIBRARY-001 body in-place amendment는 sync-phase에서만 수행한다 (사용자 합의 clarification #3). run-phase M4(공개 가시성 회귀 테스트)는 amendment를 수행하지 않으며, sync-phase에 amendment 작업을 위임할 뿐이다. run-phase 중 manager-develop이 SPEC-LIBRARY-001 body를 직접 수정하는 것은 ownership crossing 금지다.

---

## 5. 미결정 사항 (Open Questions) — D1 해소 (모두 RESOLVED)

> 본 SPEC의 미결정 사항 3종은 사용자 합의 clarification으로 모두 해소되었다 (2026-07-27). plan.md의 `[NEEDS CLARIFICATION]` 마커도 모두 제거되었다. Implementation Kickoff Approval(Plan→Run HUMAN GATE) 진입에 더 이상 clarification blocker가 없다.

### 5.1 홈 reading 목록 정렬 순서 — RESOLVED (last_progress_at DESC)

**질문**: 홈 화면의 reading 다중 목록 렌더링 시 정렬 기준은 무엇인가?

**항목**: `last_progress_at` DESC — 최근 진도 업데이트 순 (SPEC-LIBRARY-001 서재 기본값 가정과 일치)

**상태**: **RESOLVED** (사용자 합의 clarification #1, 2026-07-27). REQ-LIB2-010에 반영됨.

### 5.2 기존 "오늘의 감정 기록하기" 헤더 CTA 처리 — RESOLVED (제거)

**질문**: 기존 홈 헤더의 단일 "오늘의 감정 기록하기" CTA는 다중 reading 도입 후 어떻게 처리하는가?

**항목**: **제거** — 각 BookCard의 "기록하기" 버튼으로 대체 (REQ-LIB2-011). fallback CTA, 다이얼로그 등의 대안 없이 깔끔하게 제거.

**상태**: **RESOLVED** (사용자 합의 clarification #2, 2026-07-27). REQ-LIB2-011에 반영됨.

### 5.3 SPEC-LIBRARY-001 body in-place amendment 타이밍 — RESOLVED (sync-phase, D-NEW-1)

**질문**: SPEC-LIBRARY-001 본문(정책 5.5, REQ-LIB-020 각주, REQ-LIB-023, 제외 범위 7 예외 구문)의 in-place amendment는 어느 시점에 수행하는가?

**항목**: **sync-phase**에서 수행. ownership 매트릭스 상 sync-phase에서 SPEC-LIBRARY-001 body 수정은 manager-docs 금지(forbidden crossings) → **D-NEW-1 경로**: manager-docs blocker report → orchestrator → manager-spec 재위임.

**상태**: **RESOLVED** (사용자 합의 clarification #3, 2026-07-27). REQ-LIB2-AMEND-001에 반영됨. commit subject: `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002`.

---

## 6. 추적성 (Traceability)

| TAG | 요구사항 | 소스 |
|-----|---------|------|
| SPEC-LIBRARY-002 | REQ-LIB2-001 ~ REQ-LIB2-042, REQ-LIB2-AMEND-001 | `.moai/project/product.md`("종이책 서재 관리"), `.moai/project/tech.md`(데이터 페칭 계층), `supabase/migrations/20240630000001_enforce_single_reading_policy.sql`(철회 대상), `.moai/specs/SPEC-LIBRARY-001/spec.md`(정책 5.5 / REQ-LIB-020 / REQ-LIB-023 — amendment 대상), 사용자 보고(다중 reading 실제 행동), 사용자 결정 A/B, 사용자 합의 clarification 3종(D1 해소) |

### 하위 SPEC 의존성 (본 SPEC을 소비하는 SPEC — 회귀 범위)

| 소비자 SPEC | 소비 포인트 | 본 SPEC 영향 |
|-------------|-------------|--------------|
| SPEC-EMOTION-001 | `/emotion/[bookId]` 진입 — 다중 reading 컨텍스트, EmotionInputScreen.onSubmit → last_progress_at 경로 | 진입점 다중화, 회귀 보장 (REQ-LIB2-040, REQ-LIB2-041, REQ-LIB2-042) |
| SPEC-CLUB-001 | `user_books_public` 뷰 + `is_public` — Track A 독자 목록 | reading 다수 노출 허용 (REQ-LIB2-030) — 회귀만 |
| SPEC-COMPLETION-001 | completed 전환 — `completion_reports` | 영향 없음 (REQ-LIB2-022) — 회귀만 |

### 상위 SPEC 의존성 (본 SPEC이 소비하는 SPEC — amendment 대상)

| 공급자 SPEC | 공급 포인트 | amendment |
|-------------|-------------|-----------|
| SPEC-LIBRARY-001 | 정책 5.5 (reading 단일), REQ-LIB-020 (상태 전환 + 자동 배타 각주), REQ-LIB-023 (서재 정리), 제외 범위 7 (예외 구문) | in-place amendment (본 SPEC §HISTORY Amendments + REQ-LIB2-AMEND-001 참조 — sync-phase 수행) |
| SPEC-DB-001 | REQ-DB-003 (user_books 스키마 + 트리거 + UNIQUE), REQ-DB-015 (RLS) | 스키마 변경 본 SPEC이 주도 (migration 회수) |
| SPEC-API-001 | Supabase 클라이언트 싱글톤, gen-types | 소비만 (변경 없음) |

---

## 7. 제약 (Constraints)

### Non-Functional

- **DB 성능**: 부분 UNIQUE 인덱스 제거 후 `WHERE status='reading' AND user_id = ?` 쿼리 성능이 회귀하지 않아야 한다. 성능 회귀 관측 시 run-phase M1에서 일반 인덱스 `CREATE INDEX IF NOT EXISTS idx_user_books_user_status ON user_books(user_id, status)` 추가로 대응한다 (D11 해소, 가정 2.1.6).
- **모바일 렌더링 성능**: 홈 FlatList가 10권 이상의 reading 항목에서도 60fps 유지해야 한다 (가상화 필수).
- **회귀 안전**: SPEC-EMOTION-001, SPEC-CLUB-001, SPEC-COMPLETION-001의 기존 AC가 본 SPEC 변경 후에도 모두 PASS 해야 한다.
- **마이그레이션 가역성**: 신규 migration은 롤백 가능해야 한다 (DOWN 절 또는 rollback migration). 단, rollback 시 다시 `enforce_single_reading` 정책이 적용되므로 프로덕션 롤백은 신중해야 한다.

### Memory Lessons 준수 (강제)

본 SPEC은 다음 메모리 교훈을 강제 준수한다 (run-phase에서 검증):

- **#18**: pgTAP `throws_ok` 4-arg(errcode + errmsg + desc) — REQ-LIB2-007 (D2 해소), AC-LIB2-DB-007 검증
- **#20**: 트리거 알파벳순 실행 순서 — REQ-LIB2-006 잔여 BEFORE ROW 트리거 실행 순서 회귀 부재 검증
- **#29**: `user_books_public` 노출 — REQ-LIB2-030 회귀 검증
- **#35**: react-query queryKey 접두사 매칭 — REQ-LIB2-041 invalidate 정상 검증
- **#36**: FlatList `contentContainerStyle` flex 함정 — REQ-LIB2-013 메모리 안전 검증
- **#38**: 직렬 mutation 부분 실패 — REQ-LIB2-042 EmotionInputScreen.onSubmit 경로 회귀 검증 (D8 해소)

### 보안

- 본 SPEC은 RLS 정책을 변경하지 않는다. `auth.uid() = user_id` 조건이 그대로 유지되며, 타인 서재 접근은 기존과 동일하게 차단된다.
- `is_public` 게이트 로직 변경 없음 — 공개 노출 범위는 기존 SPEC-DB-001 REQ-DB-013e 준수.

### Ownership (D-NEW-1 경로)

- SPEC-LIBRARY-001 body in-place amendment는 sync-phase에서 manager-spec이 수행 (manager-docs 금지 — forbidden crossings).
- run-phase 중 SPEC-LIBRARY-001 body 수정 필요 발생 시, manager-develop은 즉시 작업 중지하고 blocker report 반환 → orchestrator가 manager-spec에 재위임.
- 본 SPEC SPEC-LIBRARY-002 body 수정은 plan-phase/ Mid-run inline-fix 모두 manager-spec 소관 (D-NEW-1 패턴 준수).

---

## 8. 검증 가능한 증거 (Verification Evidence Summary)

> 상세 AC는 `acceptance.md`에 SSOT로 존재한다 (총 24 AC — P0=11, P1=10, P2=2, D6/D7/D8/D10 신규 AC 포함). 본 절은 요약만 제공한다.

- **DB 마이그레이션**: `enforce_single_reading` 트리거/함수/부분 UNIQUE 인덱스 DROP — migration 적용 후 `pg_trigger` / `pg_proc` / `pg_indexes` 조회로 증명 (AC-LIB2-DB-001/002/003)
- **다중 reading 보유 회귀 (INSERT + UPDATE)**: 한 `user_id`가 3개 `reading` 행을 INSERT 후 UPDATE해서 모두 `reading`으로 유지 — pgTAP 테스트로 증명 (AC-LIB2-DB-004, D10 해소)
- **동시 INSERT 경쟁 (P0)**: 두 클라이언트가 동시에 서로 다른 책을 reading으로 INSERT해도 두 트랜잭션 모두 커밋 성공 — pgTAP `PERFORM` 기반 동시성 테스트로 증명 (AC-LIB2-DB-008, D6 해소)
- **잔여 트리거 회귀**: `on_user_books_update`가 `last_progress_at`/`completed_at`을 정상 갱신 — pgTAP 테스트로 증명 (AC-LIB2-DB-006)
- **pgTAP 품질 규약 준수**: 4-arg `throws_ok` 또는 `lives_ok` 패턴 — grep 검증 (AC-LIB2-DB-007, D2 해소)
- **UI 다중 렌더링**: 0/1/3권 reading 데이터에서 홈 화면 렌더링 스크린샷/컴포넌트 테스트 (AC-LIB2-UI-001/002/003)
- **UI 로딩 상태 분기**: useLibrary 로딩 중 스켈레톤/스피너 렌더링 — 컴포넌트 테스트 (AC-LIB2-UI-008, D7 해소)
- **헤더 CTA 제거**: 기존 헤더 "오늘의 감정 기록하기" CTA가 코드에서 제거됨 — grep 검증
- **상태 전환 비배타**: A책을 reading으로 전환해도 B책이 여전히 reading인 클라이언트 통합 테스트 (AC-LIB2-TRANS-001)
- **감정 기록 오염 부재**: bookA 감정 기록 후 bookA emotion_records만 INSERT, bookB 오염 부재 — 통합 테스트 (AC-LIB2-EMOTION-001, D4 해소)
- **EmotionInputScreen → last_progress_at 경로**: 직렬 mutation 부분 실패 없이 안전하게 수행 — 회귀 테스트 (D8 해소, REQ-LIB2-042)
- **공개 가시성 회귀**: 다중 reading + `is_public=true` N권 → Track A 노출 — 회귀 테스트 (AC-LIB2-VIS-001)
- **SPEC-LIBRARY-001 sync-phase amendment**: 정책 5.5, REQ-LIB-020, REQ-LIB-023, 제외 범위 7 갱신 — grep 검증 (AC-LIB2-AMEND-001, D3/D9 해소)
