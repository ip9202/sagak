---
id: SPEC-LIBRARY-002
title: "Parallel Reading Support (다중 독서 병행) — Acceptance Criteria"
version: "0.2.0"
status: draft
created: 2026-07-27
updated: 2026-07-27
author: "강력쇠주먹"
priority: P1
phase: "v1.3.0"
module: "src/features/library, supabase/migrations, app/(tabs)"
lifecycle: spec-anchored
tags: "library, parallel-reading, multi-book, db-migration, home-ui, status-transition, public-visibility, amendment"
tier: M
---

# SPEC-LIBRARY-002 — Acceptance Criteria

> 본 문서는 SPEC-LIBRARY-002의 AC (Acceptance Criteria) SSOT다. 모든 AC는 정량적이고 검증 가능해야 한다. Given-When-Then 시나리오 + edge cases + quality gate criteria + Definition of Done 구조.
>
> **v0.2.0 (2026-07-27) 개정**: plan-auditor iter1 FAIL (0.79) 해소. 사용자 합의 clarification 3종 (D1) 반영. 결함 D2-D11 해소 — 신규 AC 4종 추가 (AC-LIB2-DB-008 동시 INSERT 경쟁, AC-LIB2-UI-008 로딩 분기, AC-LIB2-EMOTION-001 감정 오염 부재), 기존 AC 확장 2종 (AC-LIB2-DB-004 INSERT+UPDATE, AC-LIB2-AMEND-001 sync-phase 정정). 총 AC 24건.

---

## §A AC Matrix Summary

| AC ID | 범주 | 대상 REQ | 심각도 (P0/P1/P2) | 검증 방식 |
|-------|------|---------|-------------------|-----------|
| AC-LIB2-DB-001 | DB | REQ-LIB2-001 | P0 | pg_trigger 조회 |
| AC-LIB2-DB-002 | DB | REQ-LIB2-002 | P0 | pg_proc 조회 |
| AC-LIB2-DB-003 | DB | REQ-LIB2-003 | P0 | pg_indexes 조회 |
| AC-LIB2-DB-004 | DB | REQ-LIB2-004 | P0 | pgTAP INSERT + UPDATE 회귀 (D10 해소) |
| AC-LIB2-DB-005 | DB | REQ-LIB2-005 | P0 | pgTAP completed/shelved 회귀 |
| AC-LIB2-DB-006 | DB | REQ-LIB2-006 | P0 | pgTAP 트리거 실행 순서 |
| AC-LIB2-DB-007 | DB | REQ-LIB2-007 (D2 해소) | P1 | pgTAP 4-arg throws_ok / lives_ok 준수 |
| AC-LIB2-DB-008 | DB | REQ-LIB2-008 (D6 해소 — P0 승격) | P0 | pgTAP 동시 INSERT 경쟁 |
| AC-LIB2-UI-001 | UI | REQ-LIB2-010, 012 | P1 | 컴포넌트 테스트 — 0권 빈 상태 |
| AC-LIB2-UI-002 | UI | REQ-LIB2-010 | P1 | 컴포넌트 테스트 — 1권 렌더링 |
| AC-LIB2-UI-003 | UI | REQ-LIB2-010, 013 | P1 | 컴포넌트 테스트 — 3권 다중 렌더링 |
| AC-LIB2-UI-004 | UI | REQ-LIB2-011 | P1 | 통합 테스트 — "기록하기" 버튼 네비게이션 |
| AC-LIB2-UI-005 | UI | REQ-LIB2-013 | P1 | 컴포넌트 테스트 — FlatList 메모리 안전 |
| AC-LIB2-UI-006 | UI | REQ-LIB2-041 | P1 | 통합 테스트 — queryKey invalidate |
| AC-LIB2-UI-007 | UI | REQ-LIB2-041 (D5 해소) | P2 | 코드 점검 — status 기본값 주석 정정 |
| AC-LIB2-UI-008 | UI | REQ-LIB2-014 (D7 해소) | P1 | 컴포넌트 테스트 — 로딩 중 스켈레톤/스피너 |
| AC-LIB2-UI-009 | UI | REQ-LIB2-011 (헤더 CTA 제거) | P1 | grep 검증 — 헤더 CTA 컴포넌트 제거 |
| AC-LIB2-TRANS-001 | Transition | REQ-LIB2-020 | P0 | 통합 테스트 — 비배타 전환 |
| AC-LIB2-TRANS-002 | Transition | REQ-LIB2-021 | P1 | 통합 테스트 — 명시적 shelved |
| AC-LIB2-TRANS-003 | Transition | REQ-LIB2-022 | P0 | 통합 테스트 — completed 회귀 부재 |
| AC-LIB2-VIS-001 | Visibility | REQ-LIB2-030 | P1 | pgTAP 가시성 회귀 |
| AC-LIB2-VIS-002 | Visibility | REQ-LIB2-031 | P2 | 코드 점검 — "대표 책" 부재 |
| AC-LIB2-EMOTION-001 | Emotion | REQ-LIB2-040, 042 (D4 해소) | P0 | 통합 테스트 — 감정 기록 오염 부재 + 직렬 mutation 안전 |
| AC-LIB2-AMEND-001 | SPEC 합의 | REQ-LIB2-AMEND-001 (D3, D9 해소) | P0 | SPEC-LIBRARY-001 sync-phase amendment 점검 |

