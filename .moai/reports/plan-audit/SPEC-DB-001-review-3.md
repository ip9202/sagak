# SPEC Review Report: SPEC-DB-001
Iteration: 3/3 (FINAL)
Verdict: PASS
Overall Score: 0.88

Reasoning context ignored per M1 Context Isolation. Audit based solely on
`spec.md` (v1.2.0), `plan.md` (v1.2.0), `acceptance.md` (v1.2.0),
`spec-compact.md` (v1.2.0), cross-referenced against the ground-truth SSOT
`.booktalk/pages_06_ERD.md` and `.moai/project/structure.md`, the iteration-1
defect history at `.moai/reports/plan-audit/SPEC-DB-001-review-1.md`, and the
iteration-2 defect history at `.moai/reports/plan-audit/SPEC-DB-001-review-2.md`.

---

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: Main sequence REQ-DB-001 through
  REQ-DB-021 is sequential, zero-padded, no gaps, no duplicates
  (spec.md:88-558). Sub-IDs REQ-DB-008b (spec.md:274) and REQ-DB-013a~013e
  (spec.md:358-449) are suffix-extensions, not gaps/duplicates. Traceability
  table (spec.md:635; acceptance.md:32-59) enumerates the full set.
- [PASS] MP-2 EARS format compliance: All REQs use the five EARS patterns.
  Notably, the previously-informal REQ-DB-013e (iteration-2 N4) now carries a
  Ubiquitous EARS preamble: "시스템은 **항상** 인증된 사용자가 타인의 민감
  컬럼에 직접 접근하지 못하도록, 공개 컬럼만 노출하는 보안 뷰(...)를 정의해야
  한다" (spec.md:409-411). The new FK ON DELETE policy is also Ubiquitous EARS:
  "시스템은 **항상** 모든 외래키에 대해 프로젝트 기본 ON DELETE 동작으로
  RESTRICT(...)을 적용해야 한다" (spec.md:146-147). Event/State/Optional/
  Unwanted patterns all represented (e.g. REQ-DB-008 IF...THEN at spec.md:259-261;
  REQ-DB-010 WHEN...THEN at spec.md:308-310; REQ-DB-001 WHERE...THEN at
  spec.md:107-108).
- [RESOLVED] MP-3 YAML frontmatter validity: Per orchestrator authoritative
  ruling, `created` is the canonical field name per MoAI plan workflow Phase 2
  (8-field frontmatter: id, version, status, created, updated, author, priority,
  issue_number). All four documents (spec.md:5-14, plan.md:5-15,
  acceptance.md:5-15, spec-compact.md:5-17) carry the complete 8-field set plus
  `labels` array. Required field-name issue NOT re-flagged per directive.
- [N/A] MP-4 Section 22 language neutrality: SPEC targets a single technology
  stack (Supabase / PostgreSQL / SQL / Deno Edge Functions), not multi-language
  tooling. N/A, auto-passes.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.90 | 0.75→1.0 boundary | The iteration-2 CRITICAL contradiction (REVOKE-vs-RLS, N1) is eliminated: Option A model is applied identically to both `users` and `user_books` (spec.md:418-449); report_data ownership is unambiguous (spec.md:312-318); trigger guard mechanism matches requirement wording (spec.md:259-268). Remaining: the FK ON DELETE policy (spec.md:144-161) lacks a REQ-DB-XXX ID and explicit AC, and reading_sessions write policy (spec.md:544-545) uses "조회/수정" which could be read to exclude INSERT — both minor interpretation items a reasonable engineer resolves consistently. |
| Completeness | 0.90 | 0.75→1.0 boundary | All 12 ERD entities + columns + indexes covered (spec.md §3, §4 vs ERD §2, §3 — exact match). New v1.2.0 additions: FK ON DELETE RESTRICT policy (spec.md:144-161), trigger-function migration placement (plan.md:61-67), Option A permission model. Exclusions concrete (spec.md:589-602, 8 specific entries). HISTORY table updated with v1.2.0 entry (spec.md:25). Minor gap: FK ON DELETE policy lacks dedicated acceptance scenario. |
| Testability | 0.85 | 0.75 band | 18 Gherkin scenarios with observable evidence; iteration-2 N6 (non-executable negative cases) rewritten as positive assertions (acceptance.md:352-357 queries pg_policies; acceptance.md:461-466 queries pg_proc.prosecdef). Scenario 3 now asserts synchronous trigger-computed report_data (acceptance.md:169-170). Scenario 2 case 3 verifies benign-edit allowance (acceptance.md:129-133). Minor: no scenario explicitly tests FK RESTRICT behavior. |
| Traceability | 1.0 | 1.0 | acceptance.md:32-59 mapping table covers every REQ-DB-XXX including all sub-IDs (008b, 013a-013e). Each Feature carries `검증 REQ` header. The only normative clause without a dedicated AC is the FK ON DELETE global policy (it lacks a REQ-DB-XXX number by design — it is a project-wide DDL constraint implicitly validated by DoD items 1-2 "16 migrations exist + db push succeeds"). |

