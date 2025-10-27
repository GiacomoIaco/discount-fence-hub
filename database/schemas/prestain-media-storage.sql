-- Pre-Stain Calculator Media Storage Setup
-- Run this in Supabase SQL Editor

-- 1. Create storage bucket for pre-stain calculator media (if not exists)
-- Note: Storage buckets must be created via Supabase Dashboard or API
-- Bucket name: 'prestain-media'
-- Settings: Public bucket

-- 2. Create table to track pre-stain calculator media items
CREATE TABLE IF NOT EXISTS public.prestain_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  caption TEXT,
  display_order INT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_prestain_media_order ON public.prestain_media(display_order);
CREATE INDEX IF NOT EXISTS idx_prestain_media_created ON public.prestain_media(created_at);

-- 4. Enable RLS
ALTER TABLE public.prestain_media ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - Everyone can view, only admins can manage
CREATE POLICY "Anyone can view prestain media"
  ON public.prestain_media FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert prestain media"
  ON public.prestain_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update prestain media"
  ON public.prestain_media FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete prestain media"
  ON public.prestain_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prestain_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prestain_media_updated_at
  BEFORE UPDATE ON public.prestain_media
  FOR EACH ROW
  EXECUTE FUNCTION update_prestain_media_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Pre-stain media table created successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create storage bucket "prestain-media" (public) in Supabase Dashboard';
  RAISE NOTICE '2. Apply storage policies for the bucket';
  RAISE NOTICE '3. Update the app to use Supabase storage';
END $$;
