-- Create point_logs table for SPEC-DB-001
-- Migration: 0011_create_point_logs
-- Entity: point_logs (포인트 내역)
-- Requirements: REQ-DB-011

-- Create point_logs table
CREATE TABLE public.point_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount integer NOT NULL,
    reason text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add helpful comments
COMMENT ON TABLE public.point_logs IS 'Point transaction history - tracks earning (positive) and spending (negative)';
COMMENT ON COLUMN public.point_logs.id IS 'Primary key';
COMMENT ON COLUMN public.point_logs.user_id IS 'Reference to users table (RESTRICT - preserve point history)';
COMMENT ON COLUMN public.point_logs.amount IS 'Point amount (positive = earn, negative = spend)';
COMMENT ON COLUMN public.point_logs.reason IS 'Reason for point change: completion / reaction / exchange';
COMMENT ON COLUMN public.point_logs.created_at IS 'Transaction timestamp';
