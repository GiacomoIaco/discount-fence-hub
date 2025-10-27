-- Add uploader_name column to photos table
-- Run this in Supabase SQL Editor

ALTER TABLE public.photos
ADD COLUMN IF NOT EXISTS uploader_name TEXT;

COMMENT ON COLUMN public.photos.uploader_name IS 'Name of the user who uploaded the photo (stored for display purposes)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added uploader_name column to photos table!';
  RAISE NOTICE 'Now photos will display the uploader name without needing to query sales_reps table';
END $$;
