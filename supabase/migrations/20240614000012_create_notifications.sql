-- Create notifications table for SPEC-DB-001
-- Migration: 0012_create_notifications
-- Entity: notifications (알림)
-- Requirements: REQ-DB-012

-- Create notifications table
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    ref_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add helpful comments
COMMENT ON TABLE public.notifications IS 'User notifications - club invites, reactions, mentions, completions';
COMMENT ON COLUMN public.notifications.id IS 'Primary key';
COMMENT ON COLUMN public.notifications.user_id IS 'Reference to users table (RESTRICT - preserve notification history)';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: club_invite / reaction / mention / completion / system';
COMMENT ON COLUMN public.notifications.title IS 'Notification title';
COMMENT ON COLUMN public.notifications.body IS 'Notification body content';
COMMENT ON COLUMN public.notifications.ref_id IS 'Optional reference ID (e.g., club_id for club_invite)';
COMMENT ON COLUMN public.notifications.is_read IS 'Read status (default false)';
COMMENT ON COLUMN public.notifications.created_at IS 'Notification creation timestamp';
