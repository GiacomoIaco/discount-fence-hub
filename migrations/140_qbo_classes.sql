-- Migration 140: QBO Classes Sync
-- Part of O-028: Client Hub Enhancement - QBO Classes Integration
-- Purpose: Store synced QBO Classes for P&L tracking and allow selecting which appear in dropdowns

-- Create qbo_classes table to store synced classes
CREATE TABLE IF NOT EXISTS qbo_classes (
  id VARCHAR(50) PRIMARY KEY,           -- QBO Class ID (string from API)
  name VARCHAR(255) NOT NULL,
  fully_qualified_name VARCHAR(500),    -- For sub-classes (e.g., "Residential:Austin")
  parent_id VARCHAR(50),                -- Parent class ID for hierarchy
  is_active BOOLEAN DEFAULT true,       -- From QBO sync
  is_selectable BOOLEAN DEFAULT true,   -- User can toggle which appear in dropdowns
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_qbo_classes_active ON qbo_classes(is_active);
CREATE INDEX IF NOT EXISTS idx_qbo_classes_selectable ON qbo_classes(is_selectable);
CREATE INDEX IF NOT EXISTS idx_qbo_classes_parent ON qbo_classes(parent_id);

-- Add default_qbo_class_id to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_qbo_class_id VARCHAR(50);

-- Add quickbooks_id and override_qbo_class_id to communities table
ALTER TABLE communities ADD COLUMN IF NOT EXISTS quickbooks_id VARCHAR(50);
ALTER TABLE communities ADD COLUMN IF NOT EXISTS override_qbo_class_id VARCHAR(50);

-- Enable RLS
ALTER TABLE qbo_classes ENABLE ROW LEVEL SECURITY;

-- RLS policies for qbo_classes
-- Everyone can read classes
DROP POLICY IF EXISTS "Anyone can view qbo_classes" ON qbo_classes;
CREATE POLICY "Anyone can view qbo_classes" ON qbo_classes
  FOR SELECT USING (true);

-- Only service role can insert/update (from sync function)
DROP POLICY IF EXISTS "Service role can manage qbo_classes" ON qbo_classes;
CREATE POLICY "Service role can manage qbo_classes" ON qbo_classes
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can update is_selectable flag
DROP POLICY IF EXISTS "Users can update selectable flag" ON qbo_classes;
CREATE POLICY "Users can update selectable flag" ON qbo_classes
  FOR UPDATE USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Comment for documentation
COMMENT ON TABLE qbo_classes IS 'Synced QBO Classes for P&L tracking. Users can toggle is_selectable to control dropdown visibility.';
COMMENT ON COLUMN qbo_classes.is_selectable IS 'When false, this class will not appear in client/community selection dropdowns';
COMMENT ON COLUMN clients.default_qbo_class_id IS 'Default QBO Class for this client - used for invoicing/P&L tracking';
COMMENT ON COLUMN communities.override_qbo_class_id IS 'Override QBO Class for this community - if set, overrides client default';
