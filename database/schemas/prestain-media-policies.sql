-- Storage Policies for prestain-media bucket
-- Run this AFTER creating the 'prestain-media' bucket in Supabase Dashboard

-- Allow everyone to view media
CREATE POLICY "Prestain media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'prestain-media');

-- Allow admins to upload media
CREATE POLICY "Admins can upload prestain media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'prestain-media'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow admins to delete media
CREATE POLICY "Admins can delete prestain media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'prestain-media'
    AND EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Prestain media storage policies created successfully!';
END $$;