---

## Regression Check (Iteration 2 → Iteration 3)

| ID | Iteration 2 Summary | Status | Evidence |
|----|---------------------|--------|----------|
| N1 (CRITICAL) | REVOKE base-table SELECT on `users` breaks own-row RLS access; contradicts REQ-DB-014; `users` and `user_books` views used incompatible models | **FIXED** | Option A adopted uniformly. spec.md:418-425 explicitly states the PostgreSQL privilege/RLS evaluation order and rejects REVOKE: "베이스 테이블 SELECT는 REVOKE하지 않으며, RLS own-row 정책으로 자기 행 전체를 노출하고, 보안 뷰로 타인 행의 제한 컬럼만 노출한다." Both `user_profiles` (spec.md:427-434) and `user_books_public` (spec.md:436-444) carry identical permission-model language: "베이스 테이블 ... 의 SELECT는 REVOKE하지 않는다. ... RLS 정책 USING (auth.uid() = id\|user_id)이 자기 행만 전체 컬럼으로 노출한다." REQ-DB-014 (spec.md:458-461) and REQ-DB-015 (spec.md:469-474) confirm the same Option A model. The contradiction is genuinely eliminated, not reworded. |
| N2 (HIGH) | report_data population responsibility ambiguous between DB trigger and Edge Function | **FIXED** | spec.md:312-318 normatively states: "report_data JSONB는 **DB 트리거가 단독으로** 계산하여 채운다. 트리거는 발화 시점에 해당 사용자의 emotion_records를 집계하여 emotion_curve, highlights, total_records를 PL/pgSQL으로 산출하고 ... 상태 전환 직후(동일 트랜잭션 커밋 시점) report_data는 이미 완전히 채워져 있으며, 비동기 대기가 필요 없다. Edge Function generate-completion-report은 트리거에 의해 호출되지 않으며." acceptance.md:169-170 asserts: "report_data가 DB 트리거에 의해 단독으로 계산되어 채워진다 (비동기 대기 없음)" and "상태 전환 커밋 직후 report_data가 이미 완전히 채워져 있다". Option (a) explicitly chosen. |
| N3 (MEDIUM) | plan.md §2 item 3 falsely claimed all SECURITY DEFINER triggers live in migration 0014 | **FIXED** | plan.md:61-67 now reads: "SECURITY DEFINER 트리거 함수는 각 대상 테이블 생성 마이그레이션 내에 정의: handle_new_user는 0001(users), handle_new_club_host는 0004(clubs), join_request_accept(및 BEFORE UPDATE RAISE 가드)는 0008(join_requests), generate_completion_report는 0010(completion_reports)에 각각 정의한다 ... 헬퍼 함수 fn_user_in_club만 0014에 정의한다." Matches migration table (plan.md:39-54). |
| N4 (MEDIUM) | REQ-DB-013e opened with informal prose, no EARS clause | **FIXED** | spec.md:409-412 now begins with Ubiquitous EARS: "시스템은 **항상** 인증된 사용자가 타인의 민감 컬럼에 직접 접근하지 못하도록, 공개 컬럼만 노출하는 보안 뷰(public.user_profiles, public.user_books_public)를 정의해야 한다." Bulleted view definitions follow as sub-specification. |
| N5 (LOW) | Scenario 1 case 2 column-list omitted user_id that the view returns | **FIXED** | acceptance.md:83 now reads: "사용자 A의 공개 행의 book_id, current_page, started_reading_at, **user_id** 컬럼만 조회된다". Matches view definition at spec.md:437-438. |
| N6 (LOW) | Scenarios 10 case 2 and 15 case 2 were non-executable negative-case descriptions | **FIXED** | acceptance.md:352-357 (scenario 10 case 2) rewritten as positive assertion: "Given 마이그레이션이 적용된 데이터베이스가 있다 / When pg_policies에서 books 테이블의 정책을 조회한다 / Then authenticated 역할에 대해 cmd='SELECT' USING (true) 정책이 존재한다." acceptance.md:461-466 (scenario 15 case 2) similarly: "When pg_proc에서 4개 트리거 함수의 prosecdef 컬럼을 조회한다 / Then 각 함수의 prosecdef = true이다". Both now executable. |
| N7 (LOW) | BEFORE UPDATE RAISE over-blocked benign column edits on terminal rows | **FIXED** | spec.md:259-268 narrows the trigger: "BEFORE UPDATE 트리거가 NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'인 경우에만 RAISE EXCEPTION ... 을 발생시킨다. 이 조건은 status 컬럼 자체의 재설정만 차단하며, terminal 상태 행의 다른 컬럼(message, responded_at 등)에 대한 양성 편집은 허용한다." acceptance.md:129-133 (scenario 2 case 3) verifies benign edits succeed. Mechanism now aligns with requirement wording. |
| N8 (LOW) | FK ON DELETE behavior unspecified project-wide | **FIXED** | spec.md:144-161 adds normative Ubiquitous EARS policy: "시스템은 **항상** 모든 외래키에 대해 프로젝트 기본 ON DELETE 동작으로 RESTRICT(PostgreSQL 기본값)을 적용해야 한다." Lists explicit instances (club_members→clubs, join_requests→clubs, completion_reports→user_books, emotion_records→users/books) and defers hard-delete to a separate Edge Function (spec.md:160-161). |
| N9 (LOW) | fn_user_in_club ownership "service_role" is atypical for a DB object owner | **FIXED** | spec.md:403-405 now reads: "소유자는 BYPASSRLS 속성을 가진 역할(예: Supabase의 postgres 슈퍼유저 역할)이어야 한다 ... service_role은 함수 호출 시 RLS 우회용 연결 역할일 뿐, 함수 소유자로 권장하지 않는다." plan.md:268-270 mirrors this. |
| MP-3 | created vs created_at field name | **RESOLVED (orchestrator directive)** | Per authoritative ruling, `created` is canonical. labels present (spec.md:14). Do NOT re-flag. |

