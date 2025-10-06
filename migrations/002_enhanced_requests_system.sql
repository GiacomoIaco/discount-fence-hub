-- Enhanced Request Management System
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. DROP EXISTING IF NEEDED (careful!)
-- ============================================
-- Uncomment if you need to start fresh:
-- DROP TABLE IF EXISTS request_activity_log CASCADE;
-- DROP TABLE IF EXISTS request_notes CASCADE;
-- DROP TABLE IF EXISTS request_assignment_rules CASCADE;
-- DROP TABLE IF EXISTS request_sla_defaults CASCADE;

-- ============================================
-- 2. UPDATE REQUESTS TABLE
-- ============================================

-- Add new columns to existing requests table
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS project_number TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS expected_value DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'pending', 'completed', 'archived')),
  ADD COLUMN IF NOT EXISTS quote_status TEXT CHECK (quote_status IN ('won', 'lost', 'awaiting')),
  ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_target_hours INTEGER,
  ADD COLUMN IF NOT EXISTS sla_status TEXT CHECK (sla_status IN ('on_track', 'at_risk', 'breached')),
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitter_id UUID REFERENCES auth.users(id);

-- Convert request_type from ENUM to TEXT type to allow new values
-- Step 1: Create a temporary column with TEXT type
ALTER TABLE requests ADD COLUMN IF NOT EXISTS request_type_new TEXT;

-- Step 2: Copy data from enum column to text column, mapping old values to new
UPDATE requests SET request_type_new =
  CASE request_type::text
    WHEN 'custom_pricing' THEN 'pricing'
    WHEN 'builder_community' THEN 'new_builder'
    WHEN 'installation_issue' THEN 'warranty'
    WHEN 'material_request' THEN 'material'
    WHEN 'customer_escalation' THEN 'support'
    ELSE 'other'
  END;

-- Step 3: Drop the old enum column
ALTER TABLE requests DROP COLUMN IF EXISTS request_type;

-- Step 4: Rename new column to request_type
ALTER TABLE requests RENAME COLUMN request_type_new TO request_type;

-- Step 5: Set NOT NULL constraint
ALTER TABLE requests ALTER COLUMN request_type SET NOT NULL;

-- Step 6: Add check constraint for valid values
ALTER TABLE requests
  ADD CONSTRAINT requests_request_type_check
  CHECK (request_type IN ('pricing', 'material', 'support', 'new_builder', 'warranty', 'other'));

-- Migrate old 'status' enum to new 'stage' TEXT column
-- The old status enum has: 'pending', 'in_progress', 'completed', 'cancelled'
-- New stage uses: 'new', 'pending', 'completed', 'archived'
-- Note: 'stage' column was already added above with default 'new'
UPDATE requests SET stage =
  CASE status::text
    WHEN 'pending' THEN 'new'
    WHEN 'in_progress' THEN 'pending'
    WHEN 'completed' THEN 'completed'
    WHEN 'cancelled' THEN 'archived'
    ELSE 'new'
  END;

-- Drop old status column
ALTER TABLE requests DROP COLUMN IF EXISTS status;

-- Migrate rep_id to submitter_id
-- Copy data from rep_id to submitter_id for existing requests
UPDATE requests SET submitter_id = rep_id WHERE submitter_id IS NULL;

-- Drop old rep_id column (it referenced sales_reps, but we're now using auth.users)
ALTER TABLE requests DROP COLUMN IF EXISTS rep_id;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_stage ON requests(stage);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_submitter_id ON requests(submitter_id);
CREATE INDEX IF NOT EXISTS idx_requests_type_stage ON requests(request_type, stage);
CREATE INDEX IF NOT EXISTS idx_requests_sla_status ON requests(sla_status);
CREATE INDEX IF NOT EXISTS idx_requests_created_desc ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority_score DESC);

