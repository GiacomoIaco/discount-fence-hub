-- Storage Policies for Enhanced User Profiles
-- Run this in Supabase SQL Editor after creating the storage buckets

-- ========================================
-- POLICIES FOR user-avatars (PUBLIC BUCKET)
-- ========================================

-- Allow anyone to view avatars
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ========================================
-- POLICIES FOR voice-samples (PRIVATE BUCKET)
-- ========================================

-- Users can access their own voice sample
CREATE POLICY "Users can access their own voice sample"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can upload their own voice sample
CREATE POLICY "Users can upload their own voice sample"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own voice sample
CREATE POLICY "Users can update their own voice sample"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'voice-samples'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can access all voice samples for AI training
CREATE POLICY "Admins can access all voice samples"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-samples'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Storage policies created successfully!';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '- Upload and manage their own profile pictures';
  RAISE NOTICE '- Upload and manage their own voice samples';
  RAISE NOTICE '- Admins can access all voice samples for AI training';
END $$;
