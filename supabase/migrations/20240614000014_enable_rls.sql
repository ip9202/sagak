-- Enable Row-Level Security (RLS) and create policies for SPEC-DB-001 T-007
-- Migration: 0014_enable_rls
-- Requirements: REQ-DB-013a through REQ-DB-013e, REQ-DB-014 through REQ-DB-021
-- Security-Critical: RLS misconfiguration = data leak

-- ============================================================================
-- Step 1: Create SECURITY DEFINER helper function fn_user_in_club (REQ-DB-013d)
-- ============================================================================
-- This function bypasses RLS to check club membership without recursion
CREATE OR REPLACE FUNCTION public.fn_user_in_club(p_club_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- EXISTS check for club membership
    -- SECURITY DEFINER bypasses RLS on club_members
    RETURN EXISTS(
        SELECT 1
        FROM public.club_members
        WHERE club_id = p_club_id
        AND user_id = auth.uid()
    );
END;
$$;

-- Alter owner to postgres (BYPASSRLS role)
ALTER FUNCTION public.fn_user_in_club(p_club_id uuid) OWNER TO postgres;

-- Add helpful comment
COMMENT ON FUNCTION public.fn_user_in_club(p_club_id uuid) IS 'SECURITY DEFINER helper - checks if auth.uid() is member of p_club_id, bypasses RLS to prevent recursion';

-- ============================================================================
-- Step 2: Enable and FORCE RLS on all user data tables (REQ-DB-013a)
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_books FORCE ROW LEVEL SECURITY;

ALTER TABLE public.emotion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emotion_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sticker_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticker_reactions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.join_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.completion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_reports FORCE ROW LEVEL SECURITY;

ALTER TABLE public.point_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 3: Create security views for column-level masking (REQ-DB-013e)
-- ============================================================================
-- Option A: RLS-only model (NO REVOKE on base tables)
-- Base tables: own-row RLS policies (full columns for self only)
-- Security views: limited columns for other users' public data

-- Security view 1: user_profiles (public profile columns only)
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
    id,
    nickname,
    avatar_url
FROM public.users;

-- Grant SELECT on user_profiles to authenticated role
GRANT SELECT ON public.user_profiles TO authenticated;

-- Security view 2: user_books_public (limited public reading data)
CREATE OR REPLACE VIEW public.user_books_public AS
SELECT
    book_id,
    current_page,
    started_reading_at,
    user_id
FROM public.user_books
WHERE is_public = true;

-- Grant SELECT on user_books_public to authenticated role
GRANT SELECT ON public.user_books_public TO authenticated;

COMMENT ON VIEW public.user_profiles IS 'Security view - exposes only public profile columns (id, nickname, avatar_url)';
COMMENT ON VIEW public.user_books_public IS 'Security view - exposes limited user_books columns for is_public=true rows (book_id, current_page, started_reading_at, user_id)';

-- ============================================================================
-- Step 4: Create RLS policies for users table (REQ-DB-014)
-- ============================================================================
-- Policy 1: Users can SELECT their own row (full columns)
CREATE POLICY "users_select_own_row"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Users can UPDATE their own row
CREATE POLICY "users_update_own_row"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Users can INSERT their own row (via trigger, not direct client)
CREATE POLICY "users_insert_own_row"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

COMMENT ON POLICY "users_select_own_row" ON public.users IS 'Users can SELECT their own row only (Option A: no REVOKE on base table)';
COMMENT ON POLICY "users_update_own_row" ON public.users IS 'Users can UPDATE their own row only';
COMMENT ON POLICY "users_insert_own_row" ON public.users IS 'Users can INSERT their own row (trigger-mediated)';

-- ============================================================================
-- Step 5: Create RLS policies for user_books table (REQ-DB-015)
-- ============================================================================
-- Policy 1: Users can SELECT their own rows (full columns)
CREATE POLICY "user_books_select_own_rows"
ON public.user_books
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can INSERT their own rows
CREATE POLICY "user_books_insert_own_row"
ON public.user_books
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can UPDATE their own rows
CREATE POLICY "user_books_update_own_rows"
ON public.user_books
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can DELETE their own rows
CREATE POLICY "user_books_delete_own_rows"
ON public.user_books
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "user_books_select_own_rows" ON public.user_books IS 'Users can SELECT their own rows only (Option A: base table RLS, security view for others)';
COMMENT ON POLICY "user_books_insert_own_row" ON public.user_books IS 'Users can INSERT their own rows only';
COMMENT ON POLICY "user_books_update_own_rows" ON public.user_books IS 'Users can UPDATE their own rows only';
COMMENT ON POLICY "user_books_delete_own_rows" ON public.user_books IS 'Users can DELETE their own rows only';

-- ============================================================================
-- Step 6: Create RLS policies for books table (REQ-DB-013b)
-- ============================================================================
-- Policy: Authenticated users can SELECT all books (public catalog)
CREATE POLICY "books_select_all"
ON public.books
FOR SELECT
TO authenticated
USING (true);

-- Note: INSERT/UPDATE/DELETE restricted to service_role only (no client policies)
COMMENT ON POLICY "books_select_all" ON public.books IS 'Authenticated users can SELECT all books (public catalog, REQ-DB-013b)';

-- ============================================================================
-- Step 7: Create RLS policies for emotion_records table (REQ-DB-016)
-- ============================================================================
-- Policy 1: Users can SELECT public records OR own records OR same-club records
CREATE POLICY "emotion_records_select_visible"
ON public.emotion_records
FOR SELECT
TO authenticated
USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (visibility = 'club' AND public.fn_user_in_club(club_id))
);

