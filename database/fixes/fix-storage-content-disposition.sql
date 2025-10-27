-- Fix sales-resources bucket to display files inline instead of downloading
-- Run this in Supabase SQL Editor

-- 1. Check current bucket configuration
SELECT * FROM storage.buckets WHERE name = 'sales-resources';

-- 2. Make bucket public (required for inline viewing)
UPDATE storage.buckets
SET public = true
WHERE name = 'sales-resources';

-- 3. Update file_size_limit and allowed_mime_types if needed
UPDATE storage.buckets
SET
  file_size_limit = 20971520,  -- 20MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ]
WHERE name = 'sales-resources';

-- IMPORTANT: After running this SQL, you need to:
-- 1. Go to Supabase Dashboard > Storage > sales-resources bucket
-- 2. Click on bucket settings (gear icon)
-- 3. Make sure "Public bucket" is enabled
-- 4. Re-upload the existing presentation file to ensure proper content-type is set

-- The app now uploads files with proper contentType metadata
-- This ensures new uploads will display inline automatically
