# SPEC Review Report: SPEC-DB-001
Iteration: 1/3
Verdict: FAIL
Overall Score: 0.45

Reasoning context ignored per M1 Context Isolation. Audit based solely on
`spec.md`, `plan.md`, `acceptance.md`, `spec-compact.md`, cross-referenced
against the ground-truth SSOT `.booktalk/pages_06_ERD.md` and
`.moai/project/structure.md`.

---

## Must-Pass Results

- [PASS] MP-1 REQ number consistency: REQ-DB-001 through REQ-DB-021 are
  sequential, zero-padded, no gaps, no duplicates (spec.md:73-383).
- [PASS] MP-2 EARS format compliance: All five EARS patterns are used in
  spec.md requirements — Ubiquitous ("항상 … 해야 한다"), Event-driven
  ("WHEN … THEN"), State-driven ("WHILE … THEN"), Optional ("WHERE … THEN"),
  Unwanted ("IF … THEN"). See REQ-DB-001 (spec.md:81-89), REQ-DB-008
  (spec.md:212-213), REQ-DB-014 (spec.md:287-289). Note: `acceptance.md`
  uses Gherkin Given/When/Then, which is acceptable as a separate test-plan
  document but is NOT EARS — see D12.
- [FAIL] MP-3 YAML frontmatter validity: `spec.md:1-11` frontmatter is
  missing the required `labels` field entirely, and uses field name `created`
  instead of the required `created_at`. Same defects repeat in `plan.md:1-10`,
  `acceptance.md:1-10`, `spec-compact.md:1-9`. Any missing required field = FAIL.
- [N/A] MP-4 Section 22 language neutrality: SPEC targets a single
  technology stack (Supabase/PostgreSQL), not multi-language tooling. N/A,
  auto-passes.

---

## Category Scores (0.0-1.0, rubric-anchored)

| Dimension | Score | Rubric Band | Evidence |
|-----------|-------|-------------|----------|
| Clarity | 0.75 | 0.75 | Most REQs unambiguous; REQ-DB-008 rejection mechanism conflated with trigger guard (spec.md:212-213 vs plan.md:121); REQ-DB-014/015 column-masking infeasible as written |
| Completeness | 0.75 | 0.75 | All 12 entities + columns + indexes match ERD faithfully; but RLS coverage for books SELECT policy (spec.md:280 note only), and host-auto-membership trigger are missing |
| Testability | 0.50 | 0.50 | acceptance.md scenario 6 offers two alternative outcomes ("409 또는 upsert … 정책 결정 필요", acceptance.md:206); several RLS policies have no observable AC |
| Traceability | 0.50 | 0.50 | REQ-DB-002 (books), REQ-DB-009 (reading_sessions), REQ-DB-011 (point_logs), REQ-DB-012 (notifications), REQ-DB-017 read policy, REQ-DB-019 read policy, REQ-DB-021 (all 4 tables) have no acceptance scenario |

---

## Defects Found

### CRITICAL

**D1. spec.md:287-301, acceptance.md:37-42 — RLS cannot perform column-level
masking; REQ-DB-014 and REQ-DB-015 are technically infeasible as written.**
PostgreSQL RLS is row-level: a policy decides whether a row is visible, not
which columns are returned. REQ-DB-014 requires "타인은 nickname, avatar_url
컬럼만 노출" and REQ-DB-015 requires "타인은 … book_id, current_page,
started_reading_at 컬럼만 노출". Pure RLS cannot satisfy either. The
requirement must be implemented via (a) column-level GRANT/REVOKE, or (b) a
security `VIEW` exposed to clients. Open Question 6.3 (spec.md:448-455)
defers this decision and plan.md §3 relegates the view to "Optional Goal".
For a security-critical spec, the enforcement mechanism must be normative,
not optional.
**Fix**: Replace the column-masking language with a concrete mechanism:
define `public.user_profiles` (view) and `public.user_books_public` (view)
as the only client-readable surfaces for other users' rows, REVOKE table
SELECT from the `anon`/`authenticated` roles on sensitive columns, and add
formal REQs for these views. Promote the view from "Optional" to a must-pass
REQ.

