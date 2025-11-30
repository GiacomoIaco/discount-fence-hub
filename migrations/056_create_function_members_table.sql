-- ============================================
-- Migration 056: Create Function Members Table
-- Created: 2025-11-30
-- Purpose: Track function members who have Team View access in My Todos
--          but NOT Leadership Hub access (unlike Function Owners)
-- ============================================

-- ============================================
-- 1. Create function members table
-- ============================================

CREATE TABLE IF NOT EXISTS project_function_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Metadata
  added_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(function_id, user_id)
);

-- ============================================
-- 2. Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_function_members_function ON project_function_members(function_id);
CREATE INDEX IF NOT EXISTS idx_function_members_user ON project_function_members(user_id);

-- ============================================
-- 3. Enable Row Level Security (RLS)
-- ============================================

ALTER TABLE project_function_members ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can do anything
CREATE POLICY "super_admin_full_access" ON project_function_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND is_super_admin = TRUE
    )
  );

-- Policy: Function owners can manage members of their functions
CREATE POLICY "owner_manage_members" ON project_function_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM project_function_owners
      WHERE function_id = project_function_members.function_id
      AND user_id = auth.uid()
    )
  );

-- Policy: Users can view their own membership records
CREATE POLICY "view_own_membership" ON project_function_members
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- 4. Update function_owners RLS to include super_admin check
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS manage_function_owners ON project_function_owners;

-- Recreate with super_admin support
CREATE POLICY "manage_function_owners" ON project_function_owners
  FOR ALL
  USING (
    -- User is super admin
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.is_super_admin = TRUE
    )
    OR
    -- User is admin (legacy support)
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
-- 5. Comments
-- ============================================

COMMENT ON TABLE project_function_members IS 'Tracks function members who have Team View access in My Todos but NOT Leadership Hub access';
COMMENT ON COLUMN project_function_members.function_id IS 'The function this membership belongs to';
COMMENT ON COLUMN project_function_members.user_id IS 'The user who is a member of this function';
COMMENT ON COLUMN project_function_members.added_by IS 'The user (owner or super admin) who added this member';
