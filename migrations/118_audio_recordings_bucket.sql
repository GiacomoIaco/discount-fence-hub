-- ============================================
-- Migration 118: Create audio_recordings storage bucket
-- ============================================
-- This bucket stores temporary audio recordings for voice-to-text processing.
-- Files are automatically cleaned up after processing.

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-recordings',
  'audio-recordings',
  false,  -- Private bucket, accessed via signed URLs
  52428800,  -- 50MB limit
  ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio files
CREATE POLICY "Users can upload audio recordings" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'audio-recordings');

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own audio recordings" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own audio recordings" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow service role to access all files (for Netlify functions)
CREATE POLICY "Service role has full access to audio recordings" ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'audio-recordings')
  WITH CHECK (bucket_id = 'audio-recordings');