**D2. spec.md:55-57, 215-217, plan.md — Missing trigger/logic to auto-insert
the club creator as `club_members(role='host')` on clubs INSERT.**
Assumption 2.1 states "개설자는 자동으로 club_members(role='host')에
추가된다". But no REQ defines the trigger that performs this INSERT. Only
the `join_requests → club_members` (member) trigger is specified
(REQ-DB-008, spec.md:215-217). Without a clubs-INSERT trigger, Track B
creators are not members of their own clubs, breaking host detection
(`club_members` RLS, host-only feeds, etc.).
**Fix**: Add an explicit REQ under REQ-SCHEMA-SOCIAL: "WHEN an authenticated
user INSERTs a row into `clubs`, THEN the system shall insert a
`club_members(club_id, user_id=auth.uid(), role='host')` row via a
SECURITY DEFINER trigger."

**D3. spec.md:212-213, plan.md:121 — REQ-DB-008 "reject re-processing" is
not achievable by the described `WHERE OLD.status='pending'` guard.**
REQ-DB-008 (Unwanted) requires "이미 accepted/declined인 요청을 다시
업데이트하려 하면, 시스템은 해당 작업을 거부해야 한다". plan.md:121
mitigation uses a trigger `WHERE OLD.status='pending'` guard. A WHERE
clause on a trigger body only suppresses the side effect — the underlying
UPDATE still commits the status change. acceptance.md:75-79 scenario 2
case 2 asserts "요청이 거부된다 (0행 영향 또는 에러)". The described
mechanism does not produce 0-row-affect or an error; it silently allows
the mutation while skipping the club_members insert.
**Fix**: Specify a BEFORE UPDATE trigger that `RAISE EXCEPTION` when
`OLD.status <> 'pending'`, OR a CHECK constraint with a generated-column
guard, OR an RLS UPDATE policy `USING (status='pending')`. State which
mechanism is normative in REQ-DB-008.

### HIGH

**D4. spec.md:345-347, 373-374 — Triggers that INSERT into RLS-protected
tables (club_members, completion_reports, notifications) will fail unless
the trigger function is `SECURITY DEFINER`; this is unspecified for all but
handle_new_user.**
plan.md:138-140 mentions SECURITY DEFINER only for `handle_new_user`. The
join_requests→club_members trigger runs with the invoking user's privileges.
No INSERT policy is defined on club_members for clients (correctly), so the
trigger INSERT will be denied by RLS. Same risk for completion_reports and
notifications triggers.
**Fix**: Add a normative requirement: "All triggers that INSERT into
RLS-protected tables MUST be defined on SECURITY DEFINER functions owned by
a role with INSERT privilege, OR executed via service_role." Enumerate the
four triggers (handle_new_user, join_request_accept, club_create_host_member,
completion_report_generate) and require SECURITY DEFINER for each.