-- ============================================
-- 3. REQUEST NOTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  note_type TEXT DEFAULT 'comment' CHECK (note_type IN ('comment', 'internal', 'status_change')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_notes_request_id ON request_notes(request_id);
CREATE INDEX IF NOT EXISTS idx_request_notes_created ON request_notes(created_at DESC);

-- ============================================
-- 4. REQUEST ACTIVITY LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'created', 'assigned', 'status_changed', 'quoted', 'message_added'
  details JSONB, -- { "from": "new", "to": "pending", "assignee": "John Doe" }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_activity_request_id ON request_activity_log(request_id);
CREATE INDEX IF NOT EXISTS idx_request_activity_created ON request_activity_log(created_at DESC);

-- ============================================
-- 5. REQUEST ASSIGNMENT RULES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL CHECK (request_type IN ('pricing', 'material', 'support', 'new_builder', 'warranty', 'other')),
  assignee_id UUID NOT NULL REFERENCES auth.users(id),
  priority INTEGER DEFAULT 0, -- higher = preferred assignee
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_rules_type ON request_assignment_rules(request_type);
CREATE INDEX IF NOT EXISTS idx_assignment_rules_active ON request_assignment_rules(is_active) WHERE is_active = true;

-- ============================================
-- 6. REQUEST SLA DEFAULTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS request_sla_defaults (
  request_type TEXT PRIMARY KEY CHECK (request_type IN ('pricing', 'material', 'support', 'new_builder', 'warranty', 'other')),
  target_hours INTEGER NOT NULL,
  urgent_target_hours INTEGER, -- Override for urgent requests
  critical_target_hours INTEGER, -- Override for critical
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default SLA targets
INSERT INTO request_sla_defaults (request_type, target_hours, urgent_target_hours, critical_target_hours) VALUES
  ('pricing', 24, 8, 4),
  ('material', 24, 12, 6),
  ('support', 8, 4, 2),
  ('new_builder', 48, 24, 12),
  ('warranty', 12, 6, 3),
  ('other', 24, 12, 6)
ON CONFLICT (request_type) DO NOTHING;

-- ============================================
-- 7. FUNCTIONS & TRIGGERS
-- ============================================

-- Function to calculate request age in hours
CREATE OR REPLACE FUNCTION request_age_hours(request_id UUID)
RETURNS DECIMAL AS $$
  SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600
  FROM requests
  WHERE id = request_id;
$$ LANGUAGE SQL STABLE;

-- Function to auto-calculate SLA status
CREATE OR REPLACE FUNCTION update_sla_status()
RETURNS TRIGGER AS $$
DECLARE
  target_hours INTEGER;
BEGIN
  -- Get SLA target based on request type and urgency
  SELECT
    CASE
      WHEN NEW.urgency = 'critical' THEN rsd.critical_target_hours
      WHEN NEW.urgency = 'high' THEN rsd.urgent_target_hours
      ELSE rsd.target_hours
    END INTO target_hours
  FROM request_sla_defaults rsd
  WHERE rsd.request_type = NEW.request_type;

  -- Set SLA target hours
  NEW.sla_target_hours := COALESCE(target_hours, 24);

  -- Calculate SLA status
  IF NEW.stage IN ('completed', 'archived') THEN
    -- Completed requests: check if completed within SLA
    IF NEW.completed_at IS NOT NULL AND
       EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at)) / 3600 <= NEW.sla_target_hours THEN
      NEW.sla_status := 'on_track';
    ELSE
      NEW.sla_status := 'breached';
    END IF;
  ELSE
    -- Active requests: check current age
    DECLARE
      age_hours DECIMAL;
    BEGIN
      age_hours := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 3600;

      IF age_hours > NEW.sla_target_hours THEN
        NEW.sla_status := 'breached';
      ELSIF age_hours > (NEW.sla_target_hours * 0.75) THEN
        NEW.sla_status := 'at_risk';
      ELSE
        NEW.sla_status := 'on_track';
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for SLA status
DROP TRIGGER IF EXISTS trigger_update_sla_status ON requests;
CREATE TRIGGER trigger_update_sla_status
  BEFORE INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION update_sla_status();

-- Function to calculate priority score
CREATE OR REPLACE FUNCTION calculate_priority_score()
RETURNS TRIGGER AS $$
DECLARE
  urgency_points INTEGER;
  value_points INTEGER;
  age_points INTEGER;
  age_hours DECIMAL;
BEGIN
  -- Urgency points (0-40)
  urgency_points := CASE NEW.urgency
    WHEN 'critical' THEN 40
    WHEN 'high' THEN 30
    WHEN 'medium' THEN 20
    ELSE 10
  END;

  -- Value points (0-30)
  value_points := CASE
    WHEN NEW.expected_value IS NULL THEN 0
    WHEN NEW.expected_value >= 50000 THEN 30
    WHEN NEW.expected_value >= 20000 THEN 25
    WHEN NEW.expected_value >= 10000 THEN 20
    WHEN NEW.expected_value >= 5000 THEN 15
    ELSE 10
  END;

  -- Age points (0-30)
  age_hours := EXTRACT(EPOCH FROM (NOW() - NEW.created_at)) / 3600;
  age_points := CASE
    WHEN age_hours > 72 THEN 30
    WHEN age_hours > 48 THEN 25
    WHEN age_hours > 24 THEN 20
    WHEN age_hours > 12 THEN 15
    WHEN age_hours > 6 THEN 10
    ELSE 5
  END;

  NEW.priority_score := urgency_points + value_points + age_points;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for priority score
DROP TRIGGER IF EXISTS trigger_calculate_priority_score ON requests;
CREATE TRIGGER trigger_calculate_priority_score
  BEFORE INSERT OR UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION calculate_priority_score();

