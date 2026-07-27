# SPEC-CLUB-004 — Progress

> 진행 추적 문서. plan-phase 초깃값. `§E.*` 헤딩과 `sync_commit_sha`/`mx_commit_sha` 필드는 era.go 파서가 로드하므로 리터럴을 보존한다 (`.claude/rules/moai/development/spec-frontmatter-schema.md` § progress.md Section Map).
> 작성일: 2026-07-27.

## §E.1 Plan-phase Audit-Ready Signal

- plan_status: audit-ready
- plan_complete_at: 2026-07-27
- plan_auditor_verdict: PASS (conditional → D1 해소로 확정)
- plan_auditor_score: 0.94 (Tier M thresh 0.80 초과)
- plan_auditor_iteration: 1/3
- d1_resolution: stale `[NEEDS CLARIFICATION]` 마커 4종 + M2 컨텍스트 옵션 → RESOLVED 동기화 완료 (2026-07-27, orchestrator 예외 직접 수행 — 기계적 SSOT 동기화)
- codebase_claims_verified: research.md 주장 7종 plan-auditor 독립 검증 완료 (환각 0건)
- deferred_defects: D2(GWT 형식 — 사용자 수용) / D3(AC-031 중복 — sync 정리) / D4(REQ-022 메타) / D5(REQ 번호 — 정보성)

> audit-ready 달성. Implementation Kickoff Approval(plan→run HUMAN GATE) 대기 중.

---

## §E.2 Run-phase Evidence

> TDD RED-GREEN-REFACTOR (cycle_type=tdd). run-phase 완료: 2026-07-27.

### AC Binary PASS/FAIL Matrix (16 AC)

| AC | Status | Verification Command | Actual Output |
|----|--------|----------------------|---------------|
| AC-CLUB4-001 | PASS | `npx jest BookSelectionHub.test -t "AC-001"` | hub-library-section + hub-search-section 동시 렌더 |
| AC-CLUB4-002 | PASS | `npx jest clubs.new.route.test -t "AC-002"` | club-new-search testID 부재 (게이트 CTA 제거) |
| AC-CLUB4-010 | PASS | `npx jest BookSelectionHub.test -t "AC-010"` | reading+shelved 표시, completed 는 쿼리 단 status 필터로 제외 |
| AC-CLUB4-011 | PASS | `npx jest BookSelectionHub.test -t "AC-011" + clubs.new.route -t "AC-011"` | hub onSelectBook(book_id) → route router.replace({params:{bookId}}) |
| AC-CLUB4-012 | PASS | `npx jest BookSelectionHub.test -t "AC-012"` | BookCard 재사용으로 title/author 표시 (M1-3) |
| AC-CLUB4-013 | PASS | `npx jest BookSelectionHub.test -t "AC-013"` | 빈 서재(0건) → library-section 생략 + "책 검색으로 시작하기" 강조 라벨 |
| AC-CLUB4-014 | PASS | `npx jest BookSelectionHub.test -t "AC-014"` | hub-library-loading (ActivityIndicator) 표시; 빈 상태 UI 는 로딩 중 미렌더 |
| AC-CLUB4-015 | PASS | `npx jest BookSelectionHub.test -t "AC-015"` | hub-library-error 메시지 + hub-search-section 접근 유지 |
| AC-CLUB4-020 | PASS | `npx jest BookSelectionHub.test -t "AC-020"` | resolveBookId(isbn) → onSelectBook(books.id); NOT_FOUND 시 onSelectBook 미호출 + 안내 |
| AC-CLUB4-021 | PASS | `npx jest search.route.test` | standalone /search → resolveBookId → router.push(/<UUID>) 유지 (search.tsx 미변경) |
| AC-CLUB4-022 | PASS | `npx jest BookSelectionHub.test -t "AC-022"` | 허브 내 인라인 검색 (Option B) — hub-search-input/submit 렌더 |
| AC-CLUB4-030 | PASS | `npx jest clubs.new.route.test -t "AC-030"` | bookId param → ClubCreateScreen 렌더 (SPEC-CLUB-002 회귀 유지) |
| AC-CLUB4-031 | PASS | `npx jest search.route.test` | standalone /search 회귀 게이트 green (AC-021 쌍, search.tsx 미변경) |
| AC-CLUB4-032 | PASS | clubs.tsx 미변경 (검사) | onCreateClub={() => router.push('/clubs/new')} wiring 유지 |
| AC-CLUB4-033 | PASS | `npx jest BookSelectionHub.test -t "AC-033"` | reading 3행 fixture → hub-library-item 3개 렌더 (SPEC-LIBRARY-002 호환) |
| AC-CLUB4-040 | PASS | `ls supabase/migrations/*CLUB-004* 2>/dev/null` | 0 matches (DB migration 부재) |

### Lint Status (NEW vs baseline)

- `npm run lint` → **0 errors, 19 warnings** (baseline 동일 — 본 SPEC 신규 warning 0건)
- baseline 19 warnings 는 전부 unrelated 파일의 pre-existing `no-console`/`unused-vars` (본 SPEC 파일 아님)

