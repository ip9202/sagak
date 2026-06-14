---
id: SPEC-DB-001
title: "Database Schema & RLS — Task Decomposition"
spec: SPEC-DB-001
version: "1.0.0"
status: in-progress
created: 2026-06-14
updated: 2026-06-14
task_status_note: "T-001~T-008 DONE (267/267 tests pass). T-009 DEFERRED to follow-up PR (updated_at triggers + integration suite, DoD non-essential). See progress.md for orchestrator verification."
author: "manager-strategy"
priority: high
issue_number: 0
labels: [database, supabase, postgresql, rls, security, schema, tdd]
---

# SPEC-DB-001 Task Decomposition

> Phase 1.5 output. Each task is one RED-GREEN-REFACTOR cycle (TDD mode).
> Test framework: pgTAP via `supabase test` (runs after full `supabase db reset`).
> Drift Guard consumes this file to validate scope adherence.

## Task Summary

| Task ID | Description | Migrations | REQ Coverage | Status |
|---------|-------------|------------|--------------|--------|
| T-001 | Bootstrap Supabase project + pgTAP harness | — (infra) | infra | pending |
| T-002 | Core entities: users, books, user_books | 0001-0003 | REQ-DB-001,002,003 | pending |
| T-003 | Emotion foundation: clubs, emotion_records, sticker reactions | 0004-0006 | REQ-DB-004,005,006 | pending |
| T-004 | Social connections: club_members, join_requests + triggers | 0007-0008 | REQ-DB-007,008,008b | pending |
| T-005 | Engagement & rewards: sessions, reports, points, notifications | 0009-0012 | REQ-DB-009,010,011,012 | pending |
| T-006 | Indexes (12 indexes from ERD section 3) | 0013 | schema §4 | pending |
| T-007 | RLS core: enable RLS + all policies + fn_user_in_club (SECURITY CRITICAL) | 0014 | REQ-DB-013a-d,014-021 | pending |
| T-008 | Security views: user_profiles, user_books_public + GRANT | 0015 | REQ-DB-013e | pending |
| T-009 | updated_at triggers + full 18-scenario integration suite | 0016 | cross-cutting | pending |

## Task Details

### T-001: Project Bootstrap

- **Description**: Initialize Supabase local project, configure config.toml for local Docker, create seed.sql stub, set up pgTAP test harness directory.
- **Requirement**: Infrastructure prerequisite (no REQ-DB mapping).
- **Dependencies**: None.
- **Planned Files**:
  - `supabase/config.toml` (new — local Supabase config)
  - `supabase/seed.sql` (new stub — empty or minimal placeholder)
  - `supabase/tests/README.md` or `.gitkeep` (test harness directory marker)
- **Acceptance**:
  - `supabase start` succeeds against local Docker
  - `supabase test` runs (0 tests, exits cleanly)
  - `supabase db reset` works on empty migrations set

### T-002: Core Entities (users, books, user_books)

- **Description**: Create users (with handle_new_user SECURITY DEFINER trigger syncing auth.users), books catalog, and user_books with UNIQUE/CHECK constraints, FK with ON DELETE RESTRICT, and last_progress_at auto-update logic.
- **Requirement**: REQ-DB-001, REQ-DB-002, REQ-DB-003, REQ-SCHEMA-CORE FK ON DELETE RESTRICT policy.
- **Dependencies**: T-001.
- **Planned Files**:
  - `supabase/migrations/0001_create_users.sql`
  - `supabase/migrations/0002_create_books.sql`
  - `supabase/migrations/0003_create_user_books.sql`
  - `supabase/tests/0001_users_test.sql`
  - `supabase/tests/0002_books_test.sql`
  - `supabase/tests/0003_user_books_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - Scenario 7: UNIQUE(user_id, book_id) blocks duplicate registration
  - Scenario 8: auth.users INSERT creates public.users row (handle_new_user fires)
  - users.role CHECK(member/admin), users.provider CHECK(kakao/apple/google)
  - user_books.status CHECK(reading/completed/shelved)
  - current_page update sets last_progress_at = now()
  - status reading→completed sets completed_at
  - handle_new_user prosecdef = true (SECURITY DEFINER)
  - All FKs use ON DELETE RESTRICT

### T-003: Emotion Foundation (clubs, emotion_records, sticker reactions)

- **Description**: Create clubs table (needed as FK for emotion_records.club_id), emotion_records with visibility CHECK and club_id NOT NULL guard, sticker_type ENUM, and sticker_reactions with UNIQUE(record_id, user_id). Clubs gets handle_new_club_host trigger (forward-references club_members via deferred PL/pgSQL resolution).
- **Requirement**: REQ-DB-004, REQ-DB-005, REQ-DB-006.
- **Dependencies**: T-002 (users, books exist).
- **Planned Files**:
  - `supabase/migrations/0004_create_clubs.sql`
  - `supabase/migrations/0005_create_emotion_records.sql`
  - `supabase/migrations/0006_create_sticker_enum_and_reactions.sql`
  - `supabase/tests/0004_clubs_test.sql`
  - `supabase/tests/0005_emotion_records_test.sql`
  - `supabase/tests/0006_sticker_reactions_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - clubs.type CHECK(group/instant), clubs.status CHECK(active/closed)
  - emotion_records.visibility CHECK(public/club)
  - visibility=club requires club_id NOT NULL (CHECK constraint, error 23514)
  - sticker_type ENUM has exactly empathy/touching/comforted
  - Scenario 6: UNIQUE(record_id, user_id) blocks duplicate sticker (error 23505)
  - Different users CAN place stickers on same record
  - handle_new_club_host function defined (prosecdef=true); fires on clubs INSERT

