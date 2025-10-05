-- Custom Photo Tags System
-- Run this in Supabase SQL Editor

-- Create custom_photo_tags table
CREATE TABLE IF NOT EXISTS custom_photo_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('productType', 'material', 'style')),
  tag_name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique tags per category (case-insensitive)
  UNIQUE(category, LOWER(tag_name))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_tags_category ON custom_photo_tags(category);
CREATE INDEX IF NOT EXISTS idx_custom_tags_created_by ON custom_photo_tags(created_by);

-- RLS Policies
ALTER TABLE custom_photo_tags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read custom tags
CREATE POLICY "Anyone can read custom tags"
ON custom_photo_tags FOR SELECT
TO authenticated
USING (true);

-- Only admins can create custom tags
CREATE POLICY "Admins can create custom tags"
ON custom_photo_tags FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Only admins can delete custom tags
CREATE POLICY "Admins can delete custom tags"
ON custom_photo_tags FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'admin'
  )
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully created custom_photo_tags table!';
  RAISE NOTICE 'Admins can now create and manage custom tags';
END $$;
