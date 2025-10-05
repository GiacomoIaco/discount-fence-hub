-- Add confidence_score column to photos table for AI confidence tracking
-- Run this in Supabase SQL Editor

ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100);

COMMENT ON COLUMN public.photos.confidence_score IS 'AI confidence score for tagging accuracy (0-100). 80+ = high confidence, 60-79 = medium, <60 = low';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added confidence_score column to photos table!';
  RAISE NOTICE 'Now photos will track AI confidence for bulk publishing workflow';
END $$;