-- Policy 2: Users can INSERT their own records
CREATE POLICY "emotion_records_insert_own"
ON public.emotion_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can UPDATE their own records
CREATE POLICY "emotion_records_update_own"
ON public.emotion_records
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy 4: Users can DELETE their own records
CREATE POLICY "emotion_records_delete_own"
ON public.emotion_records
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "emotion_records_select_visible" ON public.emotion_records IS 'Users can SELECT public/own/same-club records (REQ-DB-016, uses fn_user_in_club)';
COMMENT ON POLICY "emotion_records_insert_own" ON public.emotion_records IS 'Users can INSERT their own records only';
COMMENT ON POLICY "emotion_records_update_own" ON public.emotion_records IS 'Users can UPDATE their own records only';
COMMENT ON POLICY "emotion_records_delete_own" ON public.emotion_records IS 'Users can DELETE their own records only';

-- ============================================================================
-- Step 8: Create RLS policies for sticker_reactions table (REQ-DB-017)
-- ============================================================================
-- Policy 1: All authenticated users can SELECT all sticker_reactions (public read)
CREATE POLICY "sticker_reactions_select_all"
ON public.sticker_reactions
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can INSERT their own reactions
CREATE POLICY "sticker_reactions_insert_own"
ON public.sticker_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can DELETE their own reactions
CREATE POLICY "sticker_reactions_delete_own"
ON public.sticker_reactions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "sticker_reactions_select_all" ON public.sticker_reactions IS 'All authenticated users can SELECT all sticker_reactions (REQ-DB-017)';
COMMENT ON POLICY "sticker_reactions_insert_own" ON public.sticker_reactions IS 'Users can INSERT their own reactions only';
COMMENT ON POLICY "sticker_reactions_delete_own" ON public.sticker_reactions IS 'Users can DELETE their own reactions only';

-- ============================================================================
-- Step 9: Create RLS policies for clubs table (REQ-DB-018)
-- ============================================================================
-- Policy 1: All authenticated users can SELECT all clubs (public exploration)
CREATE POLICY "clubs_select_all"
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Users can INSERT clubs (must be host themselves)
CREATE POLICY "clubs_insert_host_self"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = host_id);

-- Policy 3: Hosts can UPDATE their own clubs
CREATE POLICY "clubs_update_own"
ON public.clubs
FOR UPDATE
TO authenticated
USING (auth.uid() = host_id)
WITH CHECK (auth.uid() = host_id);

-- Policy 4: Hosts can DELETE their own clubs
CREATE POLICY "clubs_delete_own"
ON public.clubs
FOR DELETE
TO authenticated
USING (auth.uid() = host_id);

COMMENT ON POLICY "clubs_select_all" ON public.clubs IS 'All authenticated users can SELECT all clubs (public exploration, REQ-DB-018)';
COMMENT ON POLICY "clubs_insert_host_self" ON public.clubs IS 'Users can INSERT clubs where host_id=auth.uid()';
COMMENT ON POLICY "clubs_update_own" ON public.clubs IS 'Hosts can UPDATE their own clubs only';
COMMENT ON POLICY "clubs_delete_own" ON public.clubs IS 'Hosts can DELETE their own clubs only';

-- ============================================================================
-- Step 10: Create RLS policies for club_members table (REQ-DB-019)
-- ============================================================================
-- Policy 1: Club members can SELECT same-club members (using fn_user_in_club)
CREATE POLICY "club_members_select_same_club"
ON public.club_members
FOR SELECT
TO authenticated
USING (public.fn_user_in_club(club_id));