All 9 iteration-2 defects genuinely fixed. MP-3 resolved by orchestrator.

---

## Defects Found

No new CRITICAL or HIGH defects found in the v1.2.0 revision.

The Option A redesign (REQ-DB-013e / REQ-DB-014 / REQ-DB-015), the FK ON DELETE
RESTRICT policy (spec.md:144-161), and the relaxed join_request trigger
(spec.md:259-268) were each examined for new contradictions, security gaps, or
implementation infeasibility. None found:

- **Option A technical soundness verified**: With base-table GRANT + RLS own-row
  + view (security_invoker=false, owner bypasses RLS), the model is coherent.
  Direct base-table queries are RLS-filtered to own rows (full columns); other
  users' limited columns are reachable only via the views. The REVOKE
  impossibility is eliminated. Both views use the identical permission language,
  removing the iteration-2 inconsistency amplifier.
- **FK ON DELETE RESTRICT consistency**: The policy is internally consistent.
  `clubs.host_id → users.id` and all other FKs default to RESTRICT under the
  general rule (spec.md:146-147); the explicit exceptions list (spec.md:155-158)
  is a clarifying subset, not an exhaustive whitelist. `ref_id` columns in
  point_logs/notifications are intentionally polymorphic non-FK uuids and are
  correctly excluded.
- **Relaxed trigger idempotency**: The narrowed condition
  `NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'` does not
  create a re-firing hole. The AFTER UPDATE accept trigger
  (`NEW.status='accepted' AND OLD.status<>'accepted'`) does not re-fire on
  benign edits because OLD.status is already terminal. No double club_members
  insert path.

### MINOR observations (non-blocking, do not affect verdict)

**M1. spec.md:144-161 / acceptance.md — FK ON DELETE RESTRICT policy lacks a
dedicated acceptance scenario.**

