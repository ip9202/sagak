-- Create sticker_type ENUM and sticker_reactions table for SPEC-DB-001
-- Migration: 0006_create_sticker_enum_and_reactions
-- Entity: sticker_reactions (스티커 반응)
-- Requirements: REQ-DB-006

-- Create sticker_type ENUM
CREATE TYPE public.sticker_type AS ENUM ('empathy', 'touching', 'comforted');

-- Create sticker_reactions table (sticker reactions on emotion records)
CREATE TABLE public.sticker_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id uuid NOT NULL REFERENCES public.emotion_records(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    sticker_type public.sticker_type NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    -- Prevent duplicate stickers by same user on same record
    CONSTRAINT sticker_reactions_record_id_user_id_unique UNIQUE (record_id, user_id)
);

-- Add helpful comments
COMMENT ON TABLE public.sticker_reactions IS 'Sticker reactions on emotion records - each user can place at most one sticker per record';
COMMENT ON TYPE public.sticker_type IS 'Sticker types: empathy (공감), touching (감동), comforted (위로)';
COMMENT ON COLUMN public.sticker_reactions.record_id IS 'Reference to emotion_records - deleted on CASCADE when record deleted';
COMMENT ON CONSTRAINT sticker_reactions_record_id_user_id_unique ON public.sticker_reactions IS 'Prevents duplicate stickers by same user on same record';
