-- ============================================
-- Migration 154: Sidebar Restructure - New Menu Items
-- ============================================
-- Adds new menu items for the sidebar restructure:
-- - Schedule (FSM calendar)
-- - Projects Hub (requests, quotes, jobs, invoices)
-- - Sales Hub (consolidates sales tools)
-- Updates sort_order for new navigation layout

-- 1. Add Schedule menu item
INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile,
  category,
  sort_order,
  mobile_style
) VALUES (
  'schedule',
  'Schedule',
  '{"sales","operations","sales-manager","admin"}',
  true,
  true,
  true,
  'fsm',
  5,  -- After dashboard (1), before clients
  '{
    "bgColor": "bg-white border-2 border-blue-200",
    "iconBg": "bg-blue-100",
    "iconColor": "text-blue-600",
    "description": "View schedule & calendar"
  }'::jsonb
)
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  show_on_desktop = EXCLUDED.show_on_desktop,
  show_on_tablet = EXCLUDED.show_on_tablet,
  show_on_mobile = EXCLUDED.show_on_mobile,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  mobile_style = EXCLUDED.mobile_style,
  updated_at = NOW();

-- 2. Add Projects Hub menu item
INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile,
  category,
  sort_order,
  mobile_style
) VALUES (
  'projects-hub',
  'Projects',
  '{"sales","operations","sales-manager","admin"}',
  true,
  true,
  true,
  'fsm',
  8,  -- After clients (7), before ops hub
  '{
    "bgColor": "bg-white border-2 border-indigo-200",
    "iconBg": "bg-indigo-100",
    "iconColor": "text-indigo-600",
    "description": "Requests, quotes, jobs & invoices"
  }'::jsonb
)
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  show_on_desktop = EXCLUDED.show_on_desktop,
  show_on_tablet = EXCLUDED.show_on_tablet,
  show_on_mobile = EXCLUDED.show_on_mobile,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  mobile_style = EXCLUDED.mobile_style,
  updated_at = NOW();

-- 3. Add Sales Hub menu item
INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile,
  category,
  sort_order,
  mobile_style
) VALUES (
  'sales-hub',
  'Sales',
  '{"sales","operations","sales-manager","admin"}',
  true,
  true,
  true,
  'sales',
  30,  -- After ops hub section
  '{
    "bgColor": "bg-white border-2 border-amber-200",
    "iconBg": "bg-amber-100",
    "iconColor": "text-amber-600",
    "description": "Sales tools & resources"
  }'::jsonb
)
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  show_on_desktop = EXCLUDED.show_on_desktop,
  show_on_tablet = EXCLUDED.show_on_tablet,
  show_on_mobile = EXCLUDED.show_on_mobile,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  mobile_style = EXCLUDED.mobile_style,
  updated_at = NOW();

-- 4. Update Client Hub sort order to appear in FSM section
UPDATE menu_visibility
SET sort_order = 7, category = 'fsm'
WHERE menu_id = 'client-hub';

-- 5. Hide legacy standalone sales tools from desktop sidebar
-- (they're now accessible via Sales Hub)
UPDATE menu_visibility
SET show_on_desktop = false
WHERE menu_id IN ('presentation', 'sales-coach', 'photo-gallery', 'stain-calculator', 'sales-resources');

-- 6. Keep Requests visible on desktop (under Ops Hub V2)
-- Update sort_order to place it after bom-calculator-v2
UPDATE menu_visibility
SET sort_order = 16
WHERE menu_id = 'requests';
