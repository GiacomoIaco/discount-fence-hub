-- ============================================
-- Migration 106: Roadmap Hub Setup
-- ============================================
-- 1. Add 'future' hub option to roadmap_items
-- 2. Add roadmap menu item
-- 3. Create sequence for future hub

-- ============================================
-- 1. Update hub constraint to allow 'future'
-- ============================================

ALTER TABLE roadmap_items DROP CONSTRAINT IF EXISTS roadmap_items_hub_check;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_hub_check
  CHECK (hub IN ('ops-hub', 'requests', 'chat', 'analytics', 'settings', 'general', 'leadership', 'future'));

-- ============================================
-- 2. Create sequence for future hub
-- ============================================

CREATE SEQUENCE IF NOT EXISTS roadmap_seq_future START 1;

-- ============================================
-- 3. Update generate_roadmap_code function
-- ============================================

CREATE OR REPLACE FUNCTION generate_roadmap_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix CHAR(1);
  next_num INTEGER;
BEGIN
  -- Map hub to prefix
  prefix := CASE NEW.hub
    WHEN 'ops-hub' THEN 'O'
    WHEN 'requests' THEN 'R'
    WHEN 'chat' THEN 'C'
    WHEN 'analytics' THEN 'A'
    WHEN 'settings' THEN 'S'
    WHEN 'general' THEN 'G'
    WHEN 'leadership' THEN 'L'
    WHEN 'future' THEN 'F'
    ELSE 'X'
  END;

  -- Get next sequence number for this hub
  EXECUTE format('SELECT nextval(''roadmap_seq_%s'')',
    CASE NEW.hub
      WHEN 'ops-hub' THEN 'ops'
      ELSE NEW.hub
    END
  ) INTO next_num;

  -- Generate code: prefix + padded number (e.g., O-001)
  NEW.code := prefix || '-' || LPAD(next_num::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Add roadmap to menu_visibility
-- ============================================

INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles, show_on_desktop, show_on_tablet, show_on_mobile)
VALUES ('roadmap', 'Roadmap', ARRAY['admin'], true, false, false)
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  show_on_desktop = EXCLUDED.show_on_desktop;

-- ============================================
-- 5. Add sample future hub item
-- ============================================

INSERT INTO roadmap_items (code, hub, title, raw_idea, status, importance, complexity) VALUES
('F-001', 'future', 'Customer Portal', 'Self-service portal for customers to view invoices, schedule appointments, track project status, and communicate with their sales rep', 'idea', 3, 'XL');