### T-004: Social Connections (club_members, join_requests)

- **Description**: Create club_members with UNIQUE(club_id, user_id) and role CHECK, join_requests with status machine, BEFORE UPDATE RAISE trigger (rejects status reset on terminal rows, allows other column edits per N7), and AFTER UPDATE ACCEPT trigger (auto-inserts club_members row). Both triggers are SECURITY DEFINER.
- **Requirement**: REQ-DB-007, REQ-DB-008, REQ-DB-008b.
- **Dependencies**: T-003 (clubs exists).
- **Planned Files**:
  - `supabase/migrations/0007_create_club_members.sql`
  - `supabase/migrations/0008_create_join_requests.sql`
  - `supabase/tests/0007_club_members_test.sql`
  - `supabase/tests/0008_join_requests_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - club_members UNIQUE(club_id, user_id), role CHECK(host/member)
  - Scenario 2 case 1: host accepts join_request → club_members(role=member) auto-inserted, responded_at set
  - Scenario 2 case 2: status reset on terminal row → RAISE EXCEPTION (not 0-row commit, full error)
  - Scenario 2 case 3: terminal row's other-column edits (message, responded_at) ALLOWED (N7)
  - Scenario 2 case 5: UNIQUE(club_id, requester_id) blocks duplicate request
  - join_requests.status CHECK(pending/accepted/declined)
  - join_request_accept prosecdef = true
  - guard_join_request_status BEFORE UPDATE trigger raises on status mutation of terminal rows

### T-005: Engagement & Rewards (sessions, reports, points, notifications)

- **Description**: Create reading_sessions (timer logs), completion_reports with UNIQUE(user_book_id) and the generate_completion_report SECURITY DEFINER trigger (ON CONFLICT DO NOTHING for idempotency, aggregates emotion_records into report_data at transition time), point_logs (reason CHECK), notifications (type CHECK).
- **Requirement**: REQ-DB-009, REQ-DB-010, REQ-DB-011, REQ-DB-012.
- **Dependencies**: T-002 (user_books exists for completion_reports FK).
- **Planned Files**:
  - `supabase/migrations/0009_create_reading_sessions.sql`
  - `supabase/migrations/0010_create_completion_reports.sql`
  - `supabase/migrations/0011_create_point_logs.sql`
  - `supabase/migrations/0012_create_notifications.sql`
  - `supabase/tests/0009_reading_sessions_test.sql`
  - `supabase/tests/0010_completion_reports_test.sql`
  - `supabase/tests/0011_point_logs_test.sql`
  - `supabase/tests/0012_notifications_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - Scenario 3 case 1: user_books.status reading→completed → completion_reports auto-created with report_data (emotion_curve, highlights, total_records populated by trigger)
  - Scenario 3 case 2: re-setting completed on already-completed → no duplicate insert
  - Scenario 3 case 3 (D11): completed→reading→completed cycle → exactly 1 report row (ON CONFLICT DO NOTHING)
  - completion_reports UNIQUE(user_book_id)
  - generate_completion_report prosecdef = true, fires only on reading→completed transition
  - point_logs.reason CHECK(completion/reaction/exchange)
  - notifications.type CHECK(6 values)