### Test Suite

- `npx jest` (전체) → **1 failed / 153 passed suites, 1428 passed / 2 failed tests**
- 유일 실패: `src/lib/__tests__/credential-hygiene.test.ts` (gitignore service.account 매칭 — develop baseline 실패, 본 SPEC 무관)
- 본 SPEC 신규 테스트 25개 (hub 21 + route 4) 전원 PASS, 기존 회귀 테스트 green 유지

### Coverage (신규/수정 파일, 85%+ 게이트)

- `BookSelectionHub.tsx`: **100% stmts / 85.41% branch / 100% funcs / 100% lines**
- `clubs/new.tsx` (route): **100% stmts / 83.33% branch / 100% funcs / 100% lines**

### Subagent Boundary (C-HRA-008)

- `grep -rn 'AskUserQuestion' src/features/club/trackB/ "app/(tabs)/clubs/" "app/(tabs)/search.tsx" | grep -v _test` → **0 matches**

### PRESERVE regression (E8)

- `git diff develop --stat -- ClubCreateScreen.tsx hooks.ts clubApi.ts supabase/migrations/` → **empty** (PRESERVE 파일 전부 미변경)

### Gaps (미검증)

- **cross-platform build (iOS/Android Expo prebuild)**: NOT executed — 본 run-phase 는 unit/component/integration 테스트 한정. 실기기 검증(ios/android dev client + ADB)은 별도 일정 권장 (메모리 `real-device-test-environment.md` 기준).
- **실기기 검증**: hub 진입 → 서재 책 탭 → 폼 진입 플로우, 외부 검색 → 결과 선택 → 폼 진입 플로우, 빈 서재 fallback — 실기기 미검증 (단위/컴포넌트 테스트로는 동작 입증, 런타임 검증은 별도).

---

## §E.3 Run-phase Audit-Ready Signal

```yaml
run_complete_at: 2026-07-27
run_commit_sha: 804e262  # M4 (run-phase 종료 커밋). 전체 run-phase 범위: e34e533..804e262 (M1~M4)
run_status: audit-ready
ac_pass_count: 16
ac_fail_count: 0
preserve_list_post_run_count: 4  # ClubCreateScreen.tsx / hooks.ts / clubApi.ts / supabase/migrations/* — 전부 미변경
l44_pre_commit_fetch: skipped (단일 세션, feature branch — 병렬 세션 race 없음)
l44_post_push_fetch: pending  # push 후 검증 예정
new_warnings_or_lints_introduced: 0  # baseline 19 warnings 유지, 신규 0
cross_platform_build:
  ios: not-executed  # unit/component/integration 테스트 한정 — 실기기 검증 별도
  android: not-executed  # 동일
total_run_phase_files: 4  # BookSelectionHub.tsx(new) + clubs/new.tsx(modify) + 2 test files(new)
m1_to_mN_commit_strategy: per-milestone (plan artifacts commit + M1/M2/M3/M4 각 1 commit = 5 commits)
methodology: tdd (RED-GREEN-REFACTOR per milestone)
cycle_type: tdd
```

> run-phase audit-ready. 16/16 AC PASS (standalone /search · ClubCreateScreen · SPEC-LIBRARY-002 다중 reading 회귀 전부 green). sync-phase (manager-docs) 대기.

---

## Plan-phase Decisions Log (확정 — frozen)

Context-First Discovery(3질문 Socratic interview) + Approach-First 승인으로 확정된 결정. 재논의 금지.

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| D1 | 책 선택 화면 설계 | `/clubs/new` 게이트를 **통합 허브**로 재설계 (내 서재 reading+shelved 리스트 + 외부 검색 입력이 한 화면) | 사용자 선택; 단일 화면에서 두 경로 처리 |
| D2 | 외부 검색 dead-end | 외부 검색 선택 시 **모임 생성 폼으로 복귀** (`/clubs/new?bookId=`) — 현재 이탈 버그 같이 수정 | 사용자 선택; 내 서재 선택과 동일 핸드오프 |
| D3 | 부가 진입점 | **추가 안 함** — BookDetailScreen/서재 아이템 CTA는 scope 외 (별도 SPEC) | 사용자 선택; 최소 변경 원칙 |
| D4 | 완독(completed) 처리 | 선택 목록에서 **제외** (hidden 기본 — micro-decision M1-2) | 사용자 명시 요구 |
| D5 | DB 스키마 | **변경 없음** — `clubs.book_id` ↔ `user_books.book_id` 동일 `books.id` 참조 (FK 호환) | 정찰 검증 (research.md §4) |
| D6 | 다중 reading 영향 | **없음** — 한 (user, book)당 `user_books` 1행 | 정찰 검증 (research.md §3) |
| D7 | 자동 서재 추가 | createClub이 선택 책을 호스트 서재에 **자동 추가하지 않음** (현행 유지) | Out-of-Scope (spec.md §4) |

