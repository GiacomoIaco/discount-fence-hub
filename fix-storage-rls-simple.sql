-- Fix RLS policies for photo storage (simplified version)
-- Run this in Supabase SQL Editor

-- 1. Allow authenticated users to update their own photos
DROP POLICY IF EXISTS "Users can update own photos" ON storage.objects;

CREATE POLICY "Users can update own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Allow ALL authenticated users to update any photo (simplified for now)
-- This allows admins and managers to enhance any photo
DROP POLICY IF EXISTS "Authenticated users can update photos" ON storage.objects;

CREATE POLICY "Authenticated users can update photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'photos')
WITH CHECK (bucket_id = 'photos');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated storage RLS policies!';
  RAISE NOTICE 'All authenticated users can now update photos in storage';
END $$;
