-- Create join_requests table and triggers for SPEC-DB-001
-- Migration: 0008_create_join_requests
-- Entity: join_requests (합류 요청)
-- Requirements: REQ-DB-008, REQ-DB-008b

-- Create join_requests table
CREATE TABLE public.join_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    message text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    responded_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    -- UNIQUE constraint prevents duplicate requests
    CONSTRAINT join_requests_club_requester_unique UNIQUE (club_id, requester_id)
);

-- Create guard_join_request_status trigger function (BEFORE UPDATE)
-- SECURITY DEFINER to prevent privilege escalation
-- Raises exception when attempting to change status on terminal (accepted/declined) rows
CREATE OR REPLACE FUNCTION public.guard_join_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If status is being changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Check if old status is terminal (accepted or declined)
        IF OLD.status IN ('accepted', 'declined') THEN
            RAISE EXCEPTION 'Cannot change status on terminal join request (current: %, attempted: %)', OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Create BEFORE UPDATE trigger to guard status changes
CREATE TRIGGER guard_join_request_status_trigger
    BEFORE UPDATE OF status ON public.join_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_join_request_status();

-- Create join_request_accept trigger function (AFTER UPDATE)
-- SECURITY DEFINER to bypass RLS when inserting into club_members
-- Auto-inserts club_members row when join_request is accepted
CREATE OR REPLACE FUNCTION public.join_request_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only proceed when status changes TO 'accepted'
    IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM NEW.status THEN
        -- Insert into club_members with role='member'
        -- ON CONFLICT handles edge case where user is already a member
        INSERT INTO public.club_members (club_id, user_id, role, joined_at)
        VALUES (NEW.club_id, NEW.requester_id, 'member', NOW())
        ON CONFLICT (club_id, user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

-- Create AFTER UPDATE trigger to auto-accept join requests
CREATE TRIGGER join_request_accept_trigger
    AFTER UPDATE OF status ON public.join_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.join_request_accept();

-- Alter function owners to postgres (BYPASSRLS role) for SECURITY DEFINER
-- This ensures triggers can bypass RLS when needed
ALTER FUNCTION public.guard_join_request_status() OWNER TO postgres;
ALTER FUNCTION public.join_request_accept() OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE public.join_requests IS 'Join requests for clubs - status machine with terminal states';
COMMENT ON COLUMN public.join_requests.id IS 'Primary key';
COMMENT ON COLUMN public.join_requests.club_id IS 'Reference to clubs table';
COMMENT ON COLUMN public.join_requests.requester_id IS 'Reference to users table (requester)';
COMMENT ON COLUMN public.join_requests.message IS 'Optional message from requester';
COMMENT ON COLUMN public.join_requests.status IS 'Request status: pending, accepted (terminal), declined (terminal)';
COMMENT ON COLUMN public.join_requests.responded_at IS 'Timestamp when host responded (accepted/declined)';
COMMENT ON CONSTRAINT join_requests_club_requester_unique ON public.join_requests IS 'Prevents duplicate requests from same user to same club';
COMMENT ON FUNCTION public.guard_join_request_status() IS 'SECURITY DEFINER guard - prevents status reset on terminal rows';
COMMENT ON FUNCTION public.join_request_accept() IS 'SECURITY DEFINER trigger - auto-inserts club_members when request accepted';
