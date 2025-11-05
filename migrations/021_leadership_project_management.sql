-- ============================================
-- LEADERSHIP PROJECT MANAGEMENT SYSTEM
-- Created: 2025-11-05
-- Purpose: Project/initiative tracking for leadership team with weekly updates and automated email summaries
-- Features: Functions → Buckets → Initiatives with status tracking, priorities, and weekly check-ins
-- ============================================

-- ============================================
-- SCHEMA: CORE TABLES
-- ============================================

-- Project Settings: Email schedule and system configuration
CREATE TABLE project_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Functions: Top-level organizational functions (Operations, Finance, etc.)
CREATE TABLE project_functions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- lucide-react icon name
  color TEXT DEFAULT 'blue', -- UI color theme
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Function Access: User permissions per function
CREATE TABLE project_function_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'lead', 'member', 'viewer')),
  granted_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(function_id, user_id)
);

-- Project Buckets: Responsibility areas within functions
CREATE TABLE project_buckets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Initiatives: Core work items with ownership and tracking
CREATE TABLE project_initiatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bucket_id UUID NOT NULL REFERENCES project_buckets(id) ON DELETE CASCADE,

  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  success_criteria TEXT,

  -- Ownership and status
  assigned_to UUID REFERENCES user_profiles(id),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'active', 'on_hold', 'at_risk', 'cancelled', 'completed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),

  -- Target date (flexible format)
  target_type TEXT CHECK (target_type IN ('date', 'week', 'quarter', 'ongoing')),
  target_date DATE,
  target_week TEXT, -- Format: "Week of YYYY-MM-DD"
  target_quarter TEXT, -- Format: "Q1 2025"

  -- Progress tracking
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),

  -- Calculated color status (set by trigger)
  color_status TEXT DEFAULT 'green' CHECK (color_status IN ('green', 'yellow', 'red')),

  -- Audit
  created_by UUID REFERENCES user_profiles(id),
  archived_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Weekly Updates: Check-ins for each initiative
CREATE TABLE project_weekly_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),

  week_start_date DATE NOT NULL, -- Monday of the week

  -- Update content
  plan TEXT, -- What I plan to accomplish
  accomplished TEXT, -- What was accomplished
  notes TEXT,

  -- Status at time of update
  status_snapshot TEXT,
  progress_snapshot INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(initiative_id, week_start_date)
);

-- Project Activity: Audit log for all changes
CREATE TABLE project_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),

  action TEXT NOT NULL, -- 'created', 'updated', 'status_changed', 'assigned', etc.
  changes JSONB, -- Detailed change log

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project Comments: Discussion on initiatives (Phase 3)
CREATE TABLE project_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),

  content TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FUNCTIONS: COLOR STATUS CALCULATION
-- ============================================

