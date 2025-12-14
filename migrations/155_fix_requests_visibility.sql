-- ============================================
-- Migration 155: Fix Requests Menu Visibility
-- ============================================
-- Ensure Requests is visible on desktop sidebar

UPDATE menu_visibility
SET
  show_on_desktop = true,
  sort_order = 16,
  visible_for_roles = '{"sales","operations","sales-manager","admin"}'
WHERE menu_id = 'requests';
