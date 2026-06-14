-- Create reading_sessions table for SPEC-DB-001
-- Migration: 0009_create_reading_sessions
-- Entity: reading_sessions (독서 세션)
-- Requirements: REQ-DB-009

-- Create reading_sessions table (reading timer sessions)
CREATE TABLE public.reading_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    duration_seconds integer,
    pages_read integer
);

-- Add helpful comments
COMMENT ON TABLE public.reading_sessions IS 'Reading timer sessions - tracks user reading duration and progress';
COMMENT ON COLUMN public.reading_sessions.id IS 'Primary key';
COMMENT ON COLUMN public.reading_sessions.user_id IS 'Reference to users table (CASCADE on user delete)';
COMMENT ON COLUMN public.reading_sessions.book_id IS 'Reference to books table (CASCADE on book delete)';
COMMENT ON COLUMN public.reading_sessions.started_at IS 'Session start timestamp';
COMMENT ON COLUMN public.reading_sessions.ended_at IS 'Session end timestamp (null if in progress)';
COMMENT ON COLUMN public.reading_sessions.duration_seconds IS 'Calculated session duration in seconds';
COMMENT ON COLUMN public.reading_sessions.pages_read IS 'Number of pages read during session';