**D5. spec.md:280 — No formal REQ defines the `books` SELECT policy.**
REQ-DB-013 only enables RLS on the 11 user-data tables and relegates books
to a comment: "books 테이블은 공개 카탈로그이므로 RLS 활성화 후
SELECT USING (true) 정책을 적용한다". A comment is not a requirement. If
the implementer enables RLS on books (per acceptance.md:302 "books 테이블만
SELECT USING (true)") but forgets the policy, the entire book catalog
becomes unreadable and every feature depending on book lookups breaks.
**Fix**: Add an explicit REQ-DB-013b: "The system shall enable RLS on
`books` and define a single SELECT policy `USING (true)` for the
`authenticated` role."

**D6. acceptance.md — REQ-DB-009, REQ-DB-011, REQ-DB-012, REQ-DB-017
(read), REQ-DB-019 (read), REQ-DB-021 (all four tables) have no acceptance
scenario.**
Traceability is broken for 6+ requirements. reading_sessions, point_logs,
notifications each have a schema REQ and an RLS REQ but zero observable
acceptance criteria. The manual checklist (acceptance.md:298-308) lists
"ROW LEVEL SECURITY: ENABLED" but that only checks the flag, not the
policy behavior. For a security-critical spec, an untested RLS policy is a
latent data-leak.
**Fix**: Add at minimum 2 Given/When/Then scenarios per uncovered REQ:
(a) self can read own rows, (b) other user cannot read them; plus the
service_role INSERT path for notifications/point_logs/completion_reports.

**D7. spec.md:139-143, acceptance.md:152-159 — emotion_records `visibility='club'`
RLS policy references club_members membership, but RLS self-recursion is
unaddressed.**
REQ-DB-016 requires exposing club-visible rows when "요청자가 해당 club_id의
멤버인 기록". The natural implementation is an `EXISTS (SELECT 1 FROM
club_members WHERE user_id=auth.uid() AND club_id=emotion_records.club_id)`
subquery in the policy. But club_members itself has RLS (REQ-DB-019), so
the subquery is subject to club_members' own policy → recursion / empty
result. Same pattern for club_members' own read policy
("같은 club_id의 멤버인 행만") which references club_members itself.
**Fix**: Specify a `SECURITY DEFINER` helper function (e.g.
`is_club_member(p_club_id uuid)`) owned by a bypass role, used inside the
RLS policies to break the recursion. Add this as a normative REQ.

### MEDIUM

**D8. spec.md:50 — Factual error: "pg_graphic" extension does not exist.**
Assumption 2.4 says "pgcrypto 또는 pg_graphic 확장 필요". There is no
PostgreSQL extension named `pg_graphic`. `gen_random_uuid()` is provided by
`pgcrypto` (and is core since PostgreSQL 13). An implementer may waste time
searching for a nonexistent extension.
**Fix**: Replace "pg_graphic" with the correct guidance:
"`gen_random_uuid()` is built-in on PostgreSQL 13+ (Supabase default); no
extension required. For older versions, enable `pgcrypto`."

**D9. acceptance.md:42 — Acceptance criterion references a column that does
not exist on the table under test.**
Scenario 1 case 2 asserts "사용자 A의 reading_alarm_time 등 민감 컬럼은
노출되지 않는다" for `user_books`. `reading_alarm_time` is a column on
`users` (ERD 2.1, spec.md:78), NOT on `user_books`. The AC is testing the
wrong table.
**Fix**: Replace `reading_alarm_time` with an actual sensitive column on
`user_books` (e.g., `started_reading_at` for non-public rows, or remove the
cross-table reference).

**D10. acceptance.md:206 — Scenario 6 is non-deterministic: offers two
alternative outcomes without specifying which is normative.**
"Then UNIQUE(record_id, user_id) 제약 위반으로 실패한다 (409) # 또는 upsert
처리로 기존 리액션이 touching으로 교체된다 (정책 결정 필요)". A test
cannot pass or fail an OR of two behaviors. Open Question 6.2
(spec.md:440-445) is the root cause.
**Fix**: Resolve Open Question 6.2 before implementation. Either (a) keep
UNIQUE violation as the normative behavior and update the AC to assert only
409, or (b) adopt upsert (ON CONFLICT UPDATE) and add an AC for the replace
behavior. Remove the "(정책 결정 필요)" hedge.

**D11. spec.md:241-243, plan.md:129-131 — completion_reports idempotency
mechanism under-specified.**
REQ-DB-010 requires "정확히 하나의 completion_reports 행을 자동으로 생성
(멱등성: 이미 존재하면 재생성하지 않는다)". plan.md:130 mitigation lists
`UNIQUE(user_book_id)` + "이미 존재하는 user_book_id에 대해서는 INSERT
스킵". A bare UNIQUE constraint produces an ERROR on duplicate, not a skip.
"Skip" requires `INSERT ... ON CONFLICT (user_book_id) DO NOTHING`. The
trigger guard `WHERE NEW.status='completed' AND OLD.status!='completed'`
fires on every reading→completed transition (including reverse-then-forward
cycles per acceptance.md:122-126 case 3), so the UNIQUE + ON CONFLICT
mechanism is load-bearing and must be explicit.
**Fix**: Specify the trigger body as `INSERT ... ON CONFLICT (user_book_id)
DO NOTHING` and add an AC that exercises completed→reading→completed and
asserts exactly one report row.

**D12. acceptance.md (entire file) — Acceptance criteria use Gherkin, not
EARS.** While spec.md REQs are EARS-compliant (so MP-2 passes for the
SPEC proper), the dedicated acceptance document uses Given/When/Then
exclusively. If the harness treats `acceptance.md` as the canonical AC
artifact, this is a structural mismatch with the EARS rubric. At minimum,
the relationship between EARS REQs in spec.md and Gherkin scenarios in
acceptance.md should be explicit (each Gherkin Feature should reference its
parent REQ — currently only some do).
**Fix**: Add a traceability header to each Gherkin Feature linking it to
the EARS REQ(s) it validates; ensure every REQ-DB-XXX has at least one
Gherkin scenario (see D6).

### LOW

**D13. spec.md:147-152 — sticker_type ENUM diverges from ERD (text).**
SPEC upgrades `sticker_type` from `text` (ERD 2.5) to a dedicated ENUM. This
is an improvement but a deviation from the stated SSOT
(spec.md:35 "본 SPEC의 데이터 모델은 .booktalk/pages_06_ERD.md를 단일 출처로
한다"). ENUMs make future value additions require a migration.
**Fix**: Either (a) note the deviation explicitly with rationale in REQ-DB-005,
or (b) revert to `text NOT NULL` + CHECK constraint to match ERD and ease
future extension.

**D14. spec.md:285-292 — users RLS does not address admin (`role='admin'`)
privileges.** users.role allows 'admin' (REQ-DB-001, spec.md:86), but
REQ-DB-014 grants UPDATE only to `auth.uid()=id`. No admin override is
defined. If admins need to moderate profiles, the spec is silent; if not,
the admin role's purpose on users is unclear.
**Fix**: Clarify whether admins can UPDATE other users' rows; if yes, add a
policy; if no, document that `role='admin'` is reserved for future use.

**D15. spec.md:332-337 — clubs type CHECK allows 'instant' while §5.5
excludes instant logic.** Not a contradiction (forward-compat column value),
but the CHECK permits a value whose supporting logic (signal push, popup
chat) is explicitly out of scope. An implementer inserting `type='instant'`
would create a club with no working features.
**Fix**: Either restrict CHECK to `'group'` for MVP, or add a note that
`type='instant'` rows are rejected at the application layer until the
extension phase.

---

## Chain-of-Verification Pass

Second-look findings, verified by re-reading each section:

- REQ sequencing verified end-to-end: 001-021 sequential, no gaps/dupes. ✓
- Column coverage re-checked against ERD 2.1-2.12 for all 12 entities: exact
  match (D13 ENUM divergence noted). ✓
- Index list re-checked against ERD §3: 12 of 13 MVP indexes present
  (chat_messages index correctly omitted per exclusion). ✓
- Traceability re-checked for EVERY REQ-XXX: confirmed D6 gaps
  (books/reading_sessions/point_logs/notifications/sticker-read/
  club_members-read/REQ-021 all four tables lack AC).
- Contradictions re-scanned: found the clubs→host-member trigger gap (D2)
  and the status-rejection mechanism conflation (D3) on the second pass —
  both are real and blocking.
- New second-pass finding incorporated as D7 (RLS self-recursion) — this was
  initially under-weighted and is now rated HIGH for a security spec.
- Exclusions section re-read: 8 specific entries, adequately concrete. No
  scope creep detected beyond the retained `type='instant'` CHECK value (D15).

First pass was thorough; second pass promoted two defects (D2, D7) in
severity and added D15.

---

## Recommendation

FAIL. This SPEC governs security-critical RLS policies where errors cause
data leaks (per the audit brief). It must not proceed to `/moai run` until
the following blocking items are resolved:

1. **Resolve D1** — Replace all RLS column-masking language with a concrete
   view + GRANT/REVOKE mechanism. Add formal REQs for
   `user_profiles_public` and `user_books_public` views.
2. **Resolve D2** — Add a REQ for the clubs-INSERT → club_members(host)
   trigger. Track B is non-functional without it.
3. **Resolve D3** — Specify the concrete rejection mechanism (BEFORE
   trigger RAISE / RLS UPDATE USING) for join_requests re-processing.
4. **Resolve D4** — Require SECURITY DEFINER for all four triggers that
   INSERT into RLS-protected tables.
5. **Resolve D5** — Promote the books SELECT policy from a comment to a
   formal REQ-DB-013b.
6. **Resolve D6** — Add at least 2 observable acceptance scenarios for each
   of the 6+ uncovered REQs. Untested RLS = unverified security.
7. **Resolve D7** — Specify the `is_club_member()` SECURITY DEFINER helper
   to break RLS recursion on emotion_records and club_members policies.
8. **Resolve MP-3 (frontmatter)** — Add `labels` field and rename `created`
   → `created_at` in all four documents.
9. **Resolve D8, D9, D10, D11** — Fix the factual/AC/idempotency defects
   before implementation begins.

After these fixes, re-run plan-auditor at iteration 2.

Verdict: FAIL
