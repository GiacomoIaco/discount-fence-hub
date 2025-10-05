-- Backfill uploader_name for existing photos
-- This sets a generic name based on the user ID since we don't have historical name data
-- Run this in Supabase SQL Editor after running add-uploader-name.sql

-- Option 1: Set all NULL uploader_name to 'Sales Rep' (simple fallback)
UPDATE public.photos
SET uploader_name = 'Sales Rep'
WHERE uploader_name IS NULL;

-- Option 2: If you want to set specific names based on known user IDs, use this instead:
-- UPDATE public.photos
-- SET uploader_name = CASE
--   WHEN uploaded_by = 'user-id-1' THEN 'John Doe'
--   WHEN uploaded_by = 'user-id-2' THEN 'Jane Smith'
--   ELSE 'Sales Rep'
-- END
-- WHERE uploader_name IS NULL;

-- Success message
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count FROM public.photos WHERE uploader_name IS NOT NULL;
  RAISE NOTICE 'Backfill complete! % photos now have uploader names', updated_count;
END $$;
