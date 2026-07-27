---
id: SPEC-LIBRARY-002
title: "Parallel Reading Support (다중 독서 병행) — Implementation Plan"
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

# SPEC-LIBRARY-002 — Implementation Plan

> Tier M (standard) — DB migration + 3 화면 UI + SPEC 합의를 단일 SPEC으로 통합. 3 산출물 세트 (spec.md + plan.md + acceptance.md). 본 plan.md는 §A Context → §B Known Issues → §C Pre-flight → §D Constraints → §E Self-Verification → §F Milestones → §G Anti-Patterns → §H Cross-References 구조.
>
> **v0.2.0 (2026-07-27) 개정**: plan-auditor iter1 FAIL (0.79, Tier M 임계 0.80 미달 + MP-7 critical) 해소. 사용자 합의 clarification 3종 (D1) 반영 — [NEEDS CLARIFICATION] 마커 12종 + "미해결" 3종 모두 RESOLVED. 결함 D1-D11 해소 (신규 REQ 5종, 신규 AC 4종).

---

## §A Context

### §A.1 작업 위치

- **프로젝트 루트**: `/Users/ip9202/develop/vibe/sagak`
- **현재 브랜치**: `develop` (spec 작성 시점; `/moai run` 진입 시 `feature/SPEC-LIBRARY-002-parallel-reading` 브랜치 생성 예정)
- **현재 HEAD**: `af72075` (ci(db): pgTAP DB 테스트 CI job 추가)

### §A.2 SPEC 산출물 경로

- `.moai/specs/SPEC-LIBRARY-002/spec.md` — 요구사항 (22 REQ, GEARS format)
- `.moai/specs/SPEC-LIBRARY-002/plan.md` — 본 문서
- `.moai/specs/SPEC-LIBRARY-002/acceptance.md` — AC (24 AC, 정량적, 검증 가능)
- `.moai/specs/SPEC-LIBRARY-002/progress.md` — §E skeleton (placeholder)

### §A.3 plan-auditor 검토 상태

- **plan-auditor iter1 verdict**: **FAIL** (score 0.79, Tier M 임계 0.80 미달 + MP-7 critical — [NEEDS CLARIFICATION] 미해소)
- **v0.2.0 개정**: 사용자 합의 clarification 3종 + 결함 D1-D11 해소
- **재실행 권장**: plan-auditor iter2 대상 — 예상 score 0.82+ (clarification gate 해소, traceability 매트릭스 강화, 신규 REQ/AC 충실도)

### §A.4 기존 인프라 (PRESERVE + EXTEND)

**PRESERVE (변경 금지)**:
- `user_books` 테이블 CHECK 제약, `UNIQUE(user_id, book_id)`, RLS 정책
- `on_user_books_update` 트리거 (잔여 BEFORE ROW — 실행 순서 회귀 점검만)
- `user_books_public` 보안 뷰의 노출 컬럼과 RLS 게이트
- `emotion_records` ↔ `user_books.id` 부모-자식 관계
- `/emotion/[bookId]` 라우트 (SPEC-EMOTION-001)
- `completion_reports` 자동 생성 트리거 (SPEC-DB-001 REQ-DB-010)
- `BookCard`, `ProgressBar` 컴포넌트 (SPEC-UI-001)
- `useLibrary`, `useLibraryItem`, `libraryApi`, `progressRate`, `progressValidation` 인터페이스 시그니처 (본 SPEC이 내부 구현을 변경하되 외부 인터페이스는 유지)
- `EmotionInputScreen.onSubmit` 인터페이스 (본 SPEC이 내부 직렬 mutation 경로를 검증하되 외부 인터페이스는 유지)

