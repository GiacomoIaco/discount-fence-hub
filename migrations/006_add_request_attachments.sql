-- Add request attachments feature
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. CREATE REQUEST ATTACHMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'document', 'audio', 'video', 'other'
  file_size INTEGER, -- in bytes
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_request_attachments_request_id ON request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_attachments_user_id ON request_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_request_attachments_created ON request_attachments(uploaded_at DESC);

-- ============================================
-- 2. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE request_attachments ENABLE ROW LEVEL SECURITY;

-- Users can view attachments for requests they have access to
DROP POLICY IF EXISTS "Users can view request attachments" ON request_attachments;
CREATE POLICY "Users can view request attachments"
  ON request_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_attachments.request_id
      AND (
        r.submitter_id = auth.uid()
        OR r.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'operations')
        )
      )
    )
  );

-- Users can add attachments to requests they have access to
DROP POLICY IF EXISTS "Users can create request attachments" ON request_attachments;
CREATE POLICY "Users can create request attachments"
  ON request_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM requests r
      WHERE r.id = request_attachments.request_id
      AND (
        r.submitter_id = auth.uid()
        OR r.assigned_to = auth.uid()
        OR EXISTS (
          SELECT 1 FROM user_profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'operations')
        )
      )
    )
  );

-- Users can delete their own attachments
DROP POLICY IF EXISTS "Users can delete their own attachments" ON request_attachments;
CREATE POLICY "Users can delete their own attachments"
  ON request_attachments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. STORAGE BUCKET
-- ============================================

-- Create storage bucket for request attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for request-attachments bucket
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'request-attachments');

DROP POLICY IF EXISTS "Users can view attachments they have access to" ON storage.objects;
CREATE POLICY "Users can view attachments they have access to"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'request-attachments');

DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'request-attachments' AND auth.uid() = owner);

-- ============================================
-- 4. SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Request attachments feature installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• Attach files, images, documents to requests';
  RAISE NOTICE '• Separate attachments table with metadata';
  RAISE NOTICE '• Secure storage bucket with RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Ensure storage bucket is created in Supabase dashboard';
  RAISE NOTICE '2. Update your frontend to use the new attachments table';
END $$;