The policy is normative Ubiquitous EARS ("시스템은 항상 ... 적용해야 한다") but
is placed as a global sub-section under REQ-SCHEMA-CORE without a REQ-DB-XXX
identifier, and has no Given/When/Then scenario in acceptance.md. It is
implicitly covered by DoD items 1-2 (16 migrations exist + `supabase db push`
runs without error — a malformed FK constraint would fail the migration), so it
is not unverified in practice. But for completeness a positive assertion (e.g.
"Given a club with members / When a host attempts DELETE on clubs / Then the
DELETE is blocked by RESTRICT and the club row persists") would close the gap.

Severity: minor (completeness polish; enforcement is mechanical via DDL).

**M2. spec.md:544-545 (REQ-DB-021) — reading_sessions write policy wording
uses "조회/수정" which may exclude INSERT.**

REQ-DB-021 states "WHILE 인증된 사용자가 reading_sessions를 조회/수정할 때,
THEN 시스템은 auth.uid() = user_id 조건에서만 허용해야 한다 (본인만)." The
Korean "수정" conventionally means UPDATE; INSERT is typically "생성/삽입".
Since clients start timer sessions (structure.md:100 `POST /sessions`), an
INSERT policy is needed. A reasonable engineer interprets "본인만" + WITH CHECK
to cover INSERT, but explicit "조회/생성/수정" would be clearer.

Severity: minor (wording clarity; behavior is inferable from "본인만" +
structure.md API surface).

Neither M1 nor M2 is a regression — both are pre-existing and were not flagged
in iterations 1 or 2 because they fall below the blocking threshold for a
security-critical spec.

---

## Chain-of-Verification Pass

Second-look findings, verified by re-reading each section of v1.2.0:

- **N1 re-verified with maximum scrutiny** (it was the CRITICAL load-bearing
  fix): re-read spec.md:418-449 line-by-line. The Option A model is applied
  verbatim identically to both `user_profiles` (spec.md:431-434) and
  `user_books_public` (spec.md:441-444). The PostgreSQL privilege-evaluation-
  precedes-RLS explanation (spec.md:419-421) is technically accurate. The
  contradiction with REQ-DB-014 (spec.md:453-461) and REQ-DB-015
  (spec.md:471-474) is fully resolved — all three now describe a GRANT + RLS
  own-row + view-for-others model. No residual REVOKE instruction remains
  anywhere in the four documents (cross-checked plan.md:237-245, acceptance.md
  DoD item 5 at line 576, spec-compact.md:99). ✓
- **N2 re-verified**: spec.md:312-318 + acceptance.md:169-170 + spec-compact.md
  line 80 + plan.md:101 all consistently state trigger-only ownership. No
  document retains the async-backfill ambiguity. ✓
- **N3 re-verified**: plan.md:61-67 principle text matches plan.md:39-54
  migration table cell-by-cell. spec-compact.md:175 mirrors the resolution. ✓
- **N4 re-verified**: spec.md:409-412 opens REQ-DB-013e with valid Ubiquitous
  EARS. ✓
- **N5-N9 re-verified**: each confirmed above with quoted revised text. ✓
- **MP-1 re-checked end-to-end**: REQ-DB-001 ... REQ-DB-021 + 008b + 013a-013e.
  No gaps, no duplicates, consistent zero-padding. ✓
- **Traceability re-checked for every REQ**: acceptance.md:32-59 mapping table
  complete; each Feature header carries `검증 REQ`. No orphaned AC, no
  uncovered REQ (the FK policy is a global DDL constraint, not a REQ-DB-XXX).
  ✓
- **Contradiction scan across 4 documents**: confirmed N1 (spec.md internal) is
  resolved; no new cross-document contradictions introduced by the Option A
  redesign or the FK policy. ✓
- **Option A security re-checked**: enumerated the query paths
  (`GET /rest/v1/users`, `GET /rest/v1/users?id=eq.{B}`, `GET /rest/v1/user_profiles`,
  `GET /rest/v1/user_books`, `GET /rest/v1/user_books_public`) — each returns
  exactly the intended row/column set under GRANT + RLS + view. No data-leak
  path identified. ✓
- **Exclusions re-read** (spec.md:589-602): 8 specific entries, adequately
  concrete, no scope creep. ✓

Second pass surfaced only the two minor non-blocking observations (M1, M2),
both pre-existing. No new defects introduced by the v1.2.0 revision.

---

## Recommendation

PASS. The v1.2.0 revision made genuine, substantive fixes to all 9 iteration-2
defects (N1-N9). The CRITICAL REVOKE-vs-RLS contradiction (N1) is eliminated
via a technically-correct Option A model applied uniformly to both security
views. The report_data ownership (N2), trigger-function migration placement
(N3), EARS compliance for REQ-DB-013e (N4), and the five LOW fixes (N5-N9) are
all verified fixed with quoted evidence.

MP-3 is RESOLVED per orchestrator authoritative ruling (`created` is canonical).
MP-1, MP-2 PASS with evidence. MP-4 N/A.

No new CRITICAL or HIGH defects were introduced by the Option A redesign, the
FK ON DELETE RESTRICT policy, or the relaxed join_request trigger. The two
minor observations (M1, M2) are pre-existing polish items below the blocking
threshold and do not regress from iteration 2.

The SPEC is ready to proceed to `/moai run`. Recommended non-blocking polish
during implementation:
1. Add a positive FK RESTRICT acceptance scenario (M1).
2. Tighten REQ-DB-021 reading_sessions wording to "조회/생성/수정" (M2).

Verdict: PASS