**EXTEND (확장 대상)**:
- `app/(tabs)/index.tsx` — `readingList?.[0]` 단일 선택 제거, 다중 FlatList 렌더링, 헤더 CTA 제거 (사용자 합의 #2)
- `src/features/library/useLibrary.ts` — 다중 reading 소비 패턴 문서화 (주석 갱신), 로딩 상태 분기 추가
- `src/features/book/BookDetailScreen.tsx` — `handleStatusChange` 배타 UPDATE 제거 검증

**DELETE (회수 대상)**:
- `supabase/migrations/20240630000001_enforce_single_reading_policy.sql`의 산출물 3종:
  - `enforce_single_reading` BEFORE INSERT OR UPDATE OF status 트리거
  - `enforce_single_reading()` 함수
  - `user_books_one_reading_per_user` 부분 UNIQUE 인덱스

**REMOVE (클라이언트 제거 — 사용자 합의 #2)**:
- 기존 홈 헤더의 단일 "오늘의 감정 기록하기" CTA 컴포넌트 (각 BookCard "기록하기" 버튼으로 대체)

### §A.5 산출물 LOC 추정 (Tier M 기준 — v0.2.0 갱신)

- DB migration 신규 파일: ~30-50 LOC
- pgTAP 테스트 (회수 + 다중 reading 회귀 + 동시 INSERT 경쟁 + INSERT 시나리오): ~120-160 LOC (D6, D10 신규 테스트 반영)
- `app/(tabs)/index.tsx` UI 변경 (헤더 CTA 제거 + 다중 FlatList + 로딩 분기): ~60-90 LOC diff (D7 로딩 분기 반영)
- 클라이언트 통합 테스트 (다중 reading + 감정 오염 + EmotionInputScreen 경로): ~130-180 LOC (D4, D8 신규 테스트 반영)
- 조건부 일반 인덱스 migration (`idx_user_books_user_status`): ~5-10 LOC (D11)
- SPEC-LIBRARY-001 sync-phase amendment (in-place): ~25-35 LOC diff
- **총 추정**: 370-525 LOC → Tier M (300-1000 LOC) 범위 부합

---

## §B Known Issues (auto-injected)

### B1. PostgreSQL BEFORE ROW 트리거 실행 순서 (메모리 #20) — CRITICAL

- `enforce_single_reading` 트리거가 DROP된 후 잔여 BEFORE 트리거(`on_user_books_update`)의 알파벳순 실행 순서가 회귀하지 않아야 함
- **검증**: `SELECT tgname FROM pg_trigger WHERE tgrelid='user_books'::regclass AND tgenabled='O' ORDER BY tgname` — 알파벳순 정렬 확인
- pgTAP 회귀 테스트: `last_progress_at`, `completed_at` 자동 갱신이 정상 동작함을 입증

### B2. Cross-SPEC Policy Conflict Pre-Scan — SPEC-LIBRARY-001 amendment (sync-phase)

- 본 SPEC은 SPEC-LIBRARY-001 정책 5.5 / REQ-LIB-020 / REQ-LIB-023을 in-place amendment
- `grep -r "enforce_single_reading\|policy 5.5\|정책 5.5\|reading 단일" .moai/specs/ src/ supabase/` — 잔여 참조가 amendment 후에도 일관성 있게 갱신되어야 함
- SPEC-LIBRARY-001 frontmatter에 `partially_superseded_by: [SPEC-LIBRARY-002]` 추가 필요 (sync-phase, D-NEW-1 경로)
- **amendment 타이밍 (사용자 합의 #3 — D1, D9 해소)**: **sync-phase**에서 수행. manager-docs는 금지(forbidden crossings) → blocker report → orchestrator → manager-spec 재위임 (D-NEW-1).

### B3. pgTAP throws_ok 4-arg 패턴 (메모리 #18, REQ-LIB2-007) — CRITICAL

- 회수 마이그레이션 후 예외가 발생하지 않음을 검증하는 pgTAP 테스트는 3-arg가 아닌 4-arg 패턴 준수 (D2 해소 — REQ-LIB2-007 명시적 REQ)
- **검증**: `throws_ok(SQL, errcode, errmsg, description)` 형태 — `ok(...)`/`lives_ok(...)` 조합으로 회수 후 정상 동작 입증

### B4. Frontmatter Canonical Schema

- `created:` / `updated:` / `tags:` 사용 — snake_case alias 금지
- 본 SPEC 4개 파일 모두 12 canonical 필드 준수

### B5. react-query queryKey 접두사 매칭 (메모리 #35) — CRITICAL

- 다중 reading 컨텍스트에서 `emotionRootKey(bookId, userId)` 기반 invalidate가 다른 reading 책의 캐시를 침범하지 않아야 함
- **검증**: queryKey 배열 요소의 객체 vs 문자열 불일치 점검, 특정 `bookId` invalidate가 다른 `bookId` 캐시에 영향 주지 않음을 통합 테스트로 입증
- PR #178 (queryKey 통일)과 정렬 기준 일관성 유지

### B6. FlatList contentContainerStyle flex 함정 (메모리 #36) — CRITICAL

- `app/(tabs)/index.tsx`의 reading 다중 FlatList에서 `contentContainerStyle={{flex:1}}` 또는 헤더 `flex:1` 사용 금지
- **검증**: 10권 이상 reading 데이터에서 스크롤 차단 / 헤더 높이 0 회귀 부재를 입증 (컴포넌트 테스트)

### B7. user_books_public 가시성 회귀 (메모리 #29) — CRITICAL

- `is_public=true`인 reading 다수가 Track A 독자 목록에 독립 노출됨을 입증
- **검증**: 다중 reading + `is_public=true` N권 시나리오에서 `user_books_public` 뷰 조회 결과 행 수 일치

### B8. 하위 호환성 — 기존 reading 1권 시나리오

- 본 SPEC 변경 후 기존 사용자(reading 0/1권) 시나리오가 호환되어야 함
- **검증**: 1권 reading 사용자 데이터에서 홈 단일 BookCard 렌더링이 다중 FlatList의 N=1 경우로 자연스럽게 처리됨

### B9. SPEC-LIBRARY-001 body amendment ownership (D-NEW-1)

- `* → superseded` / `completed → in-progress (amendment)` 전환은 manager-spec 소관 (D-NEW-1 inline-fix 패턴)
- **sync-phase**에서 SPEC-LIBRARY-001 body 수정 필요 시 (사용자 합의 #3): manager-docs는 작업 금지 → blocker report 반환 → orchestrator가 manager-spec에 재위임
- 절대 manager-docs 또는 manager-develop이 직접 SPEC-LIBRARY-001 body를 수정하지 않음

### B10. Untouched Paths PRESERVE (Scope Discipline)

- 본 SPEC 범위 외 파일 수정 금지: `emotion_records` 테이블, `completion_reports` 트리거, `/emotion/[bookId]` 컴포넌트, `reading_sessions` 스키마 등
- 병렬 manager-develop 인스턴스 실행 시 타 SPEC 디렉토리 수정 금지

### B11. AskUserQuestion Prohibited (Subagent Boundary)

- subagent는 사용자에게 직접 질문 불가 — blocker report 반환
- ~~[NEEDS CLARIFICATION] 마커 3종은 orchestrator가 Implementation Kickoff Approval 전 AskUserQuestion으로 해소해야 함~~
- **v0.2.0 (D1 해소)**: 사용자 합의 clarification 3종으로 모든 [NEEDS CLARIFICATION] 마커 RESOLVED — Implementation Kickoff Approval 진입에 clarification blocker 없음

### B12. Sync-phase CHANGELOG emission (manager-docs only)

- 본 SPEC의 변경 사항은 CHANGELOG `[Unreleased]` 섹션에 기록 — manager-docs 담당
- 중복 ENTRY 방지: `grep -c 'SPEC-LIBRARY-002' CHANGELOG.md` 후 count ≥ 1이면 blocker 반환
- SPEC-LIBRARY-001의 `partially_superseded_by` 추가도 CHANGELOG에 명시

### B13. 직렬 mutation 부분 실패 (메모리 #38, REQ-LIB2-042) — CRITICAL (v0.2.0 신규)

- `EmotionInputScreen.onSubmit` → `progressRate` 업데이트 → `last_progress_at` 갱신 → `useLibraryItem(bookId)` invalidate 직렬 경로가 부분 실패 없이 안전하게 수행되어야 함 (D8 해소)
- **검증**: 다중 reading 컨텍스트에서 bookA 감정 기록 중 `last_progress_at` 갱신이 bookB 캐시/상태 침범 부재 입증 (통합 테스트)

---

## §C Pre-flight Check List (run-phase M1 진입 전 검증)

```bash
# 1. 현재 브랜치 + HEAD 확인
git branch --show-current  # develop이어야 함 (--pr 아닌 한 Route A main-direct)
git rev-parse HEAD         # af72075 기준 최신

# 2. 기존 DB 마이그레이션 정책 객체 현황 (회수 대상 3종 존재 확인)
supabase db query --linked "SELECT tgname FROM pg_trigger WHERE tgrelid='user_books'::regclass AND tgname='enforce_single_reading'"
supabase db query --linked "SELECT proname FROM pg_proc WHERE proname='enforce_single_reading'"
supabase db query --linked "SELECT indexname FROM pg_indexes WHERE tablename='user_books' AND indexname='user_books_one_reading_per_user'"

# 3. 잔여 BEFORE ROW 트리거 현황 (회귀 점검 baseline)
supabase db query --linked "SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='user_books'::regclass AND tgtype::bit(8) LIKE '________' AND (tgtype & 1) = 0 ORDER BY tgname"

# 4. SPEC-LIBRARY-001 body의 정책 5.5 / REQ-LIB-020 / REQ-LIB-023 현황 (sync-phase amendment 대상)
grep -n "정책 5.5\|policy 5.5\|enforce_single_reading\|REQ-LIB-020\|REQ-LIB-023" .moai/specs/SPEC-LIBRARY-001/spec.md

# 5. 클라이언트 단일 reading 선택 패턴 현황 + 헤더 CTA (사용자 합의 #2)
grep -n "readingList\?\.\[\|currentBook\|pickCurrentBook\|오늘의 감정 기록하기\|헤더 CTA" app/\(tabs\)/index.tsx src/features/library/useLibrary.ts

# 6. react-query queryKey 현황 (메모리 #35 baseline, PR #178 정렬)
grep -n "emotionRootKey\|useQueryKey\|queryKey" src/features/emotion/ src/features/library/

# 7. Lint baseline (신규 결함 vs 기존 구분)
npm run lint 2>&1 | tail -10

# 8. Type check baseline
npm run typecheck 2>&1 | tail -10
```

---

## §D Constraints (DO NOT VIOLATE)

### §D.1 PRESERVE 목록 (수정 금지)

- `user_books` CHECK / UNIQUE / RLS 제약
- `on_user_books_update` 트리거 본문
- `user_books_public` 보안 뷰 정의
- `emotion_records`, `completion_reports`, `reading_sessions` 스키마
- `/emotion/[bookId]` 라우트 컴포넌트
- `BookCard`, `ProgressBar`, `EmotionRecordCard` 컴포넌트 public API
- `useLibrary` / `useLibraryItem` / `libraryApi` / `progressRate` / `progressValidation`의 export 인터페이스 시그니처
- `EmotionInputScreen.onSubmit` 인터페이스 시그니처 (내부 직렬 경로만 검증)

### §D.2 금지 명령

- `git push --force` / `git push --no-verify` (main, develop 모두)
- `--amend` 로 이미 push한 커밋 변경
- Supabase CLI로 운영 DB 직접 수정 (`supabase db push --linked`는 plan-phase에서 금지, run-phase에서만 — 실기기 테스트 환경 메모리 참조)

### §D.3 필수 규약

- Conventional Commits (한국어 본문 허용, `git_commit_messages: ko`):
  - `feat(SPEC-LIBRARY-002): M1 enforce_single_reading 정책 철회 migration`
  - `feat(SPEC-LIBRARY-002): M2 메인 다중 reading 렌더링 + 헤더 CTA 제거`
  - `feat(SPEC-LIBRARY-002): M3 상태 전환 비배타 클라이언트 정리`
  - `feat(SPEC-LIBRARY-002): M4 공개 가시성 회귀 테스트`
  - `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002` (D9 해소 — sync-phase에서 manager-spec 수행)
- `🗿 MoAI <email@mo.ai.kr>` trailer — 본 워크스페이스 규약
- pgTAP 테스트 `throws_ok` 4-arg 패턴 강제 (메모리 #18, REQ-LIB2-007)
- FlatList `contentContainerStyle` flex:1 사용 금지 (메모리 #36)

### §D.4 [RESOLVED] 사용자 합의 clarification 3종 (D1 해소 — v0.2.0)

> v0.1.0의 [NEEDS CLARIFICATION] 마커 3종은 사용자 합의 clarification으로 모두 RESOLVED되었다 (2026-07-27). plan-auditor MP-7 critical (clarification gate) 해소. Implementation Kickoff Approval 진입에 더 이상 clarification blocker가 없다.

#### RESOLVED #1: 홈 reading 목록 정렬 순서 — `last_progress_at` DESC

- **v0.1.0 옵션**: (A) last_progress_at DESC / (B) started_reading_at DESC / (C) updated_at DESC / (D) 진도률 순
- **사용자 합의 (2026-07-27)**: **(A) `last_progress_at` DESC** — 최근 진도 업데이트 순
- **반영 위치**: spec.md §2.2 가정 6, §3 REQ-LIB2-010, §5.1
- **M2 산출물**: `app/(tabs)/index.tsx` 또는 `libraryApi`에서 `last_progress_at` DESC 정렬 적용

#### RESOLVED #2: 기존 "오늘의 감정 기록하기" 헤더 CTA 처리 — 제거

- **v0.1.0 옵션**: (A) 제거 / (B) 유지 (fallback CTA) / (C) "지금 읽는 책 중 선택" 다이얼로그
- **사용자 합의 (2026-07-27)**: **(A) 제거** — 각 BookCard "기록하기" 버튼으로 대체 (REQ-LIB2-011)
- **반영 위치**: spec.md §2.2 가정 4, §3 REQ-LIB2-011, §5.2
- **M2 산출물**: `app/(tabs)/index.tsx`에서 헤더 CTA 컴포넌트 제거

#### RESOLVED #3: SPEC-LIBRARY-001 body in-place amendment 타이밍 — sync-phase (D-NEW-1)

- **v0.1.0 옵션**: (A) run-phase M1 / (B) sync-phase / (C) run-phase M1 + sync-phase 이단 검증
- **사용자 합의 (2026-07-27)**: **(B) sync-phase** — D-NEW-1 소유권 경로 (manager-docs 금지 → orchestrator → manager-spec 재위임)
- **반영 위치**: spec.md §HISTORY Amendments, §3 REQ-LIB2-AMEND-001, §5.3
- **M4/M5 산출물**: M4는 가시성 회귀 테스트만 수행, amendment는 M5 sync-phase에서 manager-spec이 수행

---

## §E Self-Verification Deliverables

> 각 E-item은 verification-claim-integrity 5-section format (Claim / Evidence / Baseline-attribution / Gaps / Residual-risk)로 보고. run-phase 종료 시 manager-develop이 §E.1 ~ §E.7 매트릭스를 progress.md §E.2에 기록.

### §E.1 AC Binary PASS/FAIL Matrix

| AC | Status | Verification Command | Expected Output |
|----|--------|---------------------|-----------------|
| AC-LIB2-DB-001 | _pending_ | `supabase db query --linked "SELECT tgname FROM pg_trigger WHERE tgname='enforce_single_reading'"` | 0 rows |
| AC-LIB2-DB-002 | _pending_ | `supabase db query --linked "SELECT proname FROM pg_proc WHERE proname='enforce_single_reading'"` | 0 rows |
| AC-LIB2-DB-003 | _pending_ | `supabase db query --linked "SELECT indexname FROM pg_indexes WHERE indexname='user_books_one_reading_per_user'"` | 0 rows |
| AC-LIB2-DB-004 | _pending_ | pgTAP test: 한 user_id 3개 reading INSERT 후 UPDATE 후 모두 reading 유지 (D10) | `ok 1 - parallel reading preserved (INSERT + UPDATE)` |
| AC-LIB2-DB-005 | _pending_ | pgTAP test: completed/shelved 기존 동작 유지 | `ok N - completed_at set` |
| AC-LIB2-DB-006 | _pending_ | pgTAP test: 잔여 BEFORE 트리거 실행 순서 | `ok N - last_progress_at updated` |
| AC-LIB2-DB-007 | _pending_ | `grep -n "throws_ok\|lives_ok" supabase/tests/*.sql` (4-arg/lives_ok 패턴) | 4-arg matching |
| AC-LIB2-DB-008 | _pending_ | pgTAP test: 동시 INSERT 경쟁 (D6) | `ok N - concurrent INSERT both committed` |
| ... | ... | ... | ... |

(전체 AC 매트릭스는 acceptance.md SSOT — 총 24 AC)

### §E.2 DB Migration 적용 결과

```
$ supabase migration up --linked
# 신규 migration YYYYMMDD_drop_enforce_single_reading 적용 성공
```

### §E.3 Coverage (변경 패키지별)

```
$ npm test -- --coverage src/features/library src/features/book
# 변경 패키지 coverage ≥ 85%
```

### §E.4 Memory Lessons 검증 (B1, B3, B5, B6, B7, B13)

```
# B1 트리거 알파벳순 실행 순서
supabase db query --linked "SELECT tgname FROM pg_trigger WHERE tgrelid='user_books'::regclass ORDER BY tgname"
# B3 pgTAP 4-arg throws_ok (REQ-LIB2-007)
grep -n "throws_ok" supabase/tests/*.sql
# B5 queryKey 침범 부재
npm test -- --grep "invalidate.*bookId"
# B6 FlatList flex 회귀 부재
npm test -- --grep "FlatList"
# B7 user_books_public 가시성 회귀
supabase db query --linked "SELECT * FROM user_books_public WHERE user_id = <test-user-with-multi-reading>"
# B13 직렬 mutation 부분 실패 부재 (REQ-LIB2-042, D8)
npm test -- --grep "EmotionInputScreen.*last_progress_at"
```

### §E.5 Lint / Type Check (신규 결함 0)

```
$ npm run lint   # baseline 대비 신규 error/warning 0
$ npm run typecheck  # exit 0
```

### §E.6 Branch HEAD + Push state

- 신규 commit SHA 리스트
- `git push origin develop` 결과 (또는 PR merge 결과)

### §E.7 Blocker Report (if any)

- ~~[NEEDS CLARIFICATION] 미해소 건~~ (v0.2.0 — 모두 RESOLVED)
- ownership crossing (SPEC-LIBRARY-001 body 수정 필요 시 — sync-phase D-NEW-1 경유)

---

## §F Milestones (decision-reversibility 순서 — 변경 가능성 높은 결정 우선)

> 마일스톤 순서는 결정 가역성(decision reversibility) 기준 — 가장 변경 가능성이 높은 결정(데이터 모델, 인터페이스, UX 플로우)을 먼저 배치하고 기계적 리팩토링은 후반으로.

### M1 — DB migration: enforce_single_reading 정책 철회 + 조건부 일반 인덱스 (결정 가역성 최상)

**목적**: 정책 철회를 DB 측에서 먼저 수행하여 클라이언트 변경의 기반을 만든다. 모든 후속 마일스톤의 사전 조건.

**산출물**:
- 신규 migration `supabase/migrations/{YYYYMMDD}_drop_enforce_single_reading.sql`:
  - `DROP TRIGGER IF EXISTS enforce_single_reading ON user_books`
  - `DROP FUNCTION IF EXISTS enforce_single_reading()`
  - `DROP INDEX IF EXISTS user_books_one_reading_per_user`
- **조건부 산출물 (D11 해소)**: 쿼리 성능 회귀 관측 시 다음 일반 인덱스 추가:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_user_books_user_status
  ON user_books(user_id, status);
  ```
  - 성능 회귀 판단 기준: `EXPLAIN ANALYZE SELECT * FROM user_books WHERE user_id = ? AND status = 'reading'` 실행 계획에서 Seq Scan 발생 시 추가
- pgTAP 회귀 테스트 `supabase/tests/drop_enforce_single_reading.sql`:
  - 4-arg `throws_ok` 또는 `lives_ok` 패턴 (메모리 #18, REQ-LIB2-007)
  - 한 user_id의 3개 reading **INSERT 후 UPDATE** 시나리오 모두 `reading` 유지 (AC-LIB2-DB-004, D10 해소 — INSERT/UPDATE 양쪽 검증)
  - `on_user_books_update` 트리거 알파벳순 실행 순서 회귀 부재 (AC-LIB2-DB-006)
  - completed/shelved 기존 동작 유지 (AC-LIB2-DB-005)
  - **동시 INSERT 경쟁 시나리오** (D6 해소 — P0 승격): 두 클라이언트가 동시에 서로 다른 책을 reading으로 INSERT해도 두 트랜잭션 모두 커밋 성공 (AC-LIB2-DB-008)

**MX tag 대상**:
- `@MX:NOTE`: 신규 migration 파일에 회수 사유 명시 (`@MX:REASON enforce_single_reading 정책 철회 per SPEC-LIBRARY-002`)
- `@MX:ANCHOR`: pgTAP 다중 reading + 동시 INSERT 회귀 테스트 — 회귀 방어선으로 팬인 높음

**검증**: AC-LIB2-DB-001 ~ AC-LIB2-DB-008 (총 8건, D6/D10 신규 AC 포함)

**리스크**: rollback 시 다시 단일 reading 정책이 적용되므로, 운영 DB rollback은 신중. dev 환경에서 먼저 검증 후 staged prod 적용. 조건부 일반 인덱스(D11) 추가 시 migration 가역성에 영향 — rollback migration에 DROP INDEX 포함 필요.

**commit subject**: `feat(SPEC-LIBRARY-002): M1 enforce_single_reading 정책 철회 migration`

### M2 — 메인 홈: 다중 reading 렌더링 (last_progress_at DESC) + 헤더 CTA 제거 + 각 BookCard "기록하기" 버튼 + 로딩 분기 (UX 가역성 높음)

**목적**: 홈 화면에서 reading 0/1/N권 모두를 자연스럽게 표시하고, 각 책마다 독립된 감정 기록 진입점을 제공한다. 기존 헤더 CTA는 제거한다 (사용자 합의 #2).

**산출물**:
- `app/(tabs)/index.tsx` 수정:
  - `readingList?.[0]` 단일 선택 제거 → 전체 `readingList` FlatList 렌더링
  - **정렬: `last_progress_at` DESC** (사용자 합의 #1) — `libraryApi` 쿼리 계층 또는 클라이언트 정렬 함수에서 적용
  - **헤더 "오늘의 감정 기록하기" CTA 제거** (사용자 합의 #2) — fallback CTA/다이얼로그 대안 없이 깔끔하게 제거
  - 각 항목에 "기록하기" 버튼 추가 (`router.push('/emotion/[bookId]')`)
  - 빈 상태 분기 유지 (AC-LIB2-UI-001) — 로딩 완료 후 0권
  - **로딩 상태 분기 추가** (D7 해소, REQ-LIB2-014): `isLoading === true` 시 스켈레톤/스피너 렌더링, 빈 상태 UI 렌더링하지 않음 (AC-LIB2-UI-008)
  - FlatList `contentContainerStyle` flex:1 사용 금지 (메모리 #36)
- `src/features/library/useLibrary.ts` 주석 갱신 — 정책 5.5 언급 제거, 다중 reading 지원 명시, 로딩 상태 분기 문서화
- 컴포넌트 테스트 `src/features/library/__tests__/HomeMultiReading.test.tsx`:
  - 0/1/3권 reading 렌더링 (AC-LIB2-UI-001/002/003)
  - 각 "기록하기" 버튼 네비게이션 (AC-LIB2-UI-004)
  - FlatList 가상화 메모리 안전 (AC-LIB2-UI-005)
  - **로딩 중 스켈레톤/스피너 렌더링** (AC-LIB2-UI-008, D7 해소)
  - **헤더 CTA 제거 grep 검증**: `grep -c "오늘의 감정 기록하기\|헤더 CTA" app/(tabs)/index.tsx` → 0 매칭

**MX tag 대상**:
- `@MX:NOTE`: 다중 reading 렌더링 로직 + last_progress_at DESC 정렬 — 설계 의도 명시
- `@MX:ANCHOR`: "기록하기" 버튼 → `/emotion/[bookId]` 진입 — 팬인 높은 라우트

**[RESOLVED] clarification 처리 (v0.2.0 — D1 해소)**:
- v0.1.0 marker "홈 reading 목록 정렬 순서" → **RESOLVED**: `last_progress_at` DESC (사용자 합의 #1)
- v0.1.0 marker "기존 '오늘의 감정 기록하기' 헤더 CTA 처리" → **RESOLVED**: 제거 (사용자 합의 #2)

**검증**: AC-LIB2-UI-001 ~ AC-LIB2-UI-008 (총 8건, D7 신규 AC 포함)

**리스크**: N=10권 이상 성능. FlatList 가상화 필수. 실기기 검증으로 뒷받침. 헤더 CTA 제거로 인한 사용자 혼란 가능성 — 각 BookCard "기록하기" 버튼 가시성으로 완화.

**commit subject**: `feat(SPEC-LIBRARY-002): M2 메인 다중 reading 렌더링 + 헤더 CTA 제거 + 로딩 분기`

### M3 — 상태 전환 비배타 클라이언트 정리 + react-query + EmotionInputScreen 회귀 검증 (인터페이스 일관성)

**목적**: `BookDetailScreen.handleStatusChange`에서 기존 reading 자동 shelved 배타 UPDATE가 클라이언트 측에서도 발생하지 않음을 보장한다. 추가로 EmotionInputScreen → last_progress_at 직렬 mutation 경로의 회귀를 검증한다 (D8 해소).

**산출물**:
- `src/features/book/BookDetailScreen.tsx` 점검 — 자동 배타 UPDATE 코드가 있으면 제거 (REQ-LIB2-020)
- `src/features/library/useLibraryItem.ts` 점검 — status mutation이 배타 사이드 이펙트를 일으키지 않는지 확인
- 클라이언트 통합 테스트 `src/features/library/__tests__/MultiReadingTransition.test.tsx`:
  - A책 reading 전환 시 B책이 여전히 reading (AC-LIB2-TRANS-001)
  - 명시적 shelved 선택 시에만 보관 이동 (AC-LIB2-TRANS-002)
  - completed 전환 기존 로직 회귀 부재 (AC-LIB2-TRANS-003)
  - react-query invalidate 침범 부재 (AC-LIB2-UI-006, 메모리 #35)
  - **EmotionInputScreen.onSubmit → progressRate → last_progress_at 갱신 → useLibraryItem invalidate 직렬 경로 부분 실패 부재** (D8 해소, REQ-LIB2-042, 메모리 #38)
  - **다중 reading 감정 기록 오염 부재** (D4 해소, AC-LIB2-EMOTION-001): bookA 감정 기록 후 bookA emotion_records만 INSERT, bookB 오염 부재

**MX tag 대상**:
- `@MX:NOTE`: 비배타 전환 정책 의도
- `@MX:ANCHOR`: `handleStatusChange` — 상태 전환 팬인 높은 진입점
- `@MX:WARN`: `EmotionInputScreen.onSubmit` 직렬 mutation 경로 — 부분 실패 위험 구간 (메모리 #38)

**검증**: AC-LIB2-TRANS-001 ~ AC-LIB2-TRANS-003, AC-LIB2-UI-006, AC-LIB2-UI-007, AC-LIB2-EMOTION-001 (D4), REQ-LIB2-042 (D8)

**리스크**: 기존 코드에 자동 배타 UPDATE가 없더라도 (DB가 담당했으므로), 클라이언트 테스트로 방어망 추가 필요. EmotionInputScreen 직렬 mutation은 PR #178 (queryKey 통일)과 정렬 기준 일관성 유지 필요.

**commit subject**: `feat(SPEC-LIBRARY-002): M3 상태 전환 비배타 클라이언트 정리 + EmotionInputScreen 회귀 검증`

### M4 — 공개 가시성 회귀 테스트 (run-phase; amendment는 sync-phase로 위임)

**목적**: 다중 reading이 공개 reader list에 미치는 영향을 회귀 검증한다. **SPEC-LIBRARY-001 in-place amendment는 본 마일스톤에서 수행하지 않고 sync-phase(M5)로 위임한다** (사용자 합의 #3 — D9 해소).

**산출물**:
- pgTAP 가시성 회귀 테스트 `supabase/tests/multi_reading_visibility.sql`:
  - 다중 reading + `is_public=true` N권 → `user_books_public` 노출 (AC-LIB2-VIS-001)
  - "대표 책" 개념 부재 (AC-LIB2-VIS-002)
- **SPEC-LIBRARY-001 in-place amendment는 M4에서 수행하지 않음** (D9 해소):
  - 사용자 합의 clarification #3에 따라 amendment는 sync-phase(M5)에서 manager-spec이 수행
  - M4에서는 amendment에 대한 준비(검증 항목 사전 정의, 정책 5.5 / REQ-LIB-020 / REQ-LIB-023 / 제외 범위 7의 현재 텍스트 확인)만 수행
  - manager-develop이 M4에서 SPEC-LIBRARY-001 body를 직접 수정하는 것은 ownership crossing 금지 (B9)

**MX tag 대상**:
- `@MX:NOTE`: 다중 reading 공개 가시성 회귀 방어선

**검증**: AC-LIB2-VIS-001, AC-LIB2-VIS-002

**리스크**: 가시성 회귀 자체는 회귀 테스트로 검증 완료. amendment 연기로 인한 일시적 문서-코드 불일치 기간 존재 — 사용자 합의된 정책이므로 수용.

**commit subject**: `feat(SPEC-LIBRARY-002): M4 공개 가시성 회귀 테스트`

### M5 — sync-phase (CHANGELOG, INDEX, 문서 동기화, completed 전환 + SPEC-LIBRARY-001 sync-phase amendment)

**목적**: 단일 sync commit으로 3-phase close (plan→run→sync) 완료. **추가로 사용자 합의 #3에 따라 SPEC-LIBRARY-001 in-place amendment를 수행한다** (D9 해소 — D-NEW-1 경로).

**산출물** (manager-docs 소관 + manager-spec 재위임):
- `CHANGELOG.md` `[Unreleased]` 섹션에 SPEC-LIBRARY-002 변경 사항 기록 (manager-docs)
- `.moai/specs/INDEX.md` 갱신 — SPEC-LIBRARY-002 행 추가, SPEC-LIBRARY-001 행에 partial supersede 표시 (manager-docs)
- `progress.md` §E.4 `sync_commit_sha` 필드 populate (placeholder → 실제 SHA backfill) (manager-docs)
- frontmatter `status: draft → in-progress → implemented → completed` 전환 (단일 sync commit) (manager-docs)
- **SPEC-LIBRARY-001 in-place amendment (D-NEW-1 경유 — manager-spec 소관)**:
  - manager-docs가 본 작업 수행 시도 시 금지(forbidden crossings) → blocker report 반환
  - orchestrator가 manager-spec에 재위임하여 다음을 수행 (REQ-LIB2-AMEND-001):
    - 정책 5.5: `(RESCINDED by SPEC-LIBRARY-002)` 표시 + 철회 사유
    - REQ-LIB-020 각주: 정책 5.5 언급 제거/정정
    - REQ-LIB-023: 자동 shelved 배타 묘사 제거, 본 SPEC REQ-LIB2-020/021 참조로 대체
    - 제외 범위 7 예외 구문: 본 SPEC에서 스키마 변경 주도로 이관 표시
    - frontmatter: `partially_superseded_by: [SPEC-LIBRARY-002]` 추가 + `updated` 갱신
  - **amendment commit subject (D9 해소)**: `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002`
  - **ownership 경로 명시**: 본 commit은 manager-spec이 authoring. manager-docs/manager-develop 직접 작성 금지.

**검증**: sync-phase quality gate (lint + test + coverage delta + dependency manifest audit) + AC-LIB2-AMEND-001 (D3 해소)

**리스크**: amendment 작업이 D-NEW-1 재위임 경로를 거치므로 sync-phase 내 추가 Agent() spawn 필요. orchestrator는 manager-docs의 blocker report를 처리하는 동안 sync commit을 지연시키지 않도록 amendment를 sync commit 직전에 수행. 대안: amendment를 별도 commit으로 분리 후 sync commit을 후속 진행.

**commit subject**:
- amendment commit (manager-spec): `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002`
- sync commit (manager-docs): `docs(SPEC-LIBRARY-002): sync-phase artifacts` (3-phase close — `implemented → completed` 전환 동반)

---

## §G Anti-Patterns

### AP-LIB2-001 — manager-develop 또는 manager-docs이 SPEC-LIBRARY-001 body 직접 수정

- **위반**: ownership 매트릭스 (B9) — `* → superseded` / amendment 전환은 manager-spec 소관. sync-phase에서 SPEC-LIBRARY-001 body 수정은 manager-docs 금지 (forbidden crossings).
- **올바른 플로우**: blocker report → orchestrator → manager-spec 재위임 (D-NEW-1 패턴)

### AP-LIB2-002 — pgTAP throws_ok 3-arg 사용 (메모리 #18, REQ-LIB2-007)

- **위반**: 4-arg 강제 규약 (B3)
- **올바른 패턴**: `throws_ok(SQL, errcode, errmsg, description)` 또는 `lives_ok(SQL, description)`

### AP-LIB2-003 — FlatList contentContainerStyle flex:1 (메모리 #36)

- **위반**: 모바일 렌더링 함정 (B6)
- **올바른 패턴**: flex:1 사용 금지, 가상화 기본 동작에 의존

### AP-LIB2-004 — queryKey 객체 vs 문자열 불일치 (메모리 #35)

- **위반**: react-query invalidate 침범 (B5)
- **올바른 패턴**: queryKey 접두사 일관성 — emotionRootKey(bookId, userId) 준수, PR #178 정렬

### AP-LIB2-005 — 사용자 동의 없는 "대표 책" 선정 로직 도입

- **위반**: 결정 B (REQ-LIB2-031)
- **올바른 패턴**: 모든 reading을 동등하게 취급, "대표 책" 개념화 금지

### AP-LIB2-006 — 과거 자동 shelved 이력 데이터 역산 복구

- **위반**: 가정 2.1.4 + 제외 범위
- **올바른 패턴**: 사용자 명시적 "읽기 시작" 액션 없이는 status 변경 금지

### AP-LIB2-007 — [NEEDS CLARIFICATION] 미해소 상태로 run-phase 진입 (v0.1.0 anti-pattern — v0.2.0에서 RESOLVED)

- **위반**: clarification gate (plan-auditor가 flag)
- **v0.2.0 상태**: 사용자 합의 clarification 3종으로 모두 RESOLVED — 본 anti-pattern은 v0.1.0 전용 기록으로 보존
- **올바른 패턴**: orchestrator AskUserQuestion으로 3종 마커 모두 해소 후 Implementation Kickoff Approval (완료됨)

### AP-LIB2-008 — M1 DB migration 없이 M2 클라이언트 변경 먼저 수행

- **위반**: 마일스톤 의존성 (M2는 M1 사전 조건)
- **올바른 패턴**: 결정 가역성 순서 — DB 스키마 변경을 먼저 확정 후 UX 변경

### AP-LIB2-009 — 헤더 CTA 제거 없이 다중 reading 도입 (v0.2.0 신규 — 사용자 합의 #2 위반)

- **위반**: 사용자 합의 clarification #2 (D1 해소) — 헤더 CTA는 제거되어야 함
- **올바른 패턴**: 헤더 "오늘의 감정 기록하기" CTA 컴포넌트 제거, 각 BookCard "기록하기" 버튼으로 일원화

### AP-LIB2-010 — EmotionInputScreen 직렬 mutation 부분 실패 무시 (v0.2.0 신규 — 메모리 #38, REQ-LIB2-042)

- **위반**: 직렬 mutation 부분 실패 회귀 (B13, D8 해소)
- **올바른 패턴**: `onSubmit` → `progressRate` → `last_progress_at` → invalidate 경로를 통합 테스트로 검증, 다중 reading 컨텍스트에서 bookA 경로가 bookB에 침범하지 않음을 입증

### AP-LIB2-011 — 동시 INSERT 경쟁 테스트를 "선택적"으로 분류 (v0.2.0 신규 — D6 해소)

- **위반**: 사용자 합의 다중 reading 보장 — 동시 INSERT 경쟁은 P0 필수 검증 항목
- **올바른 패턴**: pgTAP `PERFORM` 기반 동시성 테스트를 필수로 작성 (AC-LIB2-DB-008)

### AP-LIB2-012 — run-phase M4에서 SPEC-LIBRARY-001 body 수정 (v0.2.0 신규 — D9 해소)

- **위반**: 사용자 합의 clarification #3 — amendment는 sync-phase에서만 수행
- **올바른 패턴**: M4는 가시성 회귀 테스트만 수행, amendment는 M5 sync-phase에서 manager-spec이 D-NEW-1 경로로 수행

---

## §H Cross-References

- **SPEC-LIBRARY-001** (`.moai/specs/SPEC-LIBRARY-001/spec.md`) — amendment 대상 (정책 5.5, REQ-LIB-020, REQ-LIB-023, 제외 범위 7) — sync-phase 수행 (D9)
- **SPEC-DB-001** — REQ-DB-003 (user_books 스키마), REQ-DB-013e (user_books_public 뷰), REQ-DB-015 (RLS), REQ-DB-010 (completion_reports 트리거)
- **SPEC-EMOTION-001** — 감정 기록 회귀 범위 (REQ-LIB2-040, REQ-LIB2-041, REQ-LIB2-042, `/emotion/[bookId]`, EmotionInputScreen.onSubmit)
- **SPEC-CLUB-001** — Track A 공개 reader list 영향 범위 (REQ-LIB2-030)
- **SPEC-COMPLETION-001** — completed 전환 회귀 (REQ-LIB2-022)
- **메모리 교훈**: #18 (pgTAP 4-arg, REQ-LIB2-007), #20 (트리거 알파벳순), #29 (user_books_public), #35 (queryKey 접두사, PR #178 정렬), #36 (FlatList flex), #38 (직렬 mutation 부분 실패, REQ-LIB2-042)
- **PR #178** (queryKey 통일) — 본 SPEC REQ-LIB2-041 정렬 기준 일관성 근거
- **Supabase migrations**: `20240630000001_enforce_single_reading_policy.sql` (철회 대상), `20240614000003_create_user_books.sql`, `20240701000001_expose_user_books_public_status.sql`
- **CLAUDE.md §5** (SPEC-Based Workflow) + §7 (Safe Development Protocol)
- **`.claude/rules/moai/development/spec-frontmatter-schema.md`** — frontmatter canonical schema, Status Transition Ownership Matrix, forbidden crossings (manager-docs/develop body 수정 금지)
- **`.claude/rules/moai/development/manager-develop-prompt-template.md`** — Tier M Section A-E delegation template
- **`.claude/rules/moai/workflow/spec-workflow.md`** — Tier classification, plan→run→sync lifecycle
- **사용자 합의 clarification 3종 (2026-07-27, D1 해소)**:
  1. 홈 reading 정렬: `last_progress_at` DESC
  2. 헤더 CTA: 제거 (각 BookCard "기록하기" 버튼으로 대체)
  3. SPEC-LIBRARY-001 amendment 타이밍: sync-phase (D-NEW-1 경로)

---

## §I Tier 및 복잡도 평가 (v0.2.0 갱신)

- **Tier M (standard)** — LOC 추정 370-525, 파일 5-10개 (DB migration + 3 UI 파일 + 테스트 + 조건부 일반 인덱스 + SPEC amendment)
- **3 산출물**: spec.md + plan.md + acceptance.md (Tier M 기본 세트)
- **plan-auditor PASS threshold**: 0.80 (Tier M)
- **v0.2.0 개정 전 점수**: 0.79 (iter1 FAIL, MP-7 critical)
- **v0.2.0 개정 후 예상 점수**: 0.82+ (clarification gate 해소 + traceability 매트릭스 강화 + 신규 REQ 5종/AC 4종 충실도)
- **최대 3회 plan-auditor iteration** — iter(N+1) 점수 하락 시 STOP + 범위 축소 제안. 현재 iter2 대상.
- **Route A (Hybrid Trunk main-direct)** — Tier M 기본, `--pr` 플래그 없으면 Route A