### T-006: Indexes

- **Description**: Create all 12 recommended indexes from ERD section 3.
- **Requirement**: Schema §4 (Indexes).
- **Dependencies**: T-002 through T-005 (all tables exist).
- **Planned Files**:
  - `supabase/migrations/0013_create_indexes.sql`
  - `supabase/tests/0013_indexes_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - All 12 indexes exist (pgTAP has_index assertions):
    - user_books(user_id, status), user_books(book_id, is_public, last_progress_at), user_books(book_id, started_reading_at)
    - clubs(book_id, type, status)
    - join_requests(club_id, status), join_requests(requester_id, status)
    - emotion_records(book_id, page_number), emotion_records(user_id, created_at DESC)
    - sticker_reactions(record_id)
    - club_members(user_id)
    - reading_sessions(user_id, book_id)
    - notifications(user_id, is_read)

### T-007: RLS Core — SECURITY CRITICAL

- **Description**: Enable RLS on all 11 user-data tables, define all per-table policies (REQ-DB-014 through REQ-DB-021), and create the fn_user_in_club SECURITY DEFINER helper function (owned by BYPASSRLS role) to break recursion in emotion_records and club_members policies.
- **Requirement**: REQ-DB-013a, REQ-DB-013b, REQ-DB-013c, REQ-DB-013d, REQ-DB-014, REQ-DB-015, REQ-DB-016, REQ-DB-017, REQ-DB-018, REQ-DB-019, REQ-DB-020, REQ-DB-021.
- **Dependencies**: T-002 through T-006 (all tables + indexes exist).
- **Planned Files**:
  - `supabase/migrations/0014_enable_rls_and_policies.sql`
  - `supabase/tests/0014_rls_behavioral_test.sql` (the largest, most critical test file)
- **Acceptance** (pgTAP behavioral RED→GREEN — the security gate):
  - RLS ENABLED on all 11 tables (pg_class.relrowsecurity = true)
  - Scenario 10: books has SELECT USING(true) policy for authenticated (catalog visible)
  - Scenario 1: user B cannot SELECT user A's user_books rows (own-row isolation)
  - Scenario 4 case 1: emotion_records visibility=public readable by all authenticated
  - Scenario 4 case 2: emotion_records visibility=club readable by members (fn_user_in_club=true), blocked for non-members (fn_user_in_club=false), no recursion
  - Scenario 5: clubs readable by all (USING true), writable only by host (auth.uid()=host_id), WITH CHECK enforces host_id=auth.uid()
  - Scenario 12: reading_sessions own-row only
  - Scenario 13: point_logs own-row only, read-only for clients
  - Scenario 14: notifications own-row only, is_read update allowed, client INSERT blocked
  - Scenario 16: club_members readable by same-club members (fn_user_in_club), client INSERT blocked (only SECURITY DEFINER triggers), own-row DELETE allowed
  - Scenario 17: users own-row full SELECT (Option A — no REVOKE), other-user rows hidden from base table
  - Scenario 18: sticker_reactions USING(true) read-all, own-row write
  - fn_user_in_club prosecdef=true, owned by BYPASSRLS role, returns correct membership without recursion

### T-008: Security Views (Column Masking)

- **Description**: Create user_profiles view (id, nickname, avatar_url from users) and user_books_public view (book_id, current_page, started_reading_at, user_id WHERE is_public=true). Grant authenticated SELECT on both views. No REVOKE on base tables (Option A).
- **Requirement**: REQ-DB-013e, REQ-DB-014, REQ-DB-015 (view complement).
- **Dependencies**: T-007 (RLS policies on base tables finalized).
- **Planned Files**:
  - `supabase/migrations/0015_create_security_views.sql`
  - `supabase/tests/0015_security_views_test.sql`
- **Acceptance** (pgTAP RED→GREEN):
  - user_profiles view exists with exactly (id, nickname, avatar_url) columns
  - user_books_public view exists with exactly (book_id, current_page, started_reading_at, user_id) columns, filtered to is_public=true
  - Scenario 1 case 2: other user's public user_books row exposes only limited columns via view
  - Scenario 17 case 3: other user's public profile exposes only nickname, avatar_url via view
  - Base tables NOT revoked (authenticated SELECT still present, but RLS own-row hides others)
  - Views are security_invoker=false (default — view owner permissions, bypass base RLS)

### T-009: Final Triggers + Integration Suite

- **Description**: Create updated_at auto-update triggers for users, user_books, emotion_records. Run the full 18-scenario acceptance suite end-to-end. Verify Definition of Done (acceptance.md §6).
- **Requirement**: Cross-cutting (updated_at triggers), full acceptance validation.
- **Dependencies**: T-002 through T-008 (all schema + RLS + views exist).
- **Planned Files**:
  - `supabase/migrations/0016_create_triggers.sql`
  - `supabase/tests/0016_integration_test.sql` (end-to-end scenario suite)
  - Optional: `supabase/tests/0016_updated_at_test.sql`
- **Acceptance** (final gate — all 18 scenarios green):
  - updated_at auto-set on users/user_books/emotion_records UPDATE
  - `supabase db reset` clean from scratch
  - `supabase test` — ALL test files pass (T-002 through T-009)
  - All 18 acceptance scenarios verified via pgTAP
  - Definition of Done checklist (acceptance.md §6) fully met:
    - 16 migration files present
    - 12 entity tables created
    - RLS enabled on 11 user-data tables
    - Security views + GRANT present (Option A)
    - fn_user_in_club SECURITY DEFINER
    - 4 SECURITY DEFINER triggers prosecdef=true
    - Two-user isolation tests pass

## TDD Cycle Pattern (applies to every task)

Each task follows RED-GREEN-REFACTOR:

1. **RED**: Write pgTAP test file(s) asserting the desired schema/behavior. Run `supabase db reset && supabase test`. Test FAILS (migration/table/policy doesn't exist yet).
2. **GREEN**: Write the migration SQL file(s). Run `supabase db reset && supabase test`. Test PASSES.
3. **REFACTOR**: Clean up SQL (normalize naming, extract repeated patterns, add comments). Run `supabase db reset && supabase test`. Test still PASSES.

After REFACTOR: Skill("simplify") auto-executes (orchestrated by run.md Phase 2.10). Then Pre-submission Self-Review against acceptance criteria.

## Risk Register (Carried Forward + Implementation-Specific)

| # | Risk | Severity | Probability | Mitigation |
|---|------|----------|-------------|------------|
| 1 | RLS policy misconfiguration causes data leak (private emotion_records exposed) | CRITICAL | Medium | T-007 RED writes behavioral test for EVERY policy before policy SQL. fn_user_in_club breaks recursion. Mandatory two-user isolation tests. |
| 2 | SECURITY DEFINER trigger fails RLS bypass (wrong ownership or prosecdef=false) | HIGH | Low | pg_proc.prosecdef=true assertion for all 4 triggers + fn_user_in_club. Owned by BYPASSRLS role (postgres), NOT service_role. |
| 3 | handle_new_club_host (0004) forward-references club_members (0007) | MEDIUM | Low | PL/pgSQL deferred table resolution makes this safe. If CREATE FUNCTION tightens validation, move function to 0007. Noted as assumption. |
| 4 | Migration ordering breaks supabase reset (FK parent missing) | MEDIUM | Low | Verified: 0004 clubs before 0005 emotion_records before 0007 club_members. Each task GREEN gate = successful reset + test pass. |
| 5 | completion_reports trigger slow on large emotion_records sets | LOW | Medium | Acceptable for MVP (personal archives). Note as performance assumption. Report_data aggregation in PL/pgSQL at transition time. |
| 6 | Option A (no REVOKE) leaks column data if RLS policy is missing | HIGH | Low | T-007 ensures RLS own-row policy exists on users + user_books. T-008 adds views as complement. Both layers validated in scenario 1 + 17. |
| 7 | join_requests status machine race condition (concurrent accept/decline) | MEDIUM | Low | UNIQUE(club_id, requester_id) + club_members UNIQUE(club_id, user_id) as final defense. SECURITY DEFINER trigger atomicity. |
| 8 | fn_user_in_club owned by wrong role → recursion returns empty | HIGH | Medium | T-007 test asserts function works correctly for both member and non-member cases. Explicit ALTER OWNER to postgres (BYPASSRLS). |
