-- Storage Policies for Client Presentations
-- Run this AFTER creating the storage buckets in Supabase Dashboard

-- ========================================
-- POLICIES FOR client-presentations bucket
-- ========================================

-- Allow everyone to view presentations
CREATE POLICY "Presentations are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-presentations');

-- Allow Managers and Admins to upload presentations
CREATE POLICY "Managers and Admins can upload presentations"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-presentations'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Allow Managers and Admins to update presentations
CREATE POLICY "Managers and Admins can update presentations"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'client-presentations'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Allow only Admins to delete presentations
CREATE POLICY "Only Admins can delete presentations"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-presentations'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ========================================
-- POLICIES FOR presentation-videos bucket
-- ========================================

-- Allow everyone to view videos
CREATE POLICY "Presentation videos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'presentation-videos');

-- Allow Managers and Admins to upload videos
CREATE POLICY "Managers and Admins can upload presentation videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'presentation-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Allow Managers and Admins to update videos
CREATE POLICY "Managers and Admins can update presentation videos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'presentation-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Allow only Admins to delete videos
CREATE POLICY "Only Admins can delete presentation videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'presentation-videos'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Presentation storage policies created successfully!';
END $$;
