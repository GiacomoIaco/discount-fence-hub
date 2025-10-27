-- Client Presentations Schema
-- Run this in Supabase SQL Editor

-- 1. Create presentations table
CREATE TABLE IF NOT EXISTS public.client_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'pptx', 'video')),
  file_size BIGINT,
  slide_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create presentation slides table (for metadata)
CREATE TABLE IF NOT EXISTS public.presentation_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.client_presentations(id) ON DELETE CASCADE,
  slide_number INT NOT NULL,
  title TEXT,
  talking_points TEXT,
  video_url TEXT,
  video_file_path TEXT,
  jump_targets INT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(presentation_id, slide_number)
);

-- 3. Create user notes table (for sales to add their notes)
CREATE TABLE IF NOT EXISTS public.presentation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.client_presentations(id) ON DELETE CASCADE,
  slide_number INT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create presentation views tracking table
CREATE TABLE IF NOT EXISTS public.presentation_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES public.client_presentations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  duration_seconds INT,
  completed BOOLEAN DEFAULT false
);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_presentations_status ON public.client_presentations(status);
CREATE INDEX IF NOT EXISTS idx_presentations_order ON public.client_presentations(display_order);
CREATE INDEX IF NOT EXISTS idx_slides_presentation ON public.presentation_slides(presentation_id, slide_number);
CREATE INDEX IF NOT EXISTS idx_notes_user_presentation ON public.presentation_notes(user_id, presentation_id);
CREATE INDEX IF NOT EXISTS idx_views_presentation ON public.presentation_views(presentation_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON public.presentation_views(user_id);

-- 6. Enable RLS
ALTER TABLE public.client_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_views ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for client_presentations
-- Everyone can view active presentations
CREATE POLICY "Users can view active presentations"
  ON public.client_presentations FOR SELECT
  USING (status = 'active' OR status = 'archived');

-- Managers and Admins can insert presentations
CREATE POLICY "Managers and Admins can insert presentations"
  ON public.client_presentations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Managers and Admins can update presentations
CREATE POLICY "Managers and Admins can update presentations"
  ON public.client_presentations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- Only Admins can delete presentations
CREATE POLICY "Only Admins can delete presentations"
  ON public.client_presentations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 8. RLS Policies for presentation_slides
CREATE POLICY "Users can view slides"
  ON public.presentation_slides FOR SELECT
  USING (true);

CREATE POLICY "Managers and Admins can manage slides"
  ON public.presentation_slides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- 9. RLS Policies for presentation_notes
CREATE POLICY "Users can view their own notes"
  ON public.presentation_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all notes"
  ON public.presentation_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

CREATE POLICY "Users can insert their own notes"
  ON public.presentation_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON public.presentation_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON public.presentation_notes FOR DELETE
  USING (auth.uid() = user_id);

-- 10. RLS Policies for presentation_views
CREATE POLICY "Users can insert their own views"
  ON public.presentation_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own view history"
  ON public.presentation_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all view history"
  ON public.presentation_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'sales-manager')
    )
  );

-- 11. Create update trigger
CREATE OR REPLACE FUNCTION update_presentation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER presentation_updated_at
  BEFORE UPDATE ON public.client_presentations
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

CREATE TRIGGER slides_updated_at
  BEFORE UPDATE ON public.presentation_slides
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.presentation_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_presentation_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Client presentations schema created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create storage bucket "client-presentations" (public) in Supabase Dashboard';
  RAISE NOTICE '2. Create storage bucket "presentation-videos" (public) in Supabase Dashboard';
  RAISE NOTICE '3. Apply storage policies';
END $$;
