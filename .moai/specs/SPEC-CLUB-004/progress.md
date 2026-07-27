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
