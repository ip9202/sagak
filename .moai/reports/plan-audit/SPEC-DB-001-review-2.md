# SPEC Review Report: SPEC-DB-001
Iteration: 2/3
Verdict: FAIL
Overall Score: 0.55

Reasoning context ignored per M1 Context Isolation. Audit based solely on
`spec.md` (v1.1.0), `plan.md` (v1.1.0), `acceptance.md` (v1.1.0),
`spec-compact.md` (v1.1.0), cross-referenced against the ground-truth SSOT
`.booktalk/pages_06_ERD.md` and `.moai/project/structure.md`, and the
iteration-1 defect history at `.moai/reports/plan-audit/SPEC-DB-001-review-1.md`.

---

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ-DB-001 through REQ-DB-021 main
  sequence is intact, zero-padded, no gaps, no duplicates. Sub-IDs REQ-DB-008b
  (spec.md:248) and REQ-DB-013a~013e (spec.md:323-390) are suffix-extensions
  on existing parent numbers, not gaps or duplicates (spec.md:571 traceability
  row enumerates the full set).
- [PASS] MP-2 EARS format compliance: spec.md REQs continue to use all five
  EARS patterns (Ubiquitous/Event/State/Optional/Unwanted) — e.g.
  REQ-DB-008b "WHEN ... THEN" (spec.md:250-252), REQ-DB-008 Unwanted "IF ...
  THEN" (spec.md:236-238). acceptance.md uses Gherkin, accepted as a separate
  test-plan document per iteration 1 (D12). Caveat: REQ-DB-013e
  (spec.md:370-390) drifts into descriptive/informal prose ("따라서 보안 뷰를
  사용한다") rather than a single clean EARS clause — see N5.
- [FAIL] MP-3 YAML frontmatter validity: The required field `created_at` is
  STILL ABSENT. spec.md:7 (and plan.md:8, acceptance.md:8, spec-compact.md:9)
  uses the field name `created: 2026-06-14`, not `created_at`. The iteration-1
  report explicitly flagged this exact field-name defect, and the v1.1.0
  revision added `labels` (fixing that half of MP-3) but did NOT rename
  `created` → `created_at`. The required field by the mandated name is missing.
  Type/value are valid ISO dates, but the field NAME is non-conformant. Any
  missing required field by canonical name = FAIL.
- [N/A] MP-4 Section 22 language neutrality: SPEC targets a single technology
  stack (Supabase/PostgreSQL/SQL), not multi-language tooling. N/A, auto-passes.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.50 | 0.50 | REQ-DB-013e REVOKE instruction (spec.md:380-381) directly contradicts REQ-DB-014 own-row access (spec.md:394-395); REQ-DB-013e prose is informal, not EARS; report_data ownership ambiguous (spec.md:282-293) |
| Completeness | 0.75 | 0.75 | All 12 ERD entities + columns + indexes covered; new REQs 008b/013a-013e close prior gaps; but FK ON DELETE behavior unspecified project-wide, and the security-view permission model is incomplete (no own-full-row path for users under REVOKE) |
| Testability | 0.75 | 0.75 | 18 scenarios with observable evidence; prior D6 coverage gaps closed; but scenarios 10 case 2 and 15 case 2 are non-executable negative-case descriptions (acceptance.md:340-345, 449-453), and scenario 1 case 2 column-list assertion omits user_id that the view actually returns (acceptance.md:80 vs spec.md:383) |
| Traceability | 1.0 | 1.0 | acceptance.md:27-56 mapping table covers every REQ-DB-XXX including all new sub-IDs; each Feature carries `검증 REQ` header; D6 from iteration 1 fully resolved |

---

## Regression Check (Iteration 1 → Iteration 2)

| ID | Iteration 1 Summary | Status | Evidence |
|----|---------------------|--------|----------|
| D1 | RLS cannot do column masking; REQ-014/015 infeasible | PARTIAL-FIX (introduces N1) | REQ-DB-013e (spec.md:370-390) adds the two security views — the VIEW concept is correct and the `user_books_public` permission model is sound. BUT the `user_profiles` instruction (spec.md:379-381) says "베이스 테이블의 SELECT는 anon/authenticated에 REVOKE하고, 오직 자기 행만 RLS로 노출한다", which is a PostgreSQL semantic impossibility: REVOKE removes the SELECT privilege that RLS depends on, so "오직 자기 행만 RLS로 노출" cannot fire. This creates NEW defect N1 (see below). The view layer is added but the base-table permission model for `users` is self-contradictory. |
| D2 | Missing clubs→host_member trigger | FIXED | REQ-DB-008b (spec.md:248-258) defines `handle_new_club_host()` SECURITY DEFINER on clubs AFTER INSERT; migration 0004 (plan.md:39); scenario 11 (acceptance.md:347-368); assumption 2.2.1 (spec.md:59-60). |
| D3 | WHERE guard doesn't reject re-processing | FIXED | REQ-DB-008 (spec.md:236-242) now specifies BEFORE UPDATE trigger `RAISE EXCEPTION 'join_requests status is terminal: %'` when `OLD.status <> 'pending'`; plan.md:128-130; scenario 2 case 2 (acceptance.md:118-123) asserts exception + 0-row commit. |
| D4 | Only handle_new_user marked SECURITY DEFINER | FIXED | REQ-DB-013c (spec.md:341-355) enumerates all 4 triggers (handle_new_user, join_request_accept, handle_new_club_host, generate_completion_report); scenario 15 (acceptance.md:435-454) verifies `pg_proc.prosecdef = true` for each. |
| D5 | books SELECT policy only a comment | FIXED | REQ-DB-013b (spec.md:330-339) promoted to formal REQ, MUST-PASS; scenario 10 (acceptance.md:326-345). |
| D6 | 6+ REQs had no acceptance scenario | FIXED | acceptance.md:27-56 mapping table covers all REQs; scenarios 10-18 added for books/reading_sessions/point_logs/notifications/sticker_reactions read/club_members read/REQ-021 tables. |
| D7 | RLS self-recursion on club_members | FIXED | REQ-DB-013d (spec.md:357-368) defines `fn_user_in_club(p_club_id uuid) RETURNS boolean` SECURITY DEFINER; used in REQ-DB-016 (spec.md:421-422) and REQ-DB-019 (spec.md:453-455); plan.md:248-254; scenario 16 (acceptance.md:456-487) verifies recursion is broken. |
| D8 | `pg_graphic` does not exist | FIXED | spec.md:53-54 now states `gen_random_uuid()` is core on PG13+; pgcrypto only for PG12-. |
| D9 | AC references wrong-table column | FIXED | acceptance.md:82-84, 96 corrected; scenario 17 (acceptance.md:489-518) uses reading_alarm_time correctly in users context. |
| D10 | Scenario 6 non-deterministic | FIXED | acceptance.md:247-264 asserts single 409 outcome; Open Question 6.2 (spec.md:552-556) resolved. |
| D11 | completion_reports idempotency underspecified | FIXED | REQ-DB-010 (spec.md:286-293) specifies `ON CONFLICT (user_book_id) DO NOTHING` + UNIQUE + WHERE guard; scenario 3 case 3 (acceptance.md:167-173) tests completed→reading→completed cycle. |
| D12 | Gherkin lacks REQ traceability headers | FIXED | acceptance.md:22-25 memo + 27-56 mapping table + per-Feature `검증 REQ` headers. |
| D13 | sticker_type ENUM diverges from ERD | ADDRESSED | spec.md:165-168 explicit deviation memo (ERD-편차 메모), citing iteration-1 D13. Acceptable (option (a) of fix). |
| D14 | users RLS silent on admin | ADDRESSED | spec.md:98-101, 402-403 document `role='admin'` as reserved, no MVP admin policy. Acceptable (option (b) of fix). |
| D15 | clubs type CHECK allows 'instant' | ADDRESSED | spec.md:199-202 documents app-layer rejection of `type='instant'` for MVP. Acceptable (option (b) of fix). |
| MP-3 | Missing `labels`, wrong field name `created` | PARTIAL-FIX → NOT-FIXED | `labels` added (spec.md:11). BUT `created` field name retained (spec.md:7) — the required `created_at` field is STILL ABSENT. Same non-conformance as iteration 1. |

---

## Defects Found

### CRITICAL

**N1. spec.md:379-381 (REQ-DB-013e) vs spec.md:394-395 (REQ-DB-014) — PostgreSQL
privilege/RLS contradiction: REVOKE base-table SELECT breaks own-row RLS access
for the `users` table.**

REQ-DB-013e instructs: "권한: `authenticated` 역할에 `SELECT` GRANT.
`public.users` 베이스 테이블의 `SELECT`는 `anon`/`authenticated`에 REVOKE하고,
오직 자기 행만 RLS로 노출한다."

REQ-DB-014 requires: "WHILE 인증된 사용자가 `users` 테이블(베이스 테이블)을
조회할 때, 자신의 행(`auth.uid() = id`)만 전체 조회할 수 있도록 허용해야 한다."

Scenario 17 case 1 (acceptance.md:496-499) asserts: "사용자는 자신의 users 행을
전체 조회할 수 있다 ... 자신의 행이 모든 컬럼(email, reading_alarm_time 등
포함)과 함께 반환된다."

These three are mutually exclusive in PostgreSQL. Privilege evaluation precedes
RLS: if `SELECT` is REVOKED from `authenticated` on `public.users`, then
PostgREST's request `GET /rest/v1/users?id=eq.{A}` fails at the GRANT layer
(`permission denied for relation users`) — the RLS own-row policy never
executes. The phrase "REVOKE하고, 오직 자기 행만 RLS로 노출한다" is a category
error: RLS cannot expose rows of a table on which the role lacks SELECT
privilege.

Net effect: an implementer following REQ-DB-013e literally produces a system
where users CANNOT retrieve their own full profile via the base table, breaking
REQ-DB-014 and scenario 17 case 1.

Inconsistency amplifier: the sibling view `user_books_public` (spec.md:386-387)
does NOT carry this error — it says "`public.user_books` 베이스 테이블의 SELECT는
자기 행만 RLS로 노출" (no REVOKE). The two views thus use incompatible permission
models for the same logical pattern, which will confuse implementers and reviewers.

This is a direct regression introduced by the D1 fix attempt: the view concept
is correct, but the REVOKE-on-users instruction is technically wrong and
internally contradicts a sibling requirement.

Severity: critical (security-critical RLS spec; a literal reading produces a
non-functional own-profile endpoint and an inconsistent permission model).

**Fix (manager-spec):** Pick one coherent model and apply it to BOTH views:
- Option A (recommended, matches existing scenarios): Keep `GRANT SELECT` on
  base `users` and `user_books` for `authenticated`; rely on RLS own-row policy
  for full-own-row access; expose `user_profiles` / `user_books_public` as the
  only surface for OTHER users' limited columns. Remove the REVOKE instruction.
  RLS already prevents column exposure of OTHER users' rows because those rows
  are filtered out entirely — the view's value is providing a limited-column
  projection of otherwise-hidden rows, which works with `security_invoker=false`
  + view-owner privileges.
- Option B (stricter, requires scenario revision): Fully REVOKE base-table
  SELECT; add a third view `user_self_full` (security_invoker or auth.uid()
  filter) returning the caller's own full row; update scenario 17 case 1 to
  query `user_self_full` instead of the base table.

Either way, align the two views on a single model and remove the
"REVOKE-and-RLS-will-still-show-own-row" phrasing.

### HIGH

**N2. spec.md:282-293 (REQ-DB-010) vs acceptance.md:152-159 (scenario 3) vs
spec.md:530-531 (exclusion 5.2) — `report_data` population responsibility is
ambiguous between the DB trigger and the Edge Function.**

REQ-DB-010 specifies the `generate_completion_report()` DB trigger creates the
`completion_reports` row. Scenario 3 (acceptance.md:156-158) asserts the row's
`report_data.total_records` is 5 and `emotion_curve` / `highlights` are
non-empty — i.e., the trigger must produce a fully-populated JSONB aggregate
over the user's emotion_records for that book.

Simultaneously, exclusion §2 (spec.md:529-531) states the Edge Function
`generate-completion-report` is out of scope, and structure.md:122 lists it as
a distinct server-side function. The spec never states whether:
(a) the trigger computes the full aggregate in PL/pgSQL (substantial logic,
    race-prone against concurrent emotion_records inserts), or
(b) the trigger inserts a stub row and the Edge Function backfills `report_data`,
    or
(c) the trigger calls the Edge Function via `pg_net` / `http`.

Scenario 3's Given/When/Then assumes (a) — the trigger alone produces a
fully-populated report_data. If the implementer chooses (b), scenario 3 case 1
fails immediately after the status flip (report_data would be null/stub until
the async Edge Function runs). This is a load-bearing ambiguity in a
security/integrity-critical auto-generation flow.

Severity: high (the idempotency fix D11 is sound, but the content-generation
ownership gap makes scenario 3 non-deterministic across implementations).

**Fix:** Add a normative sentence to REQ-DB-010 stating which component owns
`report_data` computation. Recommended: "The DB trigger inserts the row with
`report_data` computed by aggregating the user's `emotion_records` for the
target book at trigger time. The Edge Function `generate-completion-report` is
reserved for future rich-content generation and is NOT invoked by the trigger."
Then add an acceptance assertion that the trigger-computed `report_data` is
present immediately after the status flip (no async wait).

### MEDIUM

**N3. plan.md:58-59 vs plan.md:36-47 — Migration plan mislocates SECURITY
DEFINER trigger-function definitions.**

§2 "순서 설계 원칙" item 3 (plan.md:58-59) states: "SECURITY DEFINER 함수는 RLS
직전: 헬퍼 함수(fn_user_in_club)와 트리거 함수들이 RLS 정책(0014)에서
참조되므로, 함수 정의는 0014 내에 포함."

But the migration table (plan.md:36-47) places the four SECURITY DEFINER
trigger functions in their respective table-creation migrations:
- `handle_new_user` in 0001 (plan.md:36)
- `handle_new_club_host` in 0004 (plan.md:39)
- `join_request_accept` (and the BEFORE UPDATE RAISE guard) in 0008 (plan.md:43)
- `generate_completion_report` in 0010 (plan.md:45)

Only `fn_user_in_club` is in 0014 (plan.md:49). The claim "트리거 함수들이 ...
0014 내에 포함" is false for all four triggers.

This does not break the migration (trigger functions can be defined before RLS
policies exist, since SECURITY DEFINER bypasses RLS at run-time), but it
actively misleads the implementer about where to place function definitions and
creates a review-traceability mismatch. An implementer following §2 literally
would either duplicate the function definitions in 0014 (causing CREATE
FUNCTION conflicts) or move them out of 0001/0004/0008/0010 (breaking those
migrations' triggers).

Severity: medium (plan-level inconsistency; does not block but will cause
implementation confusion).

**Fix:** Reword plan.md:58-59 item 3 to: "SECURITY DEFINER 트리거 함수는 각
대상 테이블 생성 마이그레이션(0001/0004/0008/0010) 내에 정의한다.
헬퍼 함수 `fn_user_in_club`만 0014에 정의한다 (RLS 정책 0014에서 참조하므로).
트리거 함수의 SECURITY DEFINER 속성은 RLS 활성화 시점과 무관하게 동작한다."

**N4. spec.md:370-390 (REQ-DB-013e) — Informal prose instead of EARS clause;
weakens the normative force of a MUST-PASS security requirement.**

REQ-DB-013e opens with explanatory prose: "PostgreSQL RLS는 행 수준 격리만
수행하며 ... 따라서 보안 뷰를 사용한다 (D1 해결 — 컬럼 마스킹 메커니즘 결정)."
The actual normative statements ("보안 뷰 1: ...", "권한: ... GRANT ... REVOKE")
are bulleted design descriptions, not a single EARS-pattern clause ("The system
shall ..."). For a requirement explicitly flagged MUST-PASS (spec.md:370), the
lack of a crisp EARS trigger leaves acceptance ambiguous.

Severity: medium (does not by itself flip MP-2 to FAIL because the surrounding
REQs remain EARS-compliant and acceptance.md carries the binary test in
Gherkin, but the requirement text itself is the weakest in the document).

**Fix:** Prefix REQ-DB-013e with a Ubiquitous EARS clause: "시스템은 항상
`public.user_profiles` 및 `public.user_books_public` 보안 뷰를 정의하여,
인증된 사용자가 타인의 민감 컬럼에 직접 접근하지 못하도록 해야 한다." Then
keep the bulleted view definitions as sub-specification.

### LOW

**N5. acceptance.md:80 (scenario 1 case 2) vs spec.md:383 (view definition) —
Column-list assertion omits `user_id`, which the view actually returns.**

Scenario 1 case 2 asserts "사용자 A의 공개 행의 book_id, current_page,
started_reading_at 컬럼만 조회된다". But the `user_books_public` view
(spec.md:383-384) is `SELECT book_id, current_page, started_reading_at, user_id
FROM public.user_books WHERE is_public = true` — it also returns `user_id`.
The "컬럼만" (only these columns) assertion would fail at test time because
`user_id` is an additional returned column.

Severity: low (cosmetic mismatch; the spirit of the test is correct).

**Fix:** Update acceptance.md:80 to: "사용자 A의 공개 행의 book_id,
current_page, started_reading_at, user_id 컬럼만 조회된다 (그 외 컬럼 노출 안 됨)".

**N6. acceptance.md:340-345 (scenario 10 case 2) and acceptance.md:449-453
(scenario 15 case 2) — Non-executable negative-case scenarios.**

Both scenarios describe a hypothetical misconfiguration ("When SELECT
USING(true) 정책이 실수로 생략된 경우" / "When join_request_accept 트리거가
SECURITY INVOKER로 잘못 정의된 경우") and then assert "But 이것은 회귀 테스트로
감지되어야 한다 — 정책/SECURITY DEFINER 존재 단정". As written, the Given/When/Then
describes the FAILURE state, not a testable PASS state. The real executable
assertion (query `pg_policies` / `pg_proc.prosecdef`) is already covered by
case 1 of each scenario, making case 2 redundant and confusing rather than a
coverage gain.

Severity: low (does not reduce coverage; muddies the test plan).

**Fix:** Either delete case 2 of scenarios 10 and 15, or rewrite each as a
positive assertion: "Given 마이그레이션이 적용된다 / When pg_policies에서 books의
SELECT 정책을 조회한다 / Then USING (true) 정책이 authenticated 역할에 대해
존재한다." Same shape for scenario 15 case 2 with `pg_proc.prosecdef`.

**N7. spec.md:236-242 (REQ-DB-008) vs plan.md:128-130 — BEFORE UPDATE RAISE
trigger over-blocks benign column edits on terminal rows.**

REQ-DB-008 phrases the guard narrowly: "status 컬럼을 다시 업데이트하려 하면"
(when attempting to update the status column again). The specified mechanism
(`OLD.status <> 'pending'` → RAISE) fires on ANY UPDATE to a terminal row,
including non-status column edits (e.g., correcting `message` or
`responded_at`). The mechanism is stricter than the requirement wording.

Severity: low (conservative over-blocking is defensible for a terminal-state
audit table; but the requirement text and the mechanism text diverge).

**Fix:** Either tighten REQ-DB-008's wording to "terminal 상태의 요청에 대한
모든 UPDATE를 거부한다" (matching the mechanism), or narrow the trigger to fire
only when `NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'pending'`.

**N8. FK ON DELETE behavior unspecified project-wide.**

No REQ specifies ON DELETE cascade/restrict/set-null behavior for any foreign
key. Notably, `club_members.club_id → clubs.id` and
`join_requests.club_id → clubs.id` will RESTRICT host-initiated club deletion
while members/requests exist (Postgres default). REQ-DB-018 (spec.md:443-444)
grants host DELETE on clubs, but the spec does not state whether deletion
should cascade or be blocked. Same for `completion_reports.user_book_id →
user_books.id` and `emotion_records` cascades.

Severity: low (schema-completeness gap, not a contradiction).

**Fix:** Add a single REQ under REQ-SCHEMA-CORE specifying the project-wide FK
ON DELETE policy (recommended: RESTRICT for user-data FKs, with explicit app-
layer soft-delete via status columns), or annotate each FK inline.

**N9. spec.md:368, plan.md:251, acceptance.md:447 — `fn_user_in_club` ownership
"service_role" is atypical for a database object owner.**

Supabase's `service_role` is a connection role used with the service key; it is
not typically the owner of `CREATE FUNCTION` objects (the default owner is the
`postgres` role running the migration). Specifying "소유자는 service_role 또는
bypassrls 권한을 가진 역할" is implementable but will require a non-default
`ALTER FUNCTION ... OWNER TO` step that the spec does not explicitly call out.
The "bypassrls 권한을 가진 역할" alternative is sounder.

Severity: low (operational clarity).

**Fix:** Reword to "소유자는 `BYPASSRLS` 속성을 가진 역할(예: Supabase의
`postgres` 슈퍼유저 역할)이어야 한다. `service_role`은 함수 호출 시 RLS 우회용
연결 역할일 뿐, 함수 소유자로 권장하지 않는다."

---

## Chain-of-Verification Pass

Second-look findings, verified by re-reading each section:

- All 9 iteration-1 defects D1-D11 + D13/D14/D15 re-checked individually above;
  D6 traceability re-verified end-to-end against every REQ-DB-XXX (acceptance.md
  mapping table at 27-56 is complete). ✓
- MP-3 re-checked field-by-field: `created_at` is genuinely absent (spec.md:7
  uses `created`). NOT-FIXED confirmed. ✓
- N1 (REVOKE vs RLS) re-verified against PostgreSQL privilege-evaluation order
  — the contradiction is definitive, not a matter of interpretation. This is
  the finding most likely to have been a false positive, so it received the
  most scrutiny; it holds. ✓
- SECURITY DEFINER trigger count re-verified: exactly 4 in REQ-DB-013c, plan
  migration table, scenario 15, and DoD item 7 — consistent. ✓
- `fn_user_in_club` naming consistency re-checked across spec.md / plan.md /
  acceptance.md — uniform. ✓
- New scenarios 10-18 re-read line-by-line; found N5, N6 (column-list and
  negative-case issues) on the second pass, not the first. ✓
- Contradiction scan across the 4 documents: confirmed N1 (spec.md internal)
  and N3 (plan.md internal). No cross-document contradictions beyond those
  listed. ✓
- Exclusions section re-read (spec.md:523-538): 8 specific entries, adequately
  concrete, no scope creep. ✓

First pass found N1-N4; second pass added N5-N9 and confirmed the MP-3
non-fix. The first pass was thorough on the security-critical items; the
second pass primarily surfaced LOW-severity polish issues.

---

## Recommendation

FAIL. The v1.1.0 revision made substantial, genuine progress — D2, D3, D4, D5,
D6, D7, D8, D9, D10, D11, D12 are all truly fixed (not merely reworded), and
D13/D14/D15 are acceptably addressed via documentation. The security-view
concept (REQ-DB-013e), the `fn_user_in_club` recursion-breaker (REQ-DB-013d),
the BEFORE UPDATE RAISE trigger (REQ-DB-008), and the SECURITY DEFINER
enumeration (REQ-DB-013c) are all structurally correct.

However, two blocking items remain:

1. **Resolve MP-3 (frontmatter)** — Rename `created` → `created_at` in all
   four documents (spec.md:7, plan.md:8, acceptance.md:8, spec-compact.md:9).
   This is the second iteration this exact field-name defect has been flagged;
   it is a 4-character fix and its persistence suggests the author may be
   editing the wrong field. Flag as a stagnation risk if it appears unchanged
   in iteration 3.

2. **Resolve N1 (CRITICAL)** — The REVOKE-vs-RLS contradiction in REQ-DB-013e
   (spec.md:379-381) must be eliminated. Pick Option A (drop REVOKE, keep GRANT
   + RLS own-row; recommended) or Option B (full REVOKE + third `user_self_full`
   view + scenario 17 case 1 revision). Align the `users` and `user_books`
   permission models so they use the same pattern. This is the most important
   fix: a literal implementation of the current spec produces a non-functional
   own-profile endpoint.

Recommended additional (non-blocking) fixes before `/moai run`:
3. Resolve N2 — state explicitly in REQ-DB-010 that the DB trigger computes
   `report_data` at trigger time (no async Edge Function dependency).
4. Resolve N3 — correct plan.md:58-59 to match the migration table.
5. Resolve N4 — add an EARS preamble to REQ-DB-013e.
6. Apply N5-N9 polish fixes during implementation.

If iteration 3 lands with MP-3 and N1 still unresolved, the report should
escalate to user intervention per the retry-loop contract — MP-3 stagnation
across two iterations indicates a systematic misunderstanding rather than a
missed fix.

Verdict: FAIL
