-- ============================================================================
-- 281: Todo item attachments + comment file support
--
-- Adds:
-- 1. file_url, file_name, file_type columns on todo_item_comments (inline in chat)
-- 2. todo_item_attachments table (Files tab gallery)
-- ============================================================================

-- Add file columns to todo_item_comments (for inline display in chat)
ALTER TABLE todo_item_comments
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_type text;

-- Attachments table (mirrors roadmap_attachments pattern)
CREATE TABLE IF NOT EXISTS todo_item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES todo_items(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL DEFAULT 'other',
  file_size bigint,
  mime_type text,
  description text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_todo_item_attachments_item_id ON todo_item_attachments(item_id);
CREATE INDEX IF NOT EXISTS idx_todo_item_attachments_uploaded_by ON todo_item_attachments(uploaded_by);

-- Enable RLS
ALTER TABLE todo_item_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "todo_item_attachments_select" ON todo_item_attachments
  FOR SELECT TO authenticated
  USING (
    is_todo_item_in_accessible_list(item_id)
    OR is_current_user_admin()
  );

CREATE POLICY "todo_item_attachments_insert" ON todo_item_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (is_todo_item_in_accessible_list(item_id) OR is_current_user_admin())
  );

CREATE POLICY "todo_item_attachments_delete" ON todo_item_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR is_current_user_admin()
  );

-- ============================================================================
-- STORAGE: Run these via Supabase Dashboard SQL Editor (requires superuser)
-- ============================================================================
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('todo-attachments', 'todo-attachments', true, 104857600,
--   ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml','image/heic','image/heif',
--         'video/mp4','video/quicktime','video/webm','video/x-msvideo',
--         'audio/mpeg','audio/wav','audio/webm','audio/ogg',
--         'application/pdf','application/msword',
--         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--         'application/vnd.ms-excel',
--         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
--         'text/plain','text/markdown'])
-- ON CONFLICT (id) DO NOTHING;
--
-- CREATE POLICY "todo_attachments_upload" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'todo-attachments');
-- CREATE POLICY "todo_attachments_read" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'todo-attachments');
-- CREATE POLICY "todo_attachments_delete" ON storage.objects
--   FOR DELETE TO authenticated
--   USING (bucket_id = 'todo-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