**P0 (must-pass)**: 11건 (DB 7건 — 001/002/003/004/005/006/008, TRANSITION 2건, EMOTION 1건, AMEND 1건)
**P1 (should-pass)**: 11건 (DB 007, UI 8건, TRANSITION 002, VIS 001)
**P2 (nice-to-have)**: 2건 (UI 007, VIS 002)
**총 AC**: 24건

---

## §B DB Acceptance Criteria (Given-When-Then)

### AC-LIB2-DB-001: enforce_single_reading 트리거 DROP (P0)

**Given** `user_books` 테이블에 과거 `enforce_single_reading` BEFORE INSERT OR UPDATE OF status 트리거가 존재했고

**When** 본 SPEC의 신규 migration `{YYYYMMDD}_drop_enforce_single_reading.sql`이 `supabase migration up --linked`로 적용된 후

**Then** 다음 쿼리가 0행을 반환해야 한다:

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'user_books'::regclass
  AND tgname = 'enforce_single_reading';
```

**Evidence**: 쿼리 결과 row count = 0. 마이그레이션 로그에 DROP TRIGGER 성공 명시.

---

### AC-LIB2-DB-002: enforce_single_reading 함수 DROP (P0)

**Given** 과거 `enforce_single_reading()` 함수가 `pg_proc`에 존재했고

**When** 본 SPEC의 신규 migration 적용 후

**Then** 다음 쿼리가 0행을 반환해야 한다:

```sql
SELECT proname FROM pg_proc WHERE proname = 'enforce_single_reading';
```

**Evidence**: row count = 0.

---

### AC-LIB2-DB-003: user_books_one_reading_per_user 부분 UNIQUE 인덱스 DROP (P0)

**Given** 과거 부분 UNIQUE 인덱스 `user_books_one_reading_per_user ON (user_id) WHERE status='reading'`가 존재했고

**When** 본 SPEC의 신규 migration 적용 후

**Then** 다음 쿼리가 0행을 반환해야 한다:

```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'user_books'
  AND indexname = 'user_books_one_reading_per_user';
```

**Evidence**: row count = 0.

---

### AC-LIB2-DB-004: 한 사용자 다중 reading 보유 회귀 — INSERT + UPDATE 양쪽 (P0, D10 해소)

**Given** `auth.uid() = <test-user>`인 인증 컨텍스트에서 `user_books`에 3개의 서로 다른 `book_id` 행이 있고

**When** 다음 (a) INSERT 및 (b) UPDATE 시퀀스를 실행할 때:

```sql
-- (a) INSERT 시나리오 (D10 해소 — 초기 INSERT 경로)
INSERT INTO user_books (user_id, book_id, status) VALUES
  (<test-user>, <book-1>, 'reading'),
  (<test-user>, <book-2>, 'reading'),
  (<test-user>, <book-3>, 'reading');

-- (b) UPDATE 시나리오 (기존 v0.1.0)
-- 이미 shelved/completed 상태인 3개 행을 모두 reading으로 전환
UPDATE user_books SET status='reading'
WHERE user_id = <test-user> AND book_id IN (<book-1>, <book-2>, <book-3>);
```

**Then** (a)와 (b) 모두에서 3개 행이 `status='reading'`이어야 하며, `23505 unique_violation` 예외가 발생하지 않아야 한다:

```sql
SELECT book_id, status FROM user_books
WHERE user_id = <test-user> AND status='reading';
-- Expected: 3 rows, 모두 status='reading' (INSERT 및 UPDATE 양쪽 시나리오에서)
```

**Evidence**: pgTAP 테스트 `drop_enforce_single_reading.sql`의 `ok(...)` 출력:
- `ok N - parallel reading preserved (INSERT)` (D10)
- `ok N+1 - parallel reading preserved (UPDATE)`

---

### AC-LIB2-DB-005: completed / shelved 기존 동작 유지 (P0)

**Given** M1 migration 적용 후이고

**When** 다음 상태 전환을 실행할 때:

```sql
-- (a) reading → completed
UPDATE user_books SET status='completed'
WHERE user_id = <test-user> AND book_id = <book-X>;
-- (b) reading → shelved
UPDATE user_books SET status='shelved'
WHERE user_id = <test-user> AND book_id = <book-Y>;
```

**Then**:

- (a) `completed_at`이 `now()`로 자동 설정됨 (`on_user_books_update` 트리거)
- (a) `completion_reports` 행이 자동 생성됨 (해당 트리거, `ON CONFLICT DO NOTHING` 멱등)
- (b) `status='shelved'`로 전환됨, 서재 목록 필터링 동작 유지
- CHECK 제약 위반 없음 (`status IN ('reading','completed','shelved')`)
- `UNIQUE(user_id, book_id)` 여전히 유효 — 동일 책 중복 등록 시 409 Conflict

**Evidence**: pgTAP 테스트 — 각 전환 후 `ok(...)` 출력.

---

### AC-LIB2-DB-006: 잔여 BEFORE ROW 트리거 실행 순서 회귀 부재 (P0, 메모리 #20)

**Given** `enforce_single_reading` 트리거가 DROP되어 잔여 BEFORE 트리거가 `on_user_books_update`만 남은 상태이고

**When** 다음 쿼리로 잔여 BEFORE ROW 트리거의 알파벳순 순서를 확인할 때:

```sql
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'user_books'::regclass
  AND (tgtype & 1) = 0  -- BEFORE row trigger
  AND tgenabled = 'O'
