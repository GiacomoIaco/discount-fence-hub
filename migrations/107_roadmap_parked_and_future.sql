-- ============================================
-- Migration 107: Add parked status and future hub
-- ============================================
-- Adds 'parked' status for ideas to revisit later
-- Adds 'future' hub for long-term vision items
-- Adds 'XS' complexity for tiny changes

-- ============================================
-- 1. UPDATE STATUS CONSTRAINT
-- ============================================

ALTER TABLE roadmap_items
DROP CONSTRAINT IF EXISTS roadmap_items_status_check;

ALTER TABLE roadmap_items
ADD CONSTRAINT roadmap_items_status_check
CHECK (status IN ('idea', 'researched', 'approved', 'in_progress', 'done', 'wont_do', 'parked'));

-- ============================================
-- 2. UPDATE HUB CONSTRAINT
-- ============================================

ALTER TABLE roadmap_items
DROP CONSTRAINT IF EXISTS roadmap_items_hub_check;

ALTER TABLE roadmap_items
ADD CONSTRAINT roadmap_items_hub_check
CHECK (hub IN ('ops-hub', 'requests', 'chat', 'analytics', 'settings', 'general', 'leadership', 'future'));

-- ============================================
-- 3. UPDATE COMPLEXITY CONSTRAINT
-- ============================================

ALTER TABLE roadmap_items
DROP CONSTRAINT IF EXISTS roadmap_items_complexity_check;

ALTER TABLE roadmap_items
ADD CONSTRAINT roadmap_items_complexity_check
CHECK (complexity IN ('XS', 'S', 'M', 'L', 'XL'));

-- ============================================
-- 4. ADD SEQUENCE FOR FUTURE HUB
-- ============================================

CREATE SEQUENCE IF NOT EXISTS roadmap_seq_future START 1;

-- ============================================
-- 5. UPDATE CODE GENERATION FUNCTION
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
-- 6. ALLOW ALL USERS TO INSERT IDEAS
-- ============================================
-- Non-admins can submit ideas, but only admins can change status

DROP POLICY IF EXISTS roadmap_insert_policy ON roadmap_items;
CREATE POLICY roadmap_insert_policy ON roadmap_items
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Non-admins can only update their own items' title and raw_idea
DROP POLICY IF EXISTS roadmap_update_policy ON roadmap_items;
CREATE POLICY roadmap_update_policy ON roadmap_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    OR created_by = auth.uid()
  );
