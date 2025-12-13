-- ============================================
-- Migration 152: Add Ops Hub V2 to Menu Visibility
-- ============================================
-- Adds the V2 Calculator Hub to the sidebar menu
-- Desktop only, operations/admin roles

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
  'bom-calculator-v2',
  'Ops Hub V2',
  '{"operations","admin"}',
  true,   -- Desktop: yes (complex UI for configuration)
  false,  -- Tablet: no
  false,  -- Mobile: no
  'operations',
  15,     -- Between bom-calculator (10) and bom-yard (20)
  '{
    "bgColor": "bg-white border-2 border-purple-200",
    "iconBg": "bg-purple-100",
    "iconColor": "text-purple-600",
    "description": "V2 formula-based calculator"
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
