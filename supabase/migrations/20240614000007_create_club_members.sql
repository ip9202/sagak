-- Create club_members table for SPEC-DB-001
-- Migration: 0007_create_club_members
-- Entity: club_members (독서 모임 멤버)
-- Requirements: REQ-DB-007

-- Create club_members table
CREATE TABLE public.club_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('host', 'member')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    -- UNIQUE constraint ensures one membership per user per club
    CONSTRAINT club_members_club_user_unique UNIQUE (club_id, user_id)
);

-- Add helpful comments
COMMENT ON TABLE public.club_members IS 'Club membership records - hosts and members';
COMMENT ON COLUMN public.club_members.id IS 'Primary key';
COMMENT ON COLUMN public.club_members.club_id IS 'Reference to clubs table';
COMMENT ON COLUMN public.club_members.user_id IS 'Reference to users table';
COMMENT ON COLUMN public.club_members.role IS 'Membership role: host (creator) or member (joined via request)';
COMMENT ON COLUMN public.club_members.joined_at IS 'Timestamp when user joined the club';
COMMENT ON CONSTRAINT club_members_club_user_unique ON public.club_members IS 'Ensures one membership per user per club';
