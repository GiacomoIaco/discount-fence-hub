-- ============================================
-- Migration 097: Menu Visibility Platform Support
-- ============================================
-- Adds platform availability (desktop/mobile/both) to menu items
-- Adds yard role support
-- Adds My To-Dos menu item
-- Splits BOM Hub into granular sections

-- ============================================
-- 1. Add available_on column
-- ============================================
ALTER TABLE menu_visibility
ADD COLUMN IF NOT EXISTS available_on TEXT DEFAULT 'desktop'
CHECK (available_on IN ('desktop', 'mobile', 'both'));

COMMENT ON COLUMN menu_visibility.available_on IS 'Platform availability: desktop, mobile, or both. Set by developers based on feature implementation.';

-- ============================================
-- 2. Update existing items with platform availability
-- ============================================

-- Desktop-only features
UPDATE menu_visibility SET available_on = 'desktop' WHERE menu_id IN (
  'dashboard',
  'presentation',
  'sales-coach',
  'stain-calculator',
  'analytics',
  'leadership'
);

-- Both platforms (mobile + desktop)
UPDATE menu_visibility SET available_on = 'both' WHERE menu_id IN (
  'direct-messages',
  'team-communication',
  'photo-gallery',
  'my-requests',
  'sales-resources',
  'team'
);

-- ============================================
-- 3. Add yard role to relevant menu items
-- ============================================

-- Add yard role to items that should be visible to yard workers
UPDATE menu_visibility
SET visible_for_roles = array_append(visible_for_roles, 'yard')
WHERE menu_id IN ('direct-messages', 'team-communication', 'team')
  AND NOT ('yard' = ANY(visible_for_roles));

-- ============================================
-- 4. Add My To-Dos menu item
-- ============================================
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, available_on) VALUES
  ('my-todos', 'My To-Dos', '{"sales","operations","sales-manager","admin","yard"}', 'both')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  available_on = EXCLUDED.available_on,
  updated_at = NOW();

-- ============================================
-- 5. Split BOM Hub into granular sections
-- ============================================

-- Remove old bom-calculator entry if exists (we'll replace with granular items)
-- Keep the user overrides by not deleting, just update

-- BOM Calculator (desktop only) - SKU Catalog, Calculator, Projects, SKU Builder, Component Config
UPDATE menu_visibility
SET menu_name = 'BOM Calculator',
    available_on = 'desktop'
WHERE menu_id = 'bom-calculator';

-- If bom-calculator doesn't exist, create it
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, available_on) VALUES
  ('bom-calculator', 'BOM Calculator', '{"operations","admin"}', 'desktop')
ON CONFLICT (menu_id) DO NOTHING;

-- BOM Yard Operations (both platforms) - Pick Lists, Spots, Areas, Mobile View
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, available_on) VALUES
  ('bom-yard', 'Yard Operations', '{"operations","admin","yard"}', 'both')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  available_on = EXCLUDED.available_on,
  updated_at = NOW();

-- BOM Analytics (desktop only)
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, available_on) VALUES
  ('bom-admin', 'BOM Analytics', '{"operations","admin"}', 'desktop')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  available_on = EXCLUDED.available_on,
  updated_at = NOW();

-- ============================================
-- 6. Ensure all roles arrays include yard where appropriate
-- ============================================

-- Photo Gallery - add yard for potential future mobile access
-- (keeping desktop for now, but yard workers might need to view job photos)

-- ============================================
-- Summary of menu items after migration:
-- ============================================
-- desktop: dashboard, presentation, sales-coach, stain-calculator,
--          analytics, leadership, bom-calculator, bom-admin
-- both: direct-messages, team-communication, photo-gallery,
--       my-requests, sales-resources, team, my-todos, bom-yard
-- mobile: (none currently, but structure supports it)