-- Function to log activity
CREATE OR REPLACE FUNCTION log_request_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO request_activity_log (request_id, user_id, action, details)
    VALUES (
      NEW.id,
      COALESCE(NEW.assigned_to, NEW.submitter_id),
      'status_changed',
      jsonb_build_object(
        'from', OLD.stage,
        'to', NEW.stage
      )
    );
  END IF;

  -- Log assignments
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO request_activity_log (request_id, user_id, action, details)
    VALUES (
      NEW.id,
      NEW.assigned_to,
      'assigned',
      jsonb_build_object(
        'assignee_id', NEW.assigned_to
      )
    );

    -- Set first_response_at if not already set
    IF OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL AND NEW.first_response_at IS NULL THEN
      NEW.first_response_at := NOW();
    END IF;
  END IF;

  -- Log completion
  IF TG_OP = 'UPDATE' AND OLD.stage != 'completed' AND NEW.stage = 'completed' THEN
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS trigger_log_request_activity ON requests;
CREATE TRIGGER trigger_log_request_activity
  BEFORE UPDATE ON requests
  FOR EACH ROW
  EXECUTE FUNCTION log_request_activity();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_assignment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_sla_defaults ENABLE ROW LEVEL SECURITY;

-- Requests policies
DROP POLICY IF EXISTS "Users can view their own requests" ON requests;
CREATE POLICY "Users can view their own requests"
  ON requests FOR SELECT
  TO authenticated
  USING (submitter_id = auth.uid());

DROP POLICY IF EXISTS "Operations can view all requests" ON requests;
CREATE POLICY "Operations can view all requests"
  ON requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('operations', 'sales-manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can create requests" ON requests;
CREATE POLICY "Users can create requests"
  ON requests FOR INSERT
  TO authenticated
  WITH CHECK (submitter_id = auth.uid());

DROP POLICY IF EXISTS "Operations can update requests" ON requests;
CREATE POLICY "Operations can update requests"
  ON requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('operations', 'sales-manager', 'admin')
    )
  );

-- Request notes policies
DROP POLICY IF EXISTS "Users can view notes on their requests" ON request_notes;
CREATE POLICY "Users can view notes on their requests"
  ON request_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_notes.request_id
      AND (requests.submitter_id = auth.uid() OR requests.assigned_to = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('operations', 'sales-manager', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can create notes" ON request_notes;
CREATE POLICY "Users can create notes"
  ON request_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Activity log policies (read-only for users)
DROP POLICY IF EXISTS "Users can view activity on their requests" ON request_activity_log;
CREATE POLICY "Users can view activity on their requests"
  ON request_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM requests
      WHERE requests.id = request_activity_log.request_id
      AND (requests.submitter_id = auth.uid() OR requests.assigned_to = auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('operations', 'sales-manager', 'admin')
    )
  );

-- Assignment rules (admin only)
DROP POLICY IF EXISTS "Admins can manage assignment rules" ON request_assignment_rules;
CREATE POLICY "Admins can manage assignment rules"
  ON request_assignment_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "All can view assignment rules" ON request_assignment_rules;
CREATE POLICY "All can view assignment rules"
  ON request_assignment_rules FOR SELECT
  TO authenticated
  USING (true);

-- SLA defaults (admin only to modify, all can read)
DROP POLICY IF EXISTS "Admins can manage SLA defaults" ON request_sla_defaults;
CREATE POLICY "Admins can manage SLA defaults"
  ON request_sla_defaults FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "All can view SLA defaults" ON request_sla_defaults;
CREATE POLICY "All can view SLA defaults"
  ON request_sla_defaults FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 9. HELPER VIEWS
-- ============================================

-- View for request summaries with age and assignee info
CREATE OR REPLACE VIEW request_summary AS
SELECT
  r.*,
  EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 AS age_hours,
  EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400 AS age_days,
  up_submitter.full_name AS submitter_name,
  up_assigned.full_name AS assignee_name,
  CASE
    WHEN r.sla_status = 'breached' THEN 'red'
    WHEN r.sla_status = 'at_risk' THEN 'yellow'
    ELSE 'green'
  END AS sla_color
FROM requests r
LEFT JOIN user_profiles up_submitter ON r.submitter_id = up_submitter.id
LEFT JOIN user_profiles up_assigned ON r.assigned_to = up_assigned.id;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Enhanced Request Management System installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'New features:';
  RAISE NOTICE '• SLA tracking with auto-calculated breach detection';
  RAISE NOTICE '• Priority scoring based on urgency, value, and age';
  RAISE NOTICE '• Assignment rules for auto-routing';
  RAISE NOTICE '• Activity logging for audit trail';
  RAISE NOTICE '• Request notes for communication';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created: request_notes, request_activity_log, request_assignment_rules, request_sla_defaults';
  RAISE NOTICE 'View created: request_summary';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update frontend to use new schema';
  RAISE NOTICE '2. Migrate data from localStorage';
  RAISE NOTICE '3. Configure assignment rules in UI';
END $$;
