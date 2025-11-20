-- Migration 037: Add Function Owners
-- Purpose: Track function owners for permissions and email notifications

-- ============================================
-- 1. Create function owners table
-- ============================================

CREATE TABLE IF NOT EXISTS project_function_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(function_id, user_id)
);

-- ============================================
-- 2. Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_function_owners_function ON project_function_owners(function_id);
CREATE INDEX IF NOT EXISTS idx_function_owners_user ON project_function_owners(user_id);

-- ============================================
-- 3. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE project_function_owners ENABLE ROW LEVEL SECURITY;

-- Users can view owners for functions they have access to
CREATE POLICY select_function_owners ON project_function_owners
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_functions pf
      WHERE pf.id = project_function_owners.function_id
    )
  );

-- Only admins and existing owners can add/remove owners
CREATE POLICY manage_function_owners ON project_function_owners
  FOR ALL
  USING (
    -- User is admin
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
    OR
    -- User is already an owner of this function
    EXISTS (
      SELECT 1 FROM project_function_owners pfo
      WHERE pfo.function_id = project_function_owners.function_id
      AND pfo.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. Comments
-- ============================================

COMMENT ON TABLE project_function_owners IS 'Tracks function owners who receive weekly emails and have edit permissions';
