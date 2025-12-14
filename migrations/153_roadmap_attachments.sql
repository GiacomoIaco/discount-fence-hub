-- ============================================
-- Migration 153: Roadmap Attachments
-- ============================================
-- Allows attaching files (images, videos, documents) to roadmap items
-- for visual references, mockups, and documentation.

-- ============================================
-- 1. CREATE ROADMAP ATTACHMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS roadmap_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_item_id UUID NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'video', 'document', 'audio', 'other'
  file_size INTEGER, -- in bytes
  mime_type TEXT,
  description TEXT, -- optional caption/description
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_attachments_item_id ON roadmap_attachments(roadmap_item_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_attachments_uploaded_by ON roadmap_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_roadmap_attachments_uploaded_at ON roadmap_attachments(uploaded_at DESC);

COMMENT ON TABLE roadmap_attachments IS 'File attachments for roadmap items (screenshots, videos, mockups, docs)';
COMMENT ON COLUMN roadmap_attachments.file_type IS 'Category: image, video, document, audio, other';
COMMENT ON COLUMN roadmap_attachments.description IS 'Optional caption or description for the attachment';

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE roadmap_attachments ENABLE ROW LEVEL SECURITY;

-- Everyone can view roadmap attachments (matches roadmap_items policy)
DROP POLICY IF EXISTS "Everyone can view roadmap attachments" ON roadmap_attachments;
CREATE POLICY "Everyone can view roadmap attachments"
  ON roadmap_attachments FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can add attachments (so anyone can add to their ideas)
DROP POLICY IF EXISTS "Authenticated users can add roadmap attachments" ON roadmap_attachments;
CREATE POLICY "Authenticated users can add roadmap attachments"
  ON roadmap_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Users can delete their own attachments, admins can delete any
DROP POLICY IF EXISTS "Users can delete own roadmap attachments" ON roadmap_attachments;
CREATE POLICY "Users can delete own roadmap attachments"
  ON roadmap_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- 3. STORAGE BUCKET FOR ROADMAP FILES
-- ============================================

-- Create public bucket for roadmap attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'roadmap-attachments',
  'roadmap-attachments',
  true,
  104857600, -- 100MB limit (for videos)
  ARRAY[
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600;

-- ============================================
-- 4. STORAGE POLICIES FOR ROADMAP-ATTACHMENTS
-- ============================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view roadmap attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload roadmap attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their roadmap attachments" ON storage.objects;

-- Policy: Anyone can view roadmap attachments (bucket is public)
CREATE POLICY "Public can view roadmap attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'roadmap-attachments');

-- Policy: Authenticated users can upload to roadmap-attachments
CREATE POLICY "Authenticated users can upload roadmap attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'roadmap-attachments');

-- Policy: Users can delete their own files, admins can delete any
CREATE POLICY "Users can delete their roadmap attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'roadmap-attachments'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM user_profiles
        WHERE id = auth.uid()
        AND role = 'admin'
      )
    )
  );

-- ============================================
-- 5. SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Roadmap Attachments feature installed!';
  RAISE NOTICE '==============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '  - Attach images, videos, documents to roadmap items';
  RAISE NOTICE '  - 100MB file size limit (good for videos)';
  RAISE NOTICE '  - Supports: images, videos, audio, PDFs, Office docs';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Update frontend to use roadmap_attachments table';
  RAISE NOTICE '';
END $$;
