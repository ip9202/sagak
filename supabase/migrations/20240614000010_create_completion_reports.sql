-- Create completion_reports table and trigger for SPEC-DB-001
-- Migration: 0010_create_completion_reports
-- Entity: completion_reports (완독 리포트)
-- Requirements: REQ-DB-010

-- Create completion_reports table
CREATE TABLE public.completion_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    user_book_id uuid NOT NULL UNIQUE REFERENCES public.user_books(id) ON DELETE RESTRICT,
    report_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Create UNIQUE constraint on user_book_id (idempotency guarantee)
-- Note: Already defined as UNIQUE in column definition above

-- Create trigger function for auto-generating completion reports
-- SECURITY DEFINER to bypass RLS when reading emotion_records and inserting completion_reports
CREATE OR REPLACE FUNCTION public.generate_completion_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_report_data jsonb;
    v_user_id uuid;
    v_book_id uuid;
BEGIN
    -- Only proceed when status changes TO 'completed' FROM non-completed
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
        -- Get user_id and book_id from the user_book
        SELECT user_id, book_id INTO v_user_id, v_book_id
        FROM public.user_books
        WHERE id = NEW.id;

        -- Aggregate emotion_records to build report_data
        -- NOTE: aggregate 안에 aggregate 금지 → COUNT(*)를 서브쿼리로 분리
        SELECT jsonb_build_object(
            'emotion_curve', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'page_number', page_number,
                    'emotion_count', emotion_count
                ) ORDER BY page_number)
                FROM (
                    SELECT page_number, COUNT(*) AS emotion_count
                    FROM public.emotion_records
                    WHERE user_id = v_user_id AND book_id = v_book_id
                    GROUP BY page_number
                ) ec),
                '[]'::jsonb
            ),
            'highlights', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'page_number', page_number,
                    'content', content
                ))
                FROM (
                    SELECT page_number, content
                    FROM public.emotion_records
                    WHERE user_id = v_user_id AND book_id = v_book_id
                    ORDER BY created_at DESC
                    LIMIT 5
                ) highlights),
                '[]'::jsonb
            ),
            'total_records', (
                SELECT COUNT(*)
                FROM public.emotion_records
                WHERE user_id = v_user_id AND book_id = v_book_id
            )
        ) INTO v_report_data;

        -- Insert completion report with ON CONFLICT DO NOTHING for idempotency
        INSERT INTO public.completion_reports (user_id, book_id, user_book_id, report_data)
        VALUES (v_user_id, v_book_id, NEW.id, v_report_data)
        ON CONFLICT (user_book_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

-- Create AFTER UPDATE trigger on user_books
CREATE TRIGGER generate_completion_report_trigger
    AFTER UPDATE OF status ON public.user_books
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_completion_report();

-- Alter function owner to postgres (BYPASSRLS role)
ALTER FUNCTION public.generate_completion_report() OWNER TO postgres;

-- Add helpful comments
COMMENT ON TABLE public.completion_reports IS 'Completion reports - auto-generated when user_books.status changes to completed';
COMMENT ON COLUMN public.completion_reports.id IS 'Primary key';
COMMENT ON COLUMN public.completion_reports.user_id IS 'Reference to users table (CASCADE on user delete)';
COMMENT ON COLUMN public.completion_reports.book_id IS 'Reference to books table (CASCADE on book delete)';
COMMENT ON COLUMN public.completion_reports.user_book_id IS 'Reference to user_books table (RESTRICT - preserve reports)';
COMMENT ON COLUMN public.completion_reports.report_data IS 'JSONB containing emotion_curve, highlights, total_records';
COMMENT ON COLUMN public.completion_reports.created_at IS 'Report generation timestamp';
COMMENT ON FUNCTION public.generate_completion_report() IS 'SECURITY DEFINER trigger - auto-generates completion_report when user_books.status changes to completed';
