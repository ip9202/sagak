-- Create clubs table for SPEC-DB-001
-- Migration: 0004_create_clubs
-- Entity: clubs (독서 모임)
-- Requirements: REQ-DB-004

-- Create clubs table (reading clubs/groups)
CREATE TABLE public.clubs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    type text NOT NULL CHECK (type IN ('group', 'instant')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    host_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    max_members integer DEFAULT 10,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create handle_new_club_host trigger function (SECURITY DEFINER)
-- This function automatically creates a club_members row with role='host' when clubs INSERT occurs
CREATE OR REPLACE FUNCTION public.handle_new_club_host()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Auto-insert host into club_members with role='host'
    INSERT INTO public.club_members (club_id, user_id, role)
    VALUES (NEW.id, NEW.host_id, 'host');
    RETURN NEW;
END;
$$;

-- Create trigger on clubs to call handle_new_club_host
-- Note: This forward-references club_members table (created in migration 0007)
-- PL/pgSQL deferred resolution makes this safe
CREATE TRIGGER on_club_created
    AFTER INSERT ON public.clubs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_club_host();

-- Add helpful comments
COMMENT ON TABLE public.clubs IS 'Reading clubs - groups and instant reading sessions';
COMMENT ON FUNCTION public.handle_new_club_host() IS 'SECURITY DEFINER trigger that auto-inserts host into club_members with role=''host'' when clubs INSERT occurs';