ORDER BY tgname;
```

**Then**:

- `on_user_books_update` 가 가장 먼저 실행되는 BEFORE ROW 트리거여야 함 (알파벳순)
- `current_page` UPDATE 시 `last_progress_at`이 `now()`로 자동 갱신됨
- `status='completed'` UPDATE 시 `completed_at`이 자동 갱신됨

**Evidence**: pgTAP 테스트 — `last_progress_at`, `completed_at` 갱신 입증용 `ok(...)` 출력.

---

### AC-LIB2-DB-007: pgTAP throws_ok 4-arg / lives_ok 패턴 준수 (P1, 메모리 #18, REQ-LIB2-007, D2 해소)

**대상 REQ**: REQ-LIB2-007 (pgTAP 품질 규약 준수) — D2 해소: 본 AC는 더 이상 "(메모리 #18)"만 참조하지 않고 명시적 REQ-LIB2-007에 매핑된다.

**Given** pgTAP 테스트 `drop_enforce_single_reading.sql`이 회수 후 예외 발생하지 않음을 검증할 때

**When** 예외 검증 테스트를 작성하면

**Then** `throws_ok(SQL, errcode, errmsg, description)` 4-arg 패턴 또는 `lives_ok(SQL, description)` 패턴을 준수해야 한다 (3-arg `throws_ok` 금지):

```sql
-- 올바른 패턴 (4-arg throws_ok — 회수 전 동작 검증 시)
throws_ok(
  'UPDATE user_books SET status=''reading'' WHERE user_id = ''<test>'' AND book_id IN (...)',
  '23505',  -- errcode
  'unique_violation',  -- errmsg
  '부분 UNIQUE 인덱스 제거 후 다중 reading INSERT 허용'  -- description
);

