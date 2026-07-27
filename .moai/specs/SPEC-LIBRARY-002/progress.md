---
id: SPEC-LIBRARY-002
title: "Parallel Reading Support (다중 독서 병행) — Progress"
version: "0.2.0"
status: in-progress
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

# SPEC-LIBRARY-002 — Progress

> 본 progress.md는 plan-phase 산출 시점의 초기 상태다. §E.1만 plan-phase audit-ready signal로 채워지며, §E.2 ~ §E.4는 placeholder heading + `_pending_` 노트만 유지한다. run-phase(manager-develop)는 §E.2/§E.3을, sync-phase(manager-docs)는 §E.4를 채운다.
>
> **v0.2.0 (2026-07-27) 개정**: plan-auditor iter1 FAIL (0.79, Tier M 임계 0.80 미달 + MP-7 critical) 해소. 사용자 합의 clarification 3종 (D1) 반영 — `needs_clarification_count` 3 → 0.

---

## §E.1 Plan-phase Audit-Ready Signal

- `plan_status`: audit-ready (v0.2.0 개정 — iter2 대상)
- `plan_complete_at`: 2026-07-27
- `tier`: M
- `artifact_count`: 4 (spec.md, plan.md, acceptance.md, progress.md)
- `req_count`: 22 (v0.2.0 — REQ-LIB2-001 ~ 042 + REQ-LIB2-AMEND-001; v0.1.0 16건에서 6건 증가)
  - REQ-LIB2-POLICY: 001-008 (신규 007 pgTAP 품질 규약 D2, 008 동시 INSERT 경쟁 D6)
  - REQ-LIB2-HOME: 010-014 (신규 014 로딩 상태 분기 D7)
  - REQ-LIB2-TRANSITION: 020-022
  - REQ-LIB2-VISIBILITY: 030-031
  - REQ-LIB2-REGRESSION: 040-042 (신규 040 오염 부재 D4, 042 EmotionInputScreen 직렬 mutation D8)
  - REQ-LIB2-AMEND: AMEND-001 (신규 — sync-phase amendment D3/D9)
- `ac_count`: 24 (v0.2.0 — P0=11, P1=11, P2=2; v0.1.0 20건에서 4건 증가)
  - P0 (must-pass): 11건 — DB 7건(001/002/003/004/005/006/008) + TRANSITION 2건 + EMOTION 1건 + AMEND 1건
  - P1 (should-pass): 11건 — DB 007 + UI 8건(001-006/008/009) + TRANSITION 002 + VIS 001
  - P2 (nice-to-have): 2건 — UI 007 + VIS 002
- `needs_clarification_count`: 0 (v0.2.0 — D1 해소: 3 RESOLVED via user clarifications 2026-07-27)
  - ~~홈 reading 목록 정렬 순서 (spec.md §5.1)~~ → **RESOLVED**: `last_progress_at` DESC
  - ~~기존 "오늘의 감정 기록하기" 헤더 CTA 처리 (spec.md §5.2)~~ → **RESOLVED**: 제거 (각 BookCard "기록하기" 버튼으로 대체)
  - ~~SPEC-LIBRARY-001 body in-place amendment 타이밍 (spec.md §5.3)~~ → **RESOLVED**: sync-phase (D-NEW-1 경로)
