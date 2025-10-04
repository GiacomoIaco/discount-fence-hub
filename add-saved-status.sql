-- Add 'saved' status to photos table
-- This migration adds a new status option for photos that have been reviewed but aren't ready to publish

-- First, drop the existing constraint
ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_status_check;

-- Add the new constraint with 'saved' included
ALTER TABLE public.photos ADD CONSTRAINT photos_status_check
  CHECK (status IN ('pending', 'saved', 'published', 'archived'));

-- Optional: Update any photos that have review_notes but are still pending to 'saved'
-- UPDATE public.photos
-- SET status = 'saved'
-- WHERE status = 'pending' AND review_notes IS NOT NULL;
