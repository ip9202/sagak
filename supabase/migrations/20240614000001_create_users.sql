-- Create users table for SPEC-DB-001
-- Migration: 0001_create_users
-- Entity: users (회원)
-- Requirements: REQ-DB-001

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    nickname text NOT NULL,
    avatar_url text,
    provider text NOT NULL CHECK (provider IN ('kakao', 'apple', 'google')),
    reading_alarm_time time,
    reading_alarm_enabled boolean DEFAULT true,
    role text DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create handle_new_user trigger function (SECURITY DEFINER)
-- This function automatically creates a public.users row when auth.users INSERT occurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.users (id, email, nickname, avatar_url, provider)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_id_data->>'nickname', split_part(NEW.email, '@', 1)),
        NEW.raw_user_id_data->>'avatar_url',
        NEW.raw_user_id_data->>'provider'
    );
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users to call handle_new_user
-- Note: This will be created after auth.users exists (managed by Supabase Auth)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Add helpful comment
COMMENT ON TABLE public.users IS 'User profiles synced from auth.users via handle_new_user trigger';
COMMENT ON FUNCTION public.handle_new_user() IS 'SECURITY DEFINER trigger that creates public.users row when auth.users INSERT occurs';