---

## Resolved [NEEDS CLARIFICATION] Markers (사용자 결정으로 해소 완료)

plan.md에 마커로 표시되었던 AC 수준 micro-decision 4종 — Socratic interview로 모두 권장값 채택 해소 (2026-07-27).

| 마커 | 주제 | 채택값 (해소) |
|------|------|---------------|
| M1-1 | 빈 서재 fallback (reading+shelved 0건) | ✅ **섹션 생략 + 외부 검색 부각** |
| M1-2 | `completed` 책 UX | ✅ **hidden (선택 목록에서 숨김)** |
| M1-3 | 서재 아이템 프레젠테이션 | ✅ **기존 `LibraryItem` 재사용** |
| M2-1 | 허브 내 검색 vs 별도 화면 | ✅ **허브 내 인라인 검색** |

> 모든 마커 해소. Implementation Kickoff Approval 전제 충족. run-phase는 위 값을 확정값으로 사용한다 (plan.md 마커는 manager-spec이 정리 또는 run-phase 주입값으로 사용).

---

## Milestone 개요 (plan.md §F 상세)

- **M1** (P0, UX flow 변경): 허브 단일 화면 재설계 + 서재 선택 목록 (reading+shelved, completed 제외)
- **M2** (P0, UX flow 변경): 외부 검색 핸드오프 수정 (dead-end fix — `/clubs/new?bookId=` 복귀)
- **M3** (P1, 시각적 마무리): 빈 상태 + completed UX + polish
- **M4** (P1, 기계적): 회귀 테스트 + 품질 게이트

---

## 산출 메모 (Generation Note)

- 핵심 산출물 3종(`spec.md` 295줄 / `plan.md` 270줄 / `acceptance.md` 314줄): manager-spec 에이전트 작성 완료.
- 보조 산출물 2종(`research.md` / `progress.md`): manager-spec이 429(5시간 사용량 한도, 리셋 2026-07-27 18:24 KST)로 산출 도중 중단되어 orchestrator가 예외적으로 직접 작성 (§4 "no specialist exists" 예외 — 보조 파일은 정찰 통합/표준 초기화로 창작적 판단 불필요).
- 핵심 3종 QA 검수: frontmatter 12필드 + tier M, REQ 4종(HUB/LIBRARY/SEARCH/REGRESSION), Out-of-Scope 6건, AC 16개(GWT), frozen 결정 4종 반영 확인.

---

## §F Phase 4 Mode Selection

> run-phase 진입 시 orchestrator 기록 (2026-07-27, Implementation Kickoff Approval 획득 — 옵션 1 "feature 브랜치 + M1→M4 순차 구현").

### Input parameters

- tier: M
- scope (file count): ~5-8 files (Tier M 범위 — 허브 재설계, 검색 핸드오프 wiring, 서재 쿼리 재사용)
- domain count: 1 (frontend React Native 단일 도메인)
- file language mix: TSX/TS (100% TypeScript React Native + Expo Router)
- concurrency benefit: LOW (coding-heavy per Anthropic coding-task parallelism caveat)

### Mode evaluation

| Mode | Selected? | Rationale |
|------|-----------|-----------|
| 1 trivial | No | 신규 허브 컴포넌트 + 라우트 재설계 — semantic change 다수 |
| 2 background | No | 구현 작업 (Write/Edit) — read-only 아님 |
| 3 agent-team | RETIRED | Mode 3 retired (Agent Teams static layer) |
| 4 parallel | No | 단일 도메인(frontend) + coding-heavy → Mode 5 선호 (coding-task parallelism caveat) |
| 5 sub-agent | **Yes** | Tier M coding-heavy 단일 도메인 — 순차 sub-agent가 안전한 기본값 |
| 6 workflow | No | 기계적 uniform transform 아님 (신규 코드 + 다규칙 semantic 작업) |

### Decision

`sub-agent` (Mode 5) — 단일 manager-develop에게 M1~M4 sequential 위임.

### Justification

Tier M + frontend 단일 도메인 + coding-heavy 작업. Anthropic multi-agent engineering note 인용: "most coding tasks involve fewer truly parallelizable tasks than research". milestone 간 의존성(M1 허브 → M2 검색 핸드오프)이 강해 단일 context에서 sequential 처리가 유리. 개발 방법론: TDD (cycle_type=tdd, 기본). sagak Git Flow: `feature/SPEC-CLUB-004-book-selection-hub` 브랜치 → PR → develop (main-direct/Hybrid Trunk 금지, 교훈 #8).

---

## Cross-References

- spec.md / plan.md / acceptance.md (본 디렉토리)
- research.md § 정찰 근거
- `.claude/rules/moai/development/spec-frontmatter-schema.md` § progress.md Section Map
- 메모리: `~/.claude/projects/-Users-ip9202-develop-vibe-sagak/memory/lessons.md` (sagak-specific lessons — run-phase 준수)
