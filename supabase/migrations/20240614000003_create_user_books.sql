-- Create user_books table for SPEC-DB-001
-- Migration: 0003_create_user_books
-- Entity: user_books (서재)
-- Requirements: REQ-DB-003

-- Create user_books table (user's book library)
CREATE TABLE public.user_books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'completed', 'shelved')),
    current_page integer DEFAULT 0,
    is_public boolean DEFAULT true,
    started_reading_at timestamptz,
    last_progress_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    -- Prevent duplicate registration of same book by same user
    CONSTRAINT user_books_user_id_book_id_unique UNIQUE (user_id, book_id)
);

-- Create trigger function to update last_progress_at and completed_at
CREATE OR REPLACE FUNCTION public.update_user_book_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update last_progress_at when current_page changes
    IF (TG_OP = 'UPDATE' AND OLD.current_page IS DISTINCT FROM NEW.current_page) THEN
        NEW.last_progress_at := now();
    END IF;

    -- Auto-set completed_at when status changes to 'completed'
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') THEN
        NEW.completed_at := now();
    END IF;

    -- Always update updated_at
    NEW.updated_at := now();

    RETURN NEW;
END;
$$;

-- Create trigger to call update_user_book_progress
CREATE TRIGGER on_user_books_update
    BEFORE UPDATE ON public.user_books
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_book_progress();

-- Add helpful comments
COMMENT ON TABLE public.user_books IS 'User library - books registered by each user';
COMMENT ON COLUMN public.user_books.is_public IS 'Controls exposure in Track A reader list (public=true shows in "currently reading")';
COMMENT ON COLUMN public.user_books.started_reading_at IS '"Start reading today" declaration timestamp - basis for "similar timing" recommendations';
COMMENT ON COLUMN public.user_books.last_progress_at IS 'Last progress update timestamp - used for activity filtering ("ghost user" detection)';
COMMENT ON FUNCTION public.update_user_book_progress() IS 'Updates last_progress_at, completed_at, and updated_at based on status/page changes';
