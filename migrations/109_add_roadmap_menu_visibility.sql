-- ============================================
-- Migration 109: Add roadmap to menu_visibility
-- ============================================
-- Roadmap was added to the app but never inserted into menu_visibility table

-- Insert roadmap if it doesn't exist
INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  available_on,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile,
  supported_on_desktop,
  supported_on_tablet,
  supported_on_mobile,
  category,
  sort_order,
  mobile_style
) VALUES (
  'roadmap',
  'Roadmap',
  ARRAY['sales', 'operations', 'yard', 'sales-manager', 'admin'],
  'both',
  true,
  true,
  true,
  true,
  true,
  true,
  'tools',
  30,
  '{
    "gradient": "from-indigo-600 to-purple-600",
    "iconBg": "bg-white/20",
    "description": "Feature ideas & development roadmap"
  }'::jsonb
) ON CONFLICT (menu_id) DO UPDATE SET
  category = 'tools',
  sort_order = 30,
  mobile_style = '{
    "gradient": "from-indigo-600 to-purple-600",
    "iconBg": "bg-white/20",
    "description": "Feature ideas & development roadmap"
  }'::jsonb;

-- Also ensure bom-yard has option to use non-gradient style
-- Clear the gradient and use solid style instead
UPDATE menu_visibility
SET mobile_style = '{
  "bgColor": "bg-white border-2 border-amber-200",
  "iconBg": "bg-amber-100",
  "iconColor": "text-amber-600",
  "description": "Manage pick lists & staging",
  "textColor": "text-gray-900",
  "subtextColor": "text-gray-600"
}'::jsonb
WHERE menu_id = 'bom-yard';
