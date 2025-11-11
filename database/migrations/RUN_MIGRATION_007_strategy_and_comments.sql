-- ============================================
-- MIGRATION 007: Function Strategy and Comments
-- ============================================
-- Run this in Supabase SQL Editor
-- Purpose: Add strategy planning and collaboration features

-- 1. Create function_strategy table
CREATE TABLE IF NOT EXISTS function_strategy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  description TEXT,
  objectives TEXT,
  current_situation TEXT,
  challenges TEXT,
  opportunities TEXT,
  operating_plan TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  UNIQUE(function_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_function_strategy_function_id ON function_strategy(function_id);
CREATE INDEX IF NOT EXISTS idx_function_strategy_status ON function_strategy(status);
CREATE INDEX IF NOT EXISTS idx_function_strategy_created_by ON function_strategy(created_by);

-- Enable RLS
ALTER TABLE function_strategy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for function_strategy
-- Allow users to read strategies for functions they have access to
CREATE POLICY "Users can read strategies for their functions"
ON function_strategy
FOR SELECT
USING (
  -- Admins can see all
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  -- Function members can see their function's strategy
  (function_id IN (
    SELECT function_id FROM project_function_access WHERE user_id = auth.uid()
  ))
);

-- Allow function owners and admins to create strategies
CREATE POLICY "Function owners can create strategies"
ON function_strategy
FOR INSERT
WITH CHECK (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (function_id IN (
    SELECT function_id FROM project_function_access WHERE user_id = auth.uid()
  ))
);

-- Allow creators and admins to update strategies
CREATE POLICY "Creators can update their strategies"
ON function_strategy
FOR UPDATE
USING (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (created_by = auth.uid())
  OR
  (function_id IN (
    SELECT function_id FROM project_function_access WHERE user_id = auth.uid()
  ))
);

-- 2. Create strategy_comments table
CREATE TABLE IF NOT EXISTS strategy_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_id UUID NOT NULL REFERENCES project_functions(id) ON DELETE CASCADE,
  section TEXT CHECK (section IN ('description', 'objectives', 'current_situation', 'challenges', 'opportunities', 'operating_plan', 'general')),
  comment TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_strategy_comments_function_id ON strategy_comments(function_id);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_section ON strategy_comments(section);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_created_by ON strategy_comments(created_by);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_is_resolved ON strategy_comments(is_resolved);
CREATE INDEX IF NOT EXISTS idx_strategy_comments_created_at ON strategy_comments(created_at DESC);

-- Enable RLS
ALTER TABLE strategy_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for strategy_comments
-- Allow users to read comments for functions they have access to
CREATE POLICY "Users can read comments for their functions"
ON strategy_comments
FOR SELECT
USING (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (function_id IN (
    SELECT function_id FROM project_function_access WHERE user_id = auth.uid()
  ))
);

-- Allow function members to create comments
CREATE POLICY "Function members can create comments"
ON strategy_comments
FOR INSERT
WITH CHECK (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (function_id IN (
    SELECT function_id FROM project_function_access WHERE user_id = auth.uid()
  ))
);

-- Allow comment creators and admins to update their comments
CREATE POLICY "Creators can update their comments"
ON strategy_comments
FOR UPDATE
USING (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (created_by = auth.uid())
);

-- Allow comment creators and admins to delete their comments
CREATE POLICY "Creators can delete their comments"
ON strategy_comments
FOR DELETE
USING (
  (auth.uid() IN (SELECT id FROM user_profiles WHERE role = 'admin'))
  OR
  (created_by = auth.uid())
);

-- 3. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_function_strategy_updated_at
  BEFORE UPDATE ON function_strategy
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_comments_updated_at
  BEFORE UPDATE ON strategy_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Grant permissions
GRANT ALL ON function_strategy TO authenticated;
GRANT ALL ON strategy_comments TO authenticated;
GRANT ALL ON function_strategy TO service_role;
GRANT ALL ON strategy_comments TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run these to verify the migration succeeded:
-- SELECT * FROM function_strategy LIMIT 1;
-- SELECT * FROM strategy_comments LIMIT 1;
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'function_strategy';
-- SELECT COUNT(*) FROM pg_policies WHERE tablename = 'strategy_comments';
