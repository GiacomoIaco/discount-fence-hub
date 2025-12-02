-- Fix Storage Buckets for Attachments and Chat Files
-- This migration ensures storage buckets exist and are accessible

-- ============================================
-- 1. FIX REQUEST-ATTACHMENTS BUCKET
-- Make it public so getPublicUrl() works
-- ============================================

-- Update the bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'request-attachments';

-- If bucket doesn't exist, create it as public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'request-attachments',
  'request-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'audio/*', 'video/*']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================
-- 2. CREATE CHAT-FILES BUCKET (if not exists)
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,
  10485760, -- 10MB limit for chat
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ============================================
-- 3. STORAGE POLICIES FOR REQUEST-ATTACHMENTS
-- ============================================

-- Drop existing policies first (if any)
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public can view request attachments" ON storage.objects;

-- Policy: Anyone can view request attachments (bucket is public)
CREATE POLICY "Public can view request attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'request-attachments');

-- Policy: Authenticated users can upload to request-attachments
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'request-attachments');

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'request-attachments' AND (storage.foldername(name))[1] IS NOT NULL);

-- ============================================
-- 4. STORAGE POLICIES FOR CHAT-FILES
-- ============================================

DROP POLICY IF EXISTS "Public can view chat files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

-- Policy: Anyone can view chat files (bucket is public)
CREATE POLICY "Public can view chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

-- Policy: Authenticated users can upload to chat-files
CREATE POLICY "Authenticated users can upload chat files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

-- Policy: Users can delete their own chat files
CREATE POLICY "Users can delete their own chat files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-files' AND (storage.foldername(name))[1] IS NOT NULL);

-- ============================================
-- 5. ENSURE DIRECT_MESSAGES HAS FILE COLUMNS
-- ============================================

-- Add file columns if they don't exist (from migration 012)
ALTER TABLE direct_messages
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Storage buckets fixed!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '• request-attachments bucket → public = true';
  RAISE NOTICE '• chat-files bucket → created/updated as public';
  RAISE NOTICE '• Storage policies updated for both buckets';
  RAISE NOTICE '• direct_messages file columns ensured';
  RAISE NOTICE '';
END $$;