-- Policy 2: Members can DELETE their own membership
CREATE POLICY "club_members_delete_own"
ON public.club_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Note: INSERT via SECURITY DEFINER triggers only (no client INSERT policy)
COMMENT ON POLICY "club_members_select_same_club" ON public.club_members IS 'Club members can SELECT same-club members (REQ-DB-019, uses fn_user_in_club)';
COMMENT ON POLICY "club_members_delete_own" ON public.club_members IS 'Members can DELETE their own membership only';

-- ============================================================================
-- Step 11: Create RLS policies for join_requests table (REQ-DB-020)
-- ============================================================================
-- Policy 1: Requesters can SELECT their own requests
CREATE POLICY "join_requests_select_requester_or_host"
ON public.join_requests
FOR SELECT
TO authenticated
USING (
    auth.uid() = requester_id
    OR EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE clubs.id = join_requests.club_id
        AND clubs.host_id = auth.uid()
    )
);

-- Policy 2: Users can INSERT their own requests
CREATE POLICY "join_requests_insert_own"
ON public.join_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

-- Policy 3: Club hosts can UPDATE status (accept/decline)
CREATE POLICY "join_requests_update_host"
ON public.join_requests
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE clubs.id = join_requests.club_id
        AND clubs.host_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.clubs
        WHERE clubs.id = join_requests.club_id
        AND clubs.host_id = auth.uid()
    )
);

COMMENT ON POLICY "join_requests_select_requester_or_host" ON public.join_requests IS 'Requesters and hosts can SELECT relevant requests (REQ-DB-020)';
COMMENT ON POLICY "join_requests_insert_own" ON public.join_requests IS 'Users can INSERT their own requests only';
COMMENT ON POLICY "join_requests_update_host" ON public.join_requests IS 'Hosts can UPDATE request status only';

-- ============================================================================
-- Step 12: Create RLS policies for reading_sessions table (REQ-DB-021)
-- ============================================================================
-- Policy 1: Users can SELECT their own reading sessions
CREATE POLICY "reading_sessions_select_own"
ON public.reading_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can INSERT their own reading sessions
CREATE POLICY "reading_sessions_insert_own"
ON public.reading_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can UPDATE their own reading sessions
CREATE POLICY "reading_sessions_update_own"
ON public.reading_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "reading_sessions_select_own" ON public.reading_sessions IS 'Users can SELECT their own reading sessions only (REQ-DB-021)';
COMMENT ON POLICY "reading_sessions_insert_own" ON public.reading_sessions IS 'Users can INSERT their own reading sessions only';
COMMENT ON POLICY "reading_sessions_update_own" ON public.reading_sessions IS 'Users can UPDATE their own reading sessions only';

-- ============================================================================
-- Step 13: Create RLS policies for completion_reports table (REQ-DB-021)
-- ============================================================================
-- Policy 1: Users can SELECT their own completion reports
CREATE POLICY "completion_reports_select_own"
ON public.completion_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: INSERT via SECURITY DEFINER trigger only (no client INSERT policy)

COMMENT ON POLICY "completion_reports_select_own" ON public.completion_reports IS 'Users can SELECT their own completion reports only (REQ-DB-021)';

-- ============================================================================
-- Step 14: Create RLS policies for point_logs table (REQ-DB-021)
-- ============================================================================
-- Policy 1: Users can SELECT their own point logs (read-only)
CREATE POLICY "point_logs_select_own"
ON public.point_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: INSERT via service_role or triggers only (no client INSERT policy)

COMMENT ON POLICY "point_logs_select_own" ON public.point_logs IS 'Users can SELECT their own point logs only (read-only, REQ-DB-021)';

-- ============================================================================
-- Step 15: Create RLS policies for notifications table (REQ-DB-021)
-- ============================================================================
-- Policy 1: Users can SELECT their own notifications
CREATE POLICY "notifications_select_own"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can UPDATE their own notifications (is_read flag)
CREATE POLICY "notifications_update_own"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: INSERT via service_role or triggers only (no client INSERT policy)

COMMENT ON POLICY "notifications_select_own" ON public.notifications IS 'Users can SELECT their own notifications only (REQ-DB-021)';
COMMENT ON POLICY "notifications_update_own" ON public.notifications IS 'Users can UPDATE their own notifications only (is_read flag)';

-- ============================================================================
-- Verification Queries (for manual inspection during development)
-- ============================================================================
-- Uncomment to verify RLS is enabled:
-- \d+ users
-- \d+ user_books
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

-- Verify fn_user_in_club is SECURITY DEFINER:
-- SELECT proname, prosecdef, rolname FROM pg_proc JOIN pg_roles ON pg_proc.proowner = pg_roles.oid WHERE proname = 'fn_user_in_club';