-- Function to calculate color status based on target and status
CREATE OR REPLACE FUNCTION calculate_initiative_color_status(
  p_status TEXT,
  p_target_type TEXT,
  p_target_date DATE,
  p_target_week TEXT,
  p_target_quarter TEXT,
  p_updated_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  target_date_actual DATE;
  days_until_target INTEGER;
  weeks_since_update INTEGER;
BEGIN
  -- Completed initiatives are always green
  IF p_status = 'completed' THEN
    RETURN 'green';
  END IF;

  -- At risk or cancelled are always red
  IF p_status IN ('at_risk', 'cancelled') THEN
    RETURN 'red';
  END IF;

  -- On hold is yellow
  IF p_status = 'on_hold' THEN
    RETURN 'yellow';
  END IF;

  -- Ongoing initiatives: check for staleness
  IF p_target_type = 'ongoing' OR p_target_type IS NULL THEN
    weeks_since_update := EXTRACT(EPOCH FROM (NOW() - p_updated_at)) / 604800;
    IF weeks_since_update > 2 THEN
      RETURN 'yellow'; -- No update in 2+ weeks
    END IF;
    RETURN 'green';
  END IF;

  -- Calculate actual target date based on type
  IF p_target_type = 'date' THEN
    target_date_actual := p_target_date;
  ELSIF p_target_type = 'week' AND p_target_week IS NOT NULL THEN
    -- Extract date from "Week of YYYY-MM-DD" format
    target_date_actual := SUBSTRING(p_target_week FROM '\d{4}-\d{2}-\d{2}')::DATE;
  ELSIF p_target_type = 'quarter' AND p_target_quarter IS NOT NULL THEN
    -- Extract year and quarter, calculate end of quarter
    DECLARE
      quarter_year INTEGER;
      quarter_num INTEGER;
    BEGIN
      quarter_year := SUBSTRING(p_target_quarter FROM '\d{4}')::INTEGER;
      quarter_num := SUBSTRING(p_target_quarter FROM 'Q(\d)')::INTEGER;
      target_date_actual := DATE(quarter_year || '-' || (quarter_num * 3) || '-' || '01') + INTERVAL '3 months' - INTERVAL '1 day';
    END;
  END IF;

  -- Calculate days until target
  IF target_date_actual IS NOT NULL THEN
    days_until_target := target_date_actual - CURRENT_DATE;

    -- Red: Past due
    IF days_until_target < 0 THEN
      RETURN 'red';
    END IF;

    -- Yellow: Within 14 days
    IF days_until_target <= 14 THEN
      RETURN 'yellow';
    END IF;
  END IF;

  -- Default: Green
  RETURN 'green';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- TRIGGERS: AUTO-UPDATE COLOR STATUS
-- ============================================

CREATE OR REPLACE FUNCTION update_initiative_color_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.color_status := calculate_initiative_color_status(
    NEW.status,
    NEW.target_type,
    NEW.target_date,
    NEW.target_week,
    NEW.target_quarter,
    NEW.updated_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_initiative_color_status
  BEFORE INSERT OR UPDATE ON project_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_color_status();

-- ============================================
-- TRIGGERS: UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_functions_updated_at BEFORE UPDATE ON project_functions
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_function_access_updated_at BEFORE UPDATE ON project_function_access
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_buckets_updated_at BEFORE UPDATE ON project_buckets
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_initiatives_updated_at BEFORE UPDATE ON project_initiatives
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_weekly_updates_updated_at BEFORE UPDATE ON project_weekly_updates
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_comments_updated_at BEFORE UPDATE ON project_comments
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

-- ============================================
-- TRIGGERS: ACTIVITY LOG
-- ============================================

CREATE OR REPLACE FUNCTION log_initiative_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO project_activity (initiative_id, user_id, action, changes)
    VALUES (NEW.id, NEW.created_by, 'created', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      INSERT INTO project_activity (initiative_id, user_id, action, changes)
      VALUES (NEW.id, NEW.assigned_to, 'status_changed', jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      ));
    END IF;

    -- Log assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO project_activity (initiative_id, user_id, action, changes)
      VALUES (NEW.id, NEW.assigned_to, 'assigned', jsonb_build_object(
        'old_assigned_to', OLD.assigned_to,
        'new_assigned_to', NEW.assigned_to
      ));
    END IF;

    -- Log general updates
    INSERT INTO project_activity (initiative_id, user_id, action, changes)
    VALUES (NEW.id, NEW.assigned_to, 'updated', jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    ));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_initiative_activity
  AFTER INSERT OR UPDATE ON project_initiatives
  FOR EACH ROW
  EXECUTE FUNCTION log_initiative_activity();

-- ============================================
-- SEED DATA: DEFAULT SETTINGS
-- ============================================

INSERT INTO project_settings (setting_key, setting_value, description) VALUES
  ('email_schedule', '{"day": "friday", "time": "12:00", "timezone": "America/Chicago"}', 'Weekly summary email schedule'),
  ('reminder_hours', '{"hours": 24}', 'Hours before email to send reminder'),
  ('email_recipients', '{"type": "all_leadership", "custom": []}', 'Who receives summary emails'),
  ('archive_after_days', '{"days": 30}', 'Days after completion to auto-archive')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Functions
CREATE INDEX IF NOT EXISTS idx_project_functions_active ON project_functions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_functions_sort ON project_functions(sort_order);

-- Function Access
CREATE INDEX IF NOT EXISTS idx_function_access_user ON project_function_access(user_id);
CREATE INDEX IF NOT EXISTS idx_function_access_function ON project_function_access(function_id);

-- Buckets
CREATE INDEX IF NOT EXISTS idx_project_buckets_function ON project_buckets(function_id);
CREATE INDEX IF NOT EXISTS idx_project_buckets_active ON project_buckets(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_buckets_sort ON project_buckets(function_id, sort_order);

-- Initiatives
CREATE INDEX IF NOT EXISTS idx_initiatives_bucket ON project_initiatives(bucket_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_assigned ON project_initiatives(assigned_to);
CREATE INDEX IF NOT EXISTS idx_initiatives_status ON project_initiatives(status);
CREATE INDEX IF NOT EXISTS idx_initiatives_priority ON project_initiatives(priority);
CREATE INDEX IF NOT EXISTS idx_initiatives_color ON project_initiatives(color_status);
CREATE INDEX IF NOT EXISTS idx_initiatives_active ON project_initiatives(bucket_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_initiatives_high_priority ON project_initiatives(priority) WHERE priority = 'high' AND archived_at IS NULL;

-- Weekly Updates
CREATE INDEX IF NOT EXISTS idx_weekly_updates_initiative ON project_weekly_updates(initiative_id);
CREATE INDEX IF NOT EXISTS idx_weekly_updates_user ON project_weekly_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_updates_week ON project_weekly_updates(week_start_date);

-- Activity
CREATE INDEX IF NOT EXISTS idx_activity_initiative ON project_activity(initiative_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON project_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON project_activity(created_at DESC);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_initiative ON project_comments(initiative_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON project_comments(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_function_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_weekly_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_comments ENABLE ROW LEVEL SECURITY;

-- Settings: Admin only
CREATE POLICY "Admins can manage settings" ON project_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Functions: Viewable by users with access
CREATE POLICY "Users can view functions they have access to" ON project_functions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_functions.id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and leads can manage functions" ON project_functions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_functions.id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- Function Access: Viewable by function members
CREATE POLICY "Users can view access for their functions" ON project_function_access
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_function_access AS pfa
      WHERE pfa.function_id = project_function_access.function_id
      AND pfa.user_id = auth.uid()
      AND pfa.role IN ('admin', 'lead')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and leads can manage access" ON project_function_access
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access AS pfa
      WHERE pfa.function_id = project_function_access.function_id
      AND pfa.user_id = auth.uid()
      AND pfa.role IN ('admin', 'lead')
    )
  );

-- Buckets: Viewable by function members
CREATE POLICY "Users can view buckets in their functions" ON project_buckets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_buckets.function_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and leads can manage buckets" ON project_buckets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_function_access
      WHERE project_function_access.function_id = project_buckets.function_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- Initiatives: Viewable by function members
CREATE POLICY "Users can view initiatives in their functions" ON project_initiatives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_buckets
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_buckets.id = project_initiatives.bucket_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update their assigned initiatives" ON project_initiatives
  FOR UPDATE USING (
    assigned_to = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM project_buckets
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_buckets.id = project_initiatives.bucket_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and leads can create initiatives" ON project_initiatives
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM project_buckets
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_buckets.id = project_initiatives.bucket_id
      AND project_function_access.user_id = auth.uid()
      AND project_function_access.role IN ('admin', 'lead')
    )
  );

-- Weekly Updates: Users can manage their own updates
CREATE POLICY "Users can view updates for initiatives they can see" ON project_weekly_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_buckets ON project_buckets.id = project_initiatives.bucket_id
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_initiatives.id = project_weekly_updates.initiative_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can manage their own weekly updates" ON project_weekly_updates
  FOR ALL USING (user_id = auth.uid());

-- Activity: Viewable by function members
CREATE POLICY "Users can view activity for initiatives they can see" ON project_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_buckets ON project_buckets.id = project_initiatives.bucket_id
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_initiatives.id = project_activity.initiative_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Comments: Viewable and creatable by function members
CREATE POLICY "Users can view comments for initiatives they can see" ON project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_buckets ON project_buckets.id = project_initiatives.bucket_id
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_initiatives.id = project_comments.initiative_id
      AND project_function_access.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create comments on initiatives they can see" ON project_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM project_initiatives
      JOIN project_buckets ON project_buckets.id = project_initiatives.bucket_id
      JOIN project_function_access ON project_function_access.function_id = project_buckets.function_id
      WHERE project_initiatives.id = project_comments.initiative_id
      AND project_function_access.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own comments" ON project_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments" ON project_comments
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- MENU VISIBILITY: Add Leadership to menu
-- ============================================

-- Insert Leadership menu visibility setting
-- Initially hidden - admins will need to grant access to specific users
INSERT INTO menu_visibility (menu_id, menu_name, visible_for_roles) VALUES
  ('leadership', 'Leadership', '{}')
ON CONFLICT (menu_id) DO UPDATE SET
  menu_name = EXCLUDED.menu_name,
  visible_for_roles = EXCLUDED.visible_for_roles,
  updated_at = NOW();

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE project_settings IS 'System configuration: email schedule, recipients, etc.';
COMMENT ON TABLE project_functions IS 'Top-level organizational functions (Operations, Finance, etc.)';
COMMENT ON TABLE project_function_access IS 'User permissions per function (admin, lead, member, viewer)';
COMMENT ON TABLE project_buckets IS 'Responsibility areas within functions';
COMMENT ON TABLE project_initiatives IS 'Core work items with ownership, status, and progress tracking';
COMMENT ON TABLE project_weekly_updates IS 'Weekly check-ins per initiative';
COMMENT ON TABLE project_activity IS 'Audit log for all changes';
COMMENT ON TABLE project_comments IS 'Discussion threads on initiatives';
