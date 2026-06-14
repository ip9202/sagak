-- Create emotion_records table for SPEC-DB-001
-- Migration: 0005_create_emotion_records
-- Entity: emotion_records (감상 기록)
-- Requirements: REQ-DB-005

-- Create emotion_records table (user reading emotions/impressions)
CREATE TABLE public.emotion_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    club_id uuid REFERENCES public.clubs(id) ON DELETE RESTRICT,
    page_number integer,
    content text NOT NULL,
    visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'club')),
    created_at timestamptz DEFAULT now() NOT NULL,
    -- CHECK constraint: visibility=club requires club_id NOT NULL
    CONSTRAINT emotion_records_visibility_requires_club CHECK (
        (visibility = 'club' AND club_id IS NOT NULL) OR
        (visibility = 'public')
    )
);

-- Add helpful comments
COMMENT ON TABLE public.emotion_records IS 'User reading emotions/impressions with visibility control (public or club-only)';
COMMENT ON COLUMN public.emotion_records.visibility IS 'public: visible to all, club: visible only to club members (requires club_id)';
COMMENT ON CONSTRAINT emotion_records_visibility_requires_club ON public.emotion_records IS 'Ensures visibility=club requires a valid club_id';
