-- Migration: Menu Visibility Control
-- Description: Simple menu visibility control by role and user
-- Created: 2025-10-10

-- Create menu_visibility table
CREATE TABLE IF NOT EXISTS menu_visibility (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id TEXT NOT NULL UNIQUE,
  menu_name TEXT NOT NULL,
  visible_for_roles TEXT[] DEFAULT '{"sales","operations","sales-manager","admin"}',
  enabled_users TEXT[] DEFAULT '{}',
  disabled_users TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_menu_visibility_menu_id ON menu_visibility(menu_id);

-- Enable RLS
ALTER TABLE menu_visibility ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read menu visibility
CREATE POLICY "Anyone can view menu visibility"
  ON menu_visibility
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only admins can update menu visibility
CREATE POLICY "Only admins can update menu visibility"
  ON menu_visibility
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Insert default menu visibility settings
-- All items visible to all roles by default
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles) VALUES
  ('dashboard', 'Dashboard', '{"sales","operations","sales-manager","admin"}'),
  ('team-communication', 'Announcements', '{"sales","operations","sales-manager","admin"}'),
  ('direct-messages', 'Chat', '{"sales","operations","sales-manager","admin"}'),
  ('presentation', 'Client Presentation', '{"sales","sales-manager","admin"}'),
  ('sales-coach', 'AI Sales Coach', '{"sales","sales-manager","admin"}'),
  ('photo-gallery', 'Photo Gallery', '{"sales","operations","sales-manager","admin"}'),
  ('stain-calculator', 'Pre-Stain Calculator', '{"sales","sales-manager","admin"}'),
  ('my-requests', 'My Requests', '{"sales","operations","sales-manager","admin"}'),
  ('analytics', 'Analytics', '{"sales-manager","admin"}'),
  ('sales-resources', 'Sales Resources', '{"sales","sales-manager","admin"}'),
  ('team', 'Settings', '{"sales","operations","sales-manager","admin"}')
ON CONFLICT (menu_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE menu_visibility IS 'Controls which menu items are visible to which roles and users';
