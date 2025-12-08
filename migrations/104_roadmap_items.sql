-- ============================================
-- Migration 104: Roadmap Items Table
-- ============================================
-- Simple idea/feature tracking system with hub-prefixed codes
-- Allows Claude to read/write and maintain during sessions

-- ============================================
-- 1. ROADMAP ITEMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS roadmap_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Hub-prefixed code (auto-generated via trigger)
  code VARCHAR(10) NOT NULL UNIQUE,

  -- Hub/section prefix
  hub VARCHAR(20) NOT NULL CHECK (hub IN ('ops-hub', 'requests', 'chat', 'analytics', 'settings', 'general', 'leadership')),

  -- Core content
  title VARCHAR(200) NOT NULL,
  raw_idea TEXT, -- User's quick brain dump
  claude_analysis TEXT, -- Claude's expanded thoughts, best practices

  -- Status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'researched', 'approved', 'in_progress', 'done', 'wont_do')),

  -- Scoring
  importance INTEGER CHECK (importance BETWEEN 1 AND 5), -- 1=low, 5=critical
  complexity VARCHAR(5) CHECK (complexity IN ('S', 'M', 'L', 'XL')), -- T-shirt sizing

  -- Metadata
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Session tracking
  session_notes TEXT, -- What was actually built
  commit_refs TEXT[], -- Related commit hashes
  related_items TEXT[] -- Related item codes (e.g., ['O-012', 'S-003'])
);

-- ============================================
-- 2. SEQUENCE FOR EACH HUB PREFIX
-- ============================================

CREATE SEQUENCE IF NOT EXISTS roadmap_seq_ops START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_requests START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_chat START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_analytics START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_settings START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_general START 1;
CREATE SEQUENCE IF NOT EXISTS roadmap_seq_leadership START 1;

-- ============================================
-- 3. FUNCTION TO GENERATE HUB-PREFIXED CODE
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
-- 4. TRIGGER FOR AUTO CODE GENERATION
-- ============================================

DROP TRIGGER IF EXISTS trg_roadmap_code ON roadmap_items;
CREATE TRIGGER trg_roadmap_code
  BEFORE INSERT ON roadmap_items
  FOR EACH ROW
  WHEN (NEW.code IS NULL OR NEW.code = '')
  EXECUTE FUNCTION generate_roadmap_code();

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_roadmap_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roadmap_timestamp ON roadmap_items;
CREATE TRIGGER trg_roadmap_timestamp
  BEFORE UPDATE ON roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION update_roadmap_timestamp();

-- ============================================
-- 6. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_roadmap_hub ON roadmap_items(hub);
CREATE INDEX IF NOT EXISTS idx_roadmap_status ON roadmap_items(status);
CREATE INDEX IF NOT EXISTS idx_roadmap_code ON roadmap_items(code);

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY roadmap_select_policy ON roadmap_items
  FOR SELECT USING (true);

-- Only admins can insert/update/delete
CREATE POLICY roadmap_insert_policy ON roadmap_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY roadmap_update_policy ON roadmap_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY roadmap_delete_policy ON roadmap_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 8. COMMENTS
-- ============================================

COMMENT ON TABLE roadmap_items IS 'Feature ideas and roadmap tracking with hub-prefixed codes';
COMMENT ON COLUMN roadmap_items.code IS 'Auto-generated hub-prefixed code (e.g., O-001 for ops-hub)';
COMMENT ON COLUMN roadmap_items.raw_idea IS 'Quick brain dump from user';
COMMENT ON COLUMN roadmap_items.claude_analysis IS 'Expanded analysis with best practices from Claude';
COMMENT ON COLUMN roadmap_items.importance IS '1=nice-to-have, 5=critical business need';
COMMENT ON COLUMN roadmap_items.complexity IS 'S=hours, M=day, L=days, XL=week+';
