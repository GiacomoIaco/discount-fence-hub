-- Fix database constraints for photos table
-- Run this in Supabase SQL Editor

-- 1. Remove foreign key constraint on reviewed_by
-- This was pointing to sales_reps table, but users are in Supabase auth
ALTER TABLE public.photos
DROP CONSTRAINT IF EXISTS photos_reviewed_by_fkey;

COMMENT ON COLUMN public.photos.reviewed_by IS 'UUID of user who reviewed the photo (from auth.users)';

-- 2. Fix RLS policy for storage bucket to allow updates
-- Allow authenticated users to update their own photos
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;

CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Also allow admin users to update any photos
DROP POLICY IF EXISTS "Admins can update any photos" ON storage.objects;

CREATE POLICY "Admins can update any photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully fixed database constraints!';
  RAISE NOTICE 'Foreign key removed, RLS policies updated for photo storage';
END $$;
