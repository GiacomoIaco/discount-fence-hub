-- Remove all foreign key constraints from photos table
-- Run this in Supabase SQL Editor

-- These constraints were pointing to sales_reps table which is empty
-- Users are managed through Supabase auth instead

ALTER TABLE public.photos
DROP CONSTRAINT IF EXISTS photos_uploaded_by_fkey;

ALTER TABLE public.photos
DROP CONSTRAINT IF EXISTS photos_reviewed_by_fkey;

-- Add comments to document the fields
COMMENT ON COLUMN public.photos.uploaded_by IS 'UUID of user who uploaded the photo (from auth.users)';
COMMENT ON COLUMN public.photos.reviewed_by IS 'UUID of user who reviewed the photo (from auth.users)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully removed all foreign key constraints from photos table!';
  RAISE NOTICE 'Photos can now be uploaded and reviewed by any authenticated user';
END $$;
