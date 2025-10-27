-- Storage Policies for Photo Gallery
-- Run this in Supabase SQL Editor after creating storage buckets

-- ============================================
-- PHOTOS BUCKET POLICIES
-- ============================================

-- Policy 1: Allow authenticated users to upload photos to their own folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to view their own photos and published photos
CREATE POLICY "Users can view own and published photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos' AND
  (
    -- Users can see their own photos
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Or if the photo is published (check photos table)
    EXISTS (
      SELECT 1 FROM public.photos p
      WHERE p.url LIKE '%' || name || '%'
      AND p.status = 'published'
    )
    OR
    -- Managers and admins can see all photos (check by email pattern)
    EXISTS (
      SELECT 1 FROM public.sales_reps sr
      WHERE sr.id = auth.uid()
      AND (
        sr.email LIKE '%@manager%'
        OR sr.email LIKE '%@admin%'
      )
    )
  )
);

-- Policy 3: Allow users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow admins to delete any photo
CREATE POLICY "Admins can delete any photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'photos' AND
  EXISTS (
    SELECT 1 FROM public.sales_reps sr
    WHERE sr.id = auth.uid()
    AND sr.email LIKE '%@admin%'
  )
);

-- ============================================
-- VOICE-RECORDINGS BUCKET POLICIES
-- ============================================

-- Policy 1: Allow authenticated users to upload voice recordings to their own folder
CREATE POLICY "Users can upload voice recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to view their own voice recordings
CREATE POLICY "Users can view own voice recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow users to delete their own voice recordings
CREATE POLICY "Users can delete own voice recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'voice-recordings' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- PRESENTATIONS BUCKET POLICIES
-- ============================================

-- Policy 1: Allow authenticated users to upload presentations
CREATE POLICY "Users can upload presentations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'presentations');

-- Policy 2: Allow all authenticated users to view presentations
CREATE POLICY "Users can view all presentations"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'presentations');

-- Policy 3: Allow users to delete their own presentations
CREATE POLICY "Users can delete own presentations"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'presentations' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow admins to delete any presentation
CREATE POLICY "Admins can delete any presentation"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'presentations' AND
  EXISTS (
    SELECT 1 FROM public.sales_reps sr
    WHERE sr.id = auth.uid()
    AND sr.email LIKE '%@admin%'
  )
);

-- ============================================
-- NOTES
-- ============================================

/*
After running this script:

1. Verify policies are created:
   - Go to Storage → Policies in Supabase Dashboard
   - Check that policies exist for each bucket

2. Test upload:
   - Try uploading a photo from the Photo Gallery
   - Check that it appears in Storage → photos bucket

3. Folder structure will be:
   photos/
   ├── {userId}/
   │   ├── full/
   │   │   └── photo_{timestamp}.jpg
   │   └── thumb/
   │       └── photo_{timestamp}.jpg

4. If you get permission errors:
   - Check that user is authenticated (auth.uid() is not null)
   - Verify email pattern for manager/admin detection
   - Check browser console for detailed error messages
*/
