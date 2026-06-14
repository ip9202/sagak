-- Create books table for SPEC-DB-001
-- Migration: 0002_create_books
-- Entity: books (도서)
-- Requirements: REQ-DB-002

-- Create books table (catalog of books)
CREATE TABLE public.books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn text UNIQUE NOT NULL,
    title text NOT NULL,
    author text NOT NULL,
    publisher text,
    published_at date,
    cover_url text,
    total_pages integer,
    kakao_id text, -- 카카오 도서 API ID
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Add helpful comment
COMMENT ON TABLE public.books IS 'Book catalog - cache of Kakao Book Search API results plus manual entries';
COMMENT ON COLUMN public.books.kakao_id IS 'Kakao Books API ID for search result integration';
