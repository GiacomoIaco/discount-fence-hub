-- ============================================
-- Migration 098: Add Requests Menu Item
-- ============================================
-- Adds the 'requests' menu item for mobile/desktop request submission

-- Add requests menu item (the voice-enabled request hub)
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, available_on) VALUES
  ('requests', 'Requests', '{"sales","operations","sales-manager","admin"}', 'both')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  available_on = EXCLUDED.available_on,
  updated_at = NOW();
