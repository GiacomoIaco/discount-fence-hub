-- Add Survey Hub to menu items
INSERT INTO menu_items (menu_id, name, icon, category, sort_order, show_on_mobile, show_on_tablet, show_on_desktop, allowed_roles)
VALUES ('survey-hub', 'Survey Hub', 'ClipboardList', 'hubs', 100, false, true, true, ARRAY['admin', 'operations', 'sales-manager'])
ON CONFLICT (menu_id) DO NOTHING;
