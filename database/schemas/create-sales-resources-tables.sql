-- Sales Resources feature tables
-- This migration creates tables for managing sales training materials and resources

-- 1. Folders table
CREATE TABLE IF NOT EXISTS public.sales_resources_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.sales_reps(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.sales_reps(id)
);

-- 2. Files table
CREATE TABLE IF NOT EXISTS public.sales_resources_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.sales_resources_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'ppt', 'pptx', 'video', 'image'
  file_size INTEGER NOT NULL, -- in bytes
  storage_path TEXT NOT NULL, -- path in Supabase storage
  uploaded_by UUID REFERENCES public.sales_reps(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  archived_by UUID REFERENCES public.sales_reps(id),
  view_count INTEGER DEFAULT 0
);

-- 3. File views tracking table
CREATE TABLE IF NOT EXISTS public.sales_resources_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.sales_resources_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.sales_reps(id),
  viewed_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Favorites table
CREATE TABLE IF NOT EXISTS public.sales_resources_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.sales_resources_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.sales_reps(id),
  favorited_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(file_id, user_id) -- prevent duplicate favorites
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_archived ON public.sales_resources_folders(archived);
CREATE INDEX IF NOT EXISTS idx_files_folder ON public.sales_resources_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_files_archived ON public.sales_resources_files(archived);
CREATE INDEX IF NOT EXISTS idx_views_file ON public.sales_resources_views(file_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON public.sales_resources_views(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_file ON public.sales_resources_favorites(file_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.sales_resources_favorites(user_id);

-- Insert default folders
INSERT INTO public.sales_resources_folders (name, created_by, created_at)
VALUES
  ('Sales Training', '00000000-0000-0000-0000-000000000001', now()),
  ('Company Policies', '00000000-0000-0000-0000-000000000001', now())
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.sales_resources_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_resources_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all authenticated users to read, but only Sales Manager/Admin to write
-- For now, allow all operations (you can tighten this later)
CREATE POLICY "Allow all operations on folders" ON public.sales_resources_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on files" ON public.sales_resources_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on views" ON public.sales_resources_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on favorites" ON public.sales_resources_favorites FOR ALL USING (true) WITH CHECK (true);
