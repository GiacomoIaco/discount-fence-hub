-- Add Client Hub to menu_visibility

INSERT INTO menu_visibility (
  menu_id,
  menu_name,
  visible_for_roles,
  available_on,
  show_on_desktop,
  show_on_tablet,
  show_on_mobile,
  category,
  sort_order,
  mobile_style
) VALUES (
  'client-hub',
  'Client Hub',
  ARRAY['admin', 'operations', 'sales-manager'],
  'both',
  true,
  true,
  true,
  'admin',
  35,
  '{"gradient": "from-blue-600 to-indigo-600", "iconBg": "bg-white/20", "iconColor": "text-white", "description": "Clients, communities & pricing"}'::jsonb
)
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  available_on = EXCLUDED.available_on,
  show_on_desktop = EXCLUDED.show_on_desktop,
  show_on_tablet = EXCLUDED.show_on_tablet,
  show_on_mobile = EXCLUDED.show_on_mobile,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  mobile_style = EXCLUDED.mobile_style,
  updated_at = NOW();
