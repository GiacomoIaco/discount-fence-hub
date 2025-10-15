-- Migration: Add BOM Calculator to Menu Visibility
-- Description: Adds BOM Calculator menu item to the menu_visibility table
-- Created: 2025-10-15

-- Insert BOM Calculator menu visibility setting
-- Visible to operations and admin roles by default
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles) VALUES
  ('bom-calculator', 'BOM Calculator', '{"operations","admin"}')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  updated_at = NOW();

-- Add comment
COMMENT ON COLUMN menu_visibility.menu_id IS 'Unique identifier for the menu item (e.g., bom-calculator, dashboard)';