-- 또는 lives_ok 로 회수 후 정상 동작 입증 (REQ-LIB2-004, D10 INSERT/UPDATE 양쪽)
lives_ok(
  'INSERT INTO user_books (user_id, book_id, status) VALUES (...)',
  '다중 reading INSERT 허용'
);
```

**Evidence**: `grep -n "throws_ok\|lives_ok" supabase/tests/*.sql` 결과가 4-arg throws_ok 또는 lives_ok 패턴만 매칭 (3-arg throws_ok 0매칭).

---

### AC-LIB2-DB-008: 동시 INSERT 경쟁 시나리오 (P0, D6 해소 — 선택적 → 필수 P0 승격)

**대상 REQ**: REQ-LIB2-008 (동시 INSERT 경쟁 허용)

**Given** 두 클라이언트(또는 두 데이터베이스 세션)가 동시에 같은 `<test-user>`로 서로 다른 책을 `status='reading'`으로 INSERT하는 경쟁 조건(race condition) 환경이고

**When** 병렬 INSERT 트랜잭션이 다음과 같이 실행될 때:

```sql
-- 세션 A
BEGIN;
INSERT INTO user_books (user_id, book_id, status)
VALUES (<test-user>, <book-A>, 'reading');
COMMIT;

-- 세션 B (동시 실행)
BEGIN;
INSERT INTO user_books (user_id, book_id, status)
VALUES (<test-user>, <book-B>, 'reading');
COMMIT;
```

**Then**:

- 두 INSERT 모두 성공적으로 커밋됨
- `23505 unique_violation` 예외 발생하지 않음
- 직렬화 실패(serialization failure) 발생하지 않음
- 두 reading 행이 모두 존재함:

```sql
SELECT book_id, status FROM user_books
WHERE user_id = <test-user> AND status='reading';
-- Expected: 2 rows (book-A, book-B 모두 reading)
```

**Evidence**: pgTAP `PERFORM` 기반 동시성 테스트 — `ok N - concurrent INSERT both committed` 출력.

**비고**: v0.1.0에서는 "선택적"으로 분류되었으나, v0.2.0에서 다중 reading 보장을 위해 **필수 P0 검증 항목으로 승격** (D6 해소).

---

## §C UI Acceptance Criteria

### AC-LIB2-UI-001: reading 0권 빈 상태 렌더링 (P1)

**Given** 인증된 사용자의 `user_books`에 `status='reading'`인 행이 0개이고 (로딩 완료 후)

**When** 사용자가 홈 탭(`app/(tabs)/index.tsx`)에 진입하면

**Then**:

- 빈 상태 UI가 렌더링됨 ("지금 읽는 책이 없어요" 등 기존 메시지)
- 서재 탐색 유도 CTA가 표시됨 (기존 동작 유지)
- 헤더 "오늘의 감정 기록하기" CTA는 렌더링되지 않음 (사용자 합의 #2)
- 자바스크립트 오류/크래시 없음

**Evidence**: 컴포넌트 테스트 `HomeMultiReading.test.tsx` — 0권 fixture로 렌더링 시 빈 상태 텍스트 매칭.

---

### AC-LIB2-UI-002: reading 1권 렌더링 (P1)

**Given** 인증된 사용자의 `user_books`에 `status='reading'`인 행이 1개이고

**When** 홈 탭에 진입하면

**Then**:

- 단일 BookCard가 렌더링됨 (제목/저자/표지/진도률 포함)
- "기록하기" 버튼이 표시됨
- 다중 FlatList의 N=1 경우로 자연스럽게 처리됨 (특수 분기 없이)
- 헤더 CTA는 렌더링되지 않음

**Evidence**: 컴포넌트 테스트 — 1권 fixture 렌더링, BookCard 1개 + "기록하기" 버튼 1개 매칭.

---

### AC-LIB2-UI-003: reading N권 다중 렌더링 (P1, last_progress_at DESC 정렬)

**Given** 인증된 사용자의 `user_books`에 `status='reading'`인 행이 3개이고 (서로 다른 `last_progress_at` 값을 가짐)

**When** 홈 탭에 진입하면

**Then**:

- 3개의 BookCard가 목록 형태로 렌더링됨
- **정렬 순서: `last_progress_at` DESC** (사용자 합의 clarification #1 — 가장 최근 진도 업데이트된 책이 최상단)
- 각 BookCard에 독립된 "기록하기" 버튼이 표시됨
- 각 버튼의 `onPress`가 서로 다른 `bookId`를 `/emotion/[bookId]`로 전달
- 헤더 CTA는 렌더링되지 않음

**Evidence**: 컴포넌트 테스트 — 3권 fixture(`last_progress_at` 역순) 렌더링, BookCard 3개가 `last_progress_at` DESC 순서로 렌더링됨을 입증, 버튼 3개의 `key`/`testID` 고유.

---

### AC-LIB2-UI-004: "기록하기" 버튼 네비게이션 (P1)

**Given** 홈에 다중 reading BookCard가 렌더링된 상태이고

**When** 사용자가 특정 BookCard의 "기록하기" 버튼을 탭하면

**Then**:

- `router.push('/emotion/[bookId]')` 호출 — `bookId`는 해당 BookCard의 책 ID
- 다른 BookCard의 `bookId`와 충돌하지 않음
- 감정 기록 화면이 해당 책 컨텍스트로 로드됨

**Evidence**: 통합 테스트 — `useRouter` mock으로 `push` 호출 인자 검증, `bookId` 파라미터 일치.

---

### AC-LIB2-UI-005: FlatList 메모리 안전 (P1, 메모리 #36)

**Given** 다중 reading 목록이 10권 이상인 환경이고 (가상의 대량 데이터 fixture)

**When** 홈 FlatList를 렌더링하면

**Then**:

- `contentContainerStyle={{ flex: 1 }}` 사용 금지 (코드 점검)
- 헤더/푸터 `flex: 1` 사용 금지
- 스크롤이 차단되지 않음
- 헤더 높이가 0이 되는 회귀 부재

**Evidence**:

- 코드 점검: `grep -n "flex: 1\|flex:1" app/\(tabs\)/index.tsx src/features/library/` — FlatList 관련 컴포넌트에서 0 매칭
- 컴포넌트 테스트: 10권 fixture에서 스크롤 가능/불가 상태 입증

---

### AC-LIB2-UI-006: queryKey invalidate 정상 (P1, 메모리 #35)

**Given** 다중 reading 컨텍스트에서 감정 기록 저장 후이고

**When** react-query invalidate가 실행될 때

**Then**:

- `emotionRootKey(bookId, userId)` 기반 invalidate가 해당 `bookId`의 캐시만 무효화
- 다른 reading 책의 `bookId` 캐시를 침범하지 않음
- `useLibrary({status: 'reading'})` 쿼리 키가 감정 기록 후 올바르게 갱신됨 (필요 시)

**Evidence**: 통합 테스트 — N개 reading 환경에서 bookA 감정 기록 → bookA 캐시 무효화, bookB 캐시 유지 입증. PR #178 (queryKey 통일) 정렬 기준 준수.

---

### AC-LIB2-UI-007: status 기본값 'shelved' 주석 정정 (P2, D5 해소 — REQ-LIB2-041 매핑)

**대상 REQ**: REQ-LIB2-041 (react-query invalidate 정상) — D5 해소: 본 AC는 더 이상 "(메모리 #35)"만 참조하지 않고 명시적 REQ-LIB2-041에 매핑된다. 본 AC는 useLibrary.ts 주석 갱신을 통한 다중 reading 인터페이스 정규화를 검증한다.

**Given** `src/features/library/useLibrary.ts`에 기존 정책 5.5 언급 주석이 있고

**When** M2 마일스톤 완료 후

**Then**:

- 정책 5.5 언급 제거 또는 "(RESCINDED by SPEC-LIBRARY-002)" 표시
- 다중 reading 지원 명시
- status 기본값 `'shelved'` 유지 (변경 없음) 명시
- queryKey 접두사 일관성(`emotionRootKey`) 명시

**Evidence**: 코드 점검 — `grep -n "정책 5.5\|policy 5.5" src/features/library/useLibrary.ts` 결과가 0 또는 RESCINDED 표식.

---

### AC-LIB2-UI-008: useLibrary 로딩 중 스켈레톤/스피너 렌더링 (P1, D7 해소, REQ-LIB2-014)

**대상 REQ**: REQ-LIB2-014 (다중 reading 로딩 상태 분기)

**Given** `useLibrary({userId, status: 'reading'})` 쿼리가 로딩 중인 상태 (`isLoading === true`, 아직 데이터 없음) 이고

**When** 홈 탭에 진입하면

**Then**:

- 로딩 스켈레톤 또는 스피너가 렌더링됨
- 빈 상태(0권, REQ-LIB2-012) UI가 렌더링되지 않음 — 로딩 중과 빈 상태는 서로 다른 분기
- 로딩 완료(`isLoading === false`) 후 실제 목록(0/1/N권) 렌더링
- 로딩 중 자바스크립트 오류/크래시 없음

**Evidence**: 컴포넌트 테스트 `HomeMultiReading.test.tsx`:
- `isLoading: true` fixture로 렌더링 시 스켈레톤/스피너 텍스트(`testID="loading-skeleton"` 또는 `activity-indicator`) 매칭
- 빈 상태 텍스트("지금 읽는 책이 없어요")가 매칭되지 않음
- `isLoading: false` + 빈 데이터 fixture에서 빈 상태로 전환됨

---

### AC-LIB2-UI-009: 헤더 "오늘의 감정 기록하기" CTA 컴포넌트 제거 (P1, 사용자 합의 #2)

**대상 REQ**: REQ-LIB2-011 (헤더 CTA 제거)

**Given** v0.1.0 코드베이스에 홈 헤더 "오늘의 감정 기록하기" CTA가 존재했고

**When** M2 마일스톤 완료 후

**Then**:

- 헤더 "오늘의 감정 기록하기" CTA 컴포넌트가 `app/(tabs)/index.tsx`에서 제거됨
- fallback CTA, "지금 읽는 책 중 선택" 다이얼로그 등의 대안 컴포넌트가 도입되지 않음
- 감정 기록 진입은 각 BookCard의 "기록하기" 버튼으로 일원화됨

**Evidence**:

```bash
grep -c "오늘의 감정 기록하기\|헤더 CTA\|HeaderCTA" app/\(tabs\)/index.tsx
# Expected: 0 매칭
```

---

## §D Transition Acceptance Criteria

### AC-LIB2-TRANS-001: reading 전환 시 기존 reading 자동 shelved 부재 (P0)

**Given** 사용자가 이미 reading 책 A를 보유하고 (`user_id=X, book_id=A, status='reading'`)

**When** 서재에서 다른 책 B를 `shelved`/`completed`에서 `reading`으로 전환 (`status='reading'` UPDATE 전송)

**Then**:

- 책 B의 `status='reading'` UPDATE만 전송됨 (클라이언트 측)
- 책 A의 `status`가 자동으로 `shelved`로 변경되지 않음 (DB 회귀 — AC-LIB2-DB-001과 중복 검증)
- 책 A의 `last_progress_at`이 이 전환으로 갱신되지 않음

**Evidence**: 통합 테스트 — A/B fixture에서 B reading 전환 후 A.status 여전히 'reading' 입증.

---

### AC-LIB2-TRANS-002: 명시적 shelved 선택 시만 보관 이동 (P1)

**Given** 사용자가 reading 책 A를 보유하고

**When** 사용자가 책 A를 명시적으로 "보관"으로 선택 (`status='shelved'` UPDATE 전송)

**Then**:

- 책 A의 `status='shelved'`가 적용됨
- 다른 reading 책은 영향받지 않음
- 기존 REQ-LIB-023 인터페이스 준수

**Evidence**: 통합 테스트 — A 명시적 shelved 후 A.status='shelved', B.status='reading' 유지.

---

### AC-LIB2-TRANS-003: completed 전환 기존 로직 회귀 부재 (P0)

**Given** 사용자가 reading 책을 보유하고

**When** `handleStatusChange('completed')` 실행 (기존 SPEC-LIBRARY-001 REQ-LIB-021 로직)

**Then**:

- `status='completed'` UPDATE 전송
- `completed_at` 자동 설정 (DB 트리거, AC-LIB2-DB-005와 중복)
- `completion_reports` 자동 생성 (멱등)
- 기존 SPEC-LIBRARY-001 / SPEC-COMPLETION-001 AC가 여전히 PASS

**Evidence**: 회귀 테스트 — completed 전환 후 기존 AC-LIB-021 / AC-COMPLETION-* 매트릭스 통과.

---

## §E Visibility Acceptance Criteria

### AC-LIB2-VIS-001: is_public reading 다수 노출 허용 (P1, 메모리 #29)

**Given** 사용자가 3개의 `status='reading'` 행을 보유하고 그 중 2개가 `is_public=true`, 1개가 `is_public=false`이고

**When** 타인이 `user_books_public` 보안 뷰를 통해 해당 사용자의 공개 reading을 조회하면

**Then**:

- `is_public=true`인 2개의 reading 행이 노출됨
- `is_public=false`인 1개의 행은 숨겨짐
- 노출 컬럼: `book_id`, `current_page`, `started_reading_at`, `user_id` (기존 스키마 준수)
- RLS 게이트 정상 동작 (auth.uid() ≠ user_id인 타인 조회)

**Evidence**: pgTAP 가시성 회귀 테스트 `multi_reading_visibility.sql` — `user_books_public` 조회 행 수 = 2.

---

### AC-LIB2-VIS-002: "대표 책" 개념 부재 (P2)

**Given** reading 다수 보유 공개 프로필 컨텍스트이고

**When** 본 SPEC의 변경을 코드 점검하면

**Then**:

- "대표 책", "primary reading", "primary book" 개념 도입 부재
- 단일 "지금 읽는 책" 선택 로직 부재
- 모든 reading이 동등하게 처리됨

**Evidence**: 코드 점검 — `grep -rn "대표 책\|primary reading\|primary book\|pickCurrentBook" src/ supabase/` 결과 0 (또는 기존 `pickCurrentBook`이 M2에서 제거됨).

---

## §F Emotion Acceptance Criteria

### AC-LIB2-EMOTION-001: 다중 reading 컨텍스트 감정 기록 오염 부재 + 직렬 mutation 안전 (P0, D4, D8 해소)

**대상 REQ**: REQ-LIB2-040 (감정 기록 연동 정상 + 오염 부재), REQ-LIB2-042 (EmotionInputScreen.onSubmit → last_progress_at 갱신 회귀)

**Given** 인증된 사용자가 2개의 reading 책을 보유한 다중 reading 컨텍스트 (`user_id=X, bookA status='reading', bookB status='reading'`, 서로 다른 `book_id`) 이고

**When** 사용자가 `EmotionInputScreen`에서 bookA 감정 기록을 저장 (`onSubmit` 트리거 → 직렬 mutation: emotion_records INSERT → progressRate 업데이트 → user_books.last_progress_at 갱신 → useLibraryItem(bookA) invalidate)

**Then**:

- **(a) 오염 부재**: `emotion_records`에 bookA의 감정 기록 행만 INSERT됨 — bookB의 `emotion_records`에 새 행이 INSERT되지 않음
- **(b) 캐시 침범 부재**: `useLibraryItem(bookA)` invalidate가 bookB의 react-query 캐시를 무효화하지 않음 (`emotionRootKey(bookA, userId)` 접두사 매칭, 메모리 #35)
- **(c) last_progress_at 안전**: `user_books.last_progress_at` 갱신이 bookA 행에만 적용됨 — bookB의 `last_progress_at`이 이 작업으로 갱신되지 않음
- **(d) 직렬 mutation 부분 실패 부재** (메모리 #38, D8 해소): `onSubmit` → progressRate → last_progress_at → invalidate 직렬 경로가 중간 단계에서 부분 실패하지 않고 안전하게 완료됨
- **(e) 다중 reading 유지**: 감정 기록 저장 후에도 bookA, bookB 모두 여전히 `status='reading'` 임 (자동 상태 전환 부재)
- **(f) 단일 reading 기존 동작 회귀 부재**: bookB가 없는 단일 reading 환경에서 기존 EmotionInputScreen 플로우가 회귀 없이 정상 동작함

**Evidence**: 통합 테스트 `MultiReadingTransition.test.tsx` 또는 `EmotionInputScreenMultiReading.test.tsx`:

```sql
-- 검증 쿼리
SELECT book_id, COUNT(*) FROM emotion_records
WHERE user_id = <test-user> GROUP BY book_id;
-- Expected: bookA 행만 존재, bookB 행은 이 작업 전과 동일
```

```typescript
// 통합 테스트 시나리오
const { bookA, bookB } = setupMultiReadingContext(testUser);
await renderEmotionInputScreen(bookA);
await triggerEmotionSubmit({ emotion: 'happy', progressDelta: 5 });

expect(emotionRecordsFor(bookA)).toHaveLength(1);  // (a)
expect(emotionRecordsFor(bookB)).toHaveLength(0);  // (a) 오염 부재
expect(queryCache.get(emotionRootKey(bookB.userId, bookB.id))).toBeDefined();  // (b) bookB 캐시 유지
expect(userBooks[bookA].last_progress_at).toBeGreaterThan(previousTimestamp);  // (c)
expect(userBooks[bookB].last_progress_at).toEqual(previousTimestamp);  // (c) bookB 침범 부재
// (d) onSubmit mutation이 reject되지 않고 성공적으로 완료됨
expect(onSubmitResult).toEqual({ status: 'success' });
```

**비고**: 본 AC는 D4(오염 부재)와 D8(직렬 mutation 안전)를 통합 검증한다. 메모리 교훈 #35(queryKey 접두사), #38(직렬 mutation 부분 실패)을 모두 준수한다. PR #178(queryKey 통일) 정렬 기준 준수.

---

## §G SPEC Amendment Acceptance Criteria

### AC-LIB2-AMEND-001: SPEC-LIBRARY-001 body in-place amendment — sync-phase 수행 (P0, D3, D9 해소)

**대상 REQ**: REQ-LIB2-AMEND-001 (sync-phase amendment) — D3 해소: 본 AC는 더 이상 HISTORY §Amendments만 참조하지 않고 명시적 REQ-LIB2-AMEND-001에 매핑된다. D9 해소: amendment는 **sync-phase**에서 수행 (run-phase M4가 아님).

**Given** 본 SPEC-LIBRARY-002의 run-phase 구현(M1~M4)이 완료되고 sync-phase(M5)가 시작된 상태이고

**When** sync-phase에서 SPEC-LIBRARY-001 in-place amendment가 **D-NEW-1 경로**(manager-docs blocker report → orchestrator → manager-spec 재위임)를 통해 수행되면

**Then** SPEC-LIBRARY-001 spec.md에 다음 변경이 적용되어야 한다:

- **정책 5.5**: 제목에 `(RESCINDED by SPEC-LIBRARY-002)` 표시 + 본문에 철회 사유 ("사용자 보고: 실제 다중 reading 행동", "제품 가정 오류로 판명") 추가
- **REQ-LIB-020**: 본문 내 "정책 5.5 (reading 단일)" 각주 제거 또는 `(RESCINDED)` 표시
- **REQ-LIB-023**: 자동 shelved 배타 전환 묘사 제거, "본 SPEC-LIBRARY-002 REQ-LIB2-020 / REQ-LIB2-021 참조"로 대체
- **제외 범위 7** (예외 구문): 본 SPEC-LIBRARY-002가 스키마 변경을 주도함을 명시, 기존 예외 구문은 철회 표시
- **frontmatter**:
  - `updated:` 갱신 (sync-phase 날짜)
  - `partially_superseded_by: [SPEC-LIBRARY-002]` 추가
  - `status: completed` 유지 (in-place amendment이므로 completed → in-progress 역전환 없이 본문만 갱신 — sync-phase manager-spec 담당 허용 범위 내)

**Evidence**:

- `grep -n "RESCINDED by SPEC-LIBRARY-002" .moai/specs/SPEC-LIBRARY-001/spec.md` ≥ 1 매칭
- `grep -n "partially_superseded_by" .moai/specs/SPEC-LIBRARY-001/spec.md` 1 매칭
- SPEC-LIBRARY-002 `amendment_of: SPEC-LIBRARY-001` 쌍방향 참조 완료

**ownership 경로 (D-NEW-1, 사용자 합의 #3 — D9 해소)**:
- **sync-phase**에서 수행 (run-phase M4가 아님).
- manager-docs가 본 작업 시도 시 forbidden crossings 위반 → blocker report 반환
- orchestrator가 manager-spec에 재위임하여 수행 (manager-spec은 amendment authoring 소관)
- manager-develop은 run-phase M4에서 SPEC-LIBRARY-001 body를 직접 수정하지 않음 (ownership crossing 금지, B9)

**commit subject (D9 해소)**: `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002`

---

## §H Edge Cases

### Edge 1: 동시 다중 reading INSERT 경쟁 (race condition) — 필수 P0 승격 (D6 해소)

**시나리오**: 두 클라이언트(또는 두 데이터베이스 세션)가 동시에 같은 사용자로 서로 다른 책을 `status='reading'`으로 INSERT하는 경우.

**기대 동작**: 부분 UNIQUE 인덱스 제거 후 두 INSERT 모두 성공. 경쟁 조건으로 인한 `unique_violation` 없음.

**검증 (필수 P0 — v0.1.0 "선택적"에서 승격)**: pgTAP `PERFORM` 기반 동시성 테스트 (AC-LIB2-DB-008, REQ-LIB2-008). 두 세션의 병렬 INSERT가 모두 커밋됨을 입증.

### Edge 2: rollback migration 테스트

**시나리오**: M1 신규 migration을 rollback하는 경우.

**기대 동작**: rollback migration이 트리거/함수/인덱스를 재생성하여 다시 단일 reading 정책이 적용됨. 단, rollback 시 기존 다중 reading 데이터가 자동으로 정리되지는 않음 (운영자 수동 개입 필요). 조건부 일반 인덱스(D11)가 추가된 경우 rollback migration에 DROP INDEX 포함 필요.

**검증**: rollback migration 존재 여부 (선택적 — Tier M에서는 필수 아님).

### Edge 3: 읽기 중 0권 → 1권 전환 라이브

**시나리오**: 사용자가 홈을 보고 있는 동안 백그라운드에서 다른 디바이스가 책을 `reading`으로 전환한 경우 (realtime 동기화).

**기대 동작**: react-query 캐시가 갱신되어 0권 빈 상태에서 1권 BookCard로 자연스럽게 전환됨. 로딩 상태(REQ-LIB2-014)를 거쳐 전환됨.

**검증**: 통합 테스트 — query invalidation 후 렌더링 업데이트.

### Edge 4: 대량 reading (N=20) 성능

**시나리오**: 독서 매니아 사용자가 20권의 reading을 보유한 경우.

**기대 동작**: FlatList 가상화로 60fps 유지, 메모리 사용량 선형 증가 (지수 아님).

**검증**: 실기기 성능 프로파일링 (선택적).

### Edge 5: 부분 UNIQUE 제거 후 쿼리 성능 회귀 (D11)

**시나리오**: 부분 UNIQUE 인덱스(`user_books_one_reading_per_user`) 제거 후 `WHERE status='reading' AND user_id = ?` 쿼리 성능이 회귀하는 경우.

**기대 동작**: 쿼리 성능 회귀 관측 시 run-phase M1에서 조건부 일반 인덱스 `CREATE INDEX IF NOT EXISTS idx_user_books_user_status ON user_books(user_id, status)` 추가로 대응.

**검증 (조건부)**: `EXPLAIN ANALYZE SELECT * FROM user_books WHERE user_id = ? AND status = 'reading'` 실행 계획에서 Seq Scan 발생 시 일반 인덱스 추가. 성능 회귀가 없으면 일반 인덱스 추가는 선택적.

---

## §I Quality Gate Criteria

### §I.1 TRUST 5 준수

| 차원 | 기준 | 검증 |
|------|------|------|
| Tested | 변경 패키지 coverage ≥ 85% | `npm test -- --coverage src/features/library src/features/book supabase/tests/drop_enforce_single_reading.sql` |
| Readable | 한국어 코드 주석 (`code_comments: ko`), 명확한 네이밍 | 코드 점검 |
| Unified | ESLint + Prettier 통과 | `npm run lint`, `npm run format:check` |
| Secured | RLS 정책 변경 없음, auth.uid() 게이트 유지 | pgTAP RLS 회귀 테스트 |
| Trackable | Conventional Commits (한국어 본문 허용), SPEC-ID 참조 | git log 점검 |

### §I.2 Memory Lessons 검증 (v0.2.0 — #38 추가)

- #18 pgTAP 4-arg throws_ok: AC-LIB2-DB-007 (REQ-LIB2-007)
- #20 트리거 알파벳순 실행 순서: AC-LIB2-DB-006
- #29 user_books_public 가시성: AC-LIB2-VIS-001
- #35 queryKey 접두사 매칭: AC-LIB2-UI-006, AC-LIB2-EMOTION-001
- #36 FlatList flex 함정: AC-LIB2-UI-005
- **#38 직렬 mutation 부분 실패 (v0.2.0 신규)**: AC-LIB2-EMOTION-001 (REQ-LIB2-042)

### §I.3 하위 SPEC 회귀

- SPEC-EMOTION-001 AC 매트릭스 PASS 유지 — EmotionInputScreen.onSubmit 경로 회귀 부재 (REQ-LIB2-042)
- SPEC-CLUB-001 AC 매트릭스 PASS 유지 (Track A)
- SPEC-COMPLETION-001 AC 매트릭스 PASS 유지
- SPEC-LIBRARY-001 나머지 AC (CRUD/진도/공개 토글) PASS 유지 — amendment 대상(정책 5.5, REQ-LIB-020, REQ-LIB-023)만 예외

### §I.4 CI 파이프라인

- pgTAP DB 테스트 CI job (PR #177 도입) PASS — 동시 INSERT 경쟁 시나리오 포함 (D6)
- Lint / Type Check / Unit Test / Integration Test PASS

---

## §J Definition of Done

본 SPEC-LIBRARY-002가 "완료"되려면 다음이 모두 충족되어야 한다:

### §J.1 기능 완료

- [ ] 모든 P0 AC (11건) PASS — DB 7건(001/002/003/004/005/006/008) + TRANSITION 2건 + EMOTION 1건 + AMEND 1건
- [ ] 모든 P1 AC (11건) PASS — DB 007 + UI 8건 + TRANSITION 002 + VIS 001
- [ ] P2 AC (2건)은 SHOULD — 미달성 시 debt 명시

### §J.2 회귀 부재

- [ ] SPEC-LIBRARY-001 나머지 AC 매트릭스 PASS 유지 (CRUD/진도/공개 토글)
- [ ] SPEC-EMOTION-001 감정 기록 플로우 회귀 부재 — EmotionInputScreen.onSubmit 직렬 mutation 경로 포함 (REQ-LIB2-042)
- [ ] SPEC-CLUB-001 Track A 공개 reader list 회귀 부재
- [ ] SPEC-COMPLETION-001 완독 처리 회귀 부재

### §J.3 문서 동기화

- [ ] SPEC-LIBRARY-001 body in-place amendment **sync-phase** 완료 (정책 5.5, REQ-LIB-020, REQ-LIB-023, 제외 범위 7) — D-NEW-1 경유, manager-spec 수행
- [ ] SPEC-LIBRARY-001 frontmatter `partially_superseded_by: [SPEC-LIBRARY-002]` 추가
- [ ] `CHANGELOG.md` `[Unreleased]` 섹션에 본 SPEC 변경 사항 기록
- [ ] `.moai/specs/INDEX.md` 갱신 — SPEC-LIBRARY-002 행 추가

### §J.4 품질 게이트

- [ ] TRUST 5 (Tested/Readable/Unified/Secured/Trackable) 모두 PASS
- [ ] Memory Lessons 6종 (#18, #20, #29, #35, #36, #38) 검증 완료
- [ ] 변경 패키지 coverage ≥ 85%
- [ ] Lint / Type Check / CI PASS

### §J.5 라이프사이클

- [ ] frontmatter `status: draft → in-progress → implemented → completed` 전환 완료 (단일 sync commit)
- [ ] `progress.md` §E.4 `sync_commit_sha` populate (placeholder → backfill)
- [ ] 3-phase close (plan→run→sync) 완료
- [ ] **SPEC-LIBRARY-001 sync-phase amendment commit**: `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002` (manager-spec authoring, D-NEW-1 경유)