- `amendment_target`: SPEC-LIBRARY-001 (정책 5.5, REQ-LIB-020, REQ-LIB-023, 제외 범위 7) — sync-phase 수행 (사용자 합의 #3)
- `defects_resolved`: D1-D11 (전부 resolved, 2026-07-27)
  - D1 (critical, MP-7): [NEEDS CLARIFICATION] 12종 + "미해결" 3종 → RESOLVED
  - D2 (major, traceability): AC-LIB2-DB-007 "(메모리 #18)" → REQ-LIB2-007 매핑 + 신규 REQ
  - D3 (major): AC-LIB2-AMEND-001 → REQ-LIB2-AMEND-001 신규 (P0)
  - D4 (major): REQ-LIB2-040 → AC-LIB2-EMOTION-001 신규
  - D5 (minor): AC-LIB2-UI-007 "(메모리 #35)" → REQ-LIB2-041 매핑
  - D6 (major, completeness): 동시성 INSERT 경쟁 "선택적" → 필수 P0 승격 + AC-LIB2-DB-008 신규
  - D7 (major): 로딩 상태 분기 → REQ-LIB2-014 + AC-LIB2-UI-008 신규
  - D8 (major): EmotionInputScreen.onSubmit 경로 → REQ-LIB2-042 신규
  - D9 (major, consistency): plan.md M4 run-phase amendment → sync-phase 정정 (사용자 합의 #3)
  - D10 (minor, testability): AC-LIB2-DB-004 UPDATE만 → INSERT + UPDATE 양쪽 시나리오
  - D11 (minor, completeness): 부분 UNIQUE 제거 후 성능 회귀 대응 → plan.md M1 조건부 일반 인덱스 산출물
- `plan_auditor_verdict`:
  - iter1: **FAIL** (score 0.79, Tier M 임계 0.80 미달 + MP-7 critical)
  - v0.2.0 개정: iter2 대상 — 예상 score 0.82+ (clarification gate 해소 + traceability 매트릭스 강화 + 신규 REQ 5종/AC 4종 충실도)

---

## §E.2 Run-phase Evidence

### M1 — DB migration: enforce_single_reading 정책 철회 (2026-07-27)

| AC | Status | Actual Output |
|----|--------|---------------|
| AC-LIB2-DB-001 (트리거 DROP) | PASS | pg_trigger count = 0 (enforce_single_reading 제거됨) |
| AC-LIB2-DB-002 (함수 DROP) | PASS | pg_proc count = 0 (enforce_single_reading() 제거됨) |
| AC-LIB2-DB-003 (부분 UNIQUE 인덱스 DROP) | PASS | pg_indexes count = 0 (user_books_one_reading_per_user 제거됨) |
| D11 (idx_user_books_user_status 신설) | PASS | has_index PASS — (user_id, status) 복합 인덱스 |
| AC-LIB2-DB-004 (다중 reading INSERT + UPDATE) | PASS | INSERT 3행 + UPDATE→reading 3행 모두 reading 유지 (D10 양쪽) |
| AC-LIB2-DB-005 (completed/shelved 동작 유지) | PASS | completed_at 자동 설정 + completion_report 생성 + shelved 전환 + UNIQUE(user_id,book_id) 23505 유지 |
| AC-LIB2-DB-006 (잔여 BEFORE ROW 트리거 순서) | PASS | on_user_books_update 알파벳순 최초 + current_page→last_progress_at 갱신 (메모리 #20 회귀 부재) |
| AC-LIB2-DB-007 (pgTAP 4-arg throws_ok / lives_ok) | PASS | grep: throws_ok 1건(4-arg) + lives_ok 2건, 3-arg throws_ok 0건 (메모리 #18) |
| AC-LIB2-DB-008 (동시 INSERT 경쟁 순차 근사) | PASS | 순차 lives_ok INSERT x2 + reading 2행 존재 (D6 — 단일 세션 한계 순차 근사) |

**전체 pgTAP suite**: 23 files / 324 tests PASS (로컬 `supabase db test`, 2026-07-27). 0022 신규 15 tests 포함. 기존 0000-0021 회귀 0건.

---

## §E.3 Run-phase Audit-Ready Signal

- `run_complete_at`: _<M1 단계 완료 2026-07-27; M2/M3 pending>_
- `run_commit_sha`: _<M1 커밋 후 backfill>_
- `run_status`: M1 완료 (M2/M3 대기 — semi-autonomous 게이트)
- `ac_pass_count`: 8 (DB AC 전체 PASS — AC-LIB2-DB-001~008)
- `ac_fail_count`: 0
- `preserve_list_post_run_count`: 0 (기존 0000-0021 pgTAP 회귀 0건)
- `m1_to_mN_commit_strategy`: per-milestone 커밋 (M1 → M2 → M3 각각 별도 커밋)

---

## §E.4 Sync-phase Audit-Ready Signal

_<pending sync-phase — manager-docs 채움>_

`sync_commit_sha`: _<pending sync-phase backfill>_

`amendment_commit_sha`: _<pending sync-phase backfill — `docs(SPEC-LIBRARY-001): sync-phase amendment per SPEC-LIBRARY-002` (manager-spec authoring via D-NEW-1)>_

---

## §F Phase 4 Mode Selection

_<pending — orchestrator가 첫 run-phase Agent() spawn 전 채움>_

---

## §H Recursive Self-Diagnosis Log

_<pending run-phase>_

---

## §I Token Accounting

_<pending sync-close>_
