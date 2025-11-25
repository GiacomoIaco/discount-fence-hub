-- ============================================
-- INITIATIVE COMMENTS TABLE
-- Created: 2025-11-25
-- Purpose: Allow comments/discussions on project initiatives
-- ============================================

-- Create the initiative_comments table
CREATE TABLE IF NOT EXISTS initiative_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID NOT NULL REFERENCES project_initiatives(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_initiative_comments_initiative
ON initiative_comments(initiative_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_initiative_comments_user
ON initiative_comments(user_id);

-- Enable RLS
ALTER TABLE initiative_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view comments on initiatives they have access to
CREATE POLICY "Users can view comments on accessible initiatives" ON initiative_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      WHERE pi.id = initiative_comments.initiative_id
      AND (
        -- Admin can see everything
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
        OR
        -- User is the creator
        pi.created_by = auth.uid()
        OR
        -- User is assigned to the initiative
        pi.assigned_to = auth.uid()
        OR
        -- User is the one who assigned it
        pi.assigned_by = auth.uid()
        OR
        -- Non-private initiatives: users with function access
        (
          (pi.is_private IS NULL OR pi.is_private = false)
          AND EXISTS (
            SELECT 1 FROM project_areas
            JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
            WHERE project_areas.id = pi.area_id
            AND project_function_access.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Users can insert comments on initiatives they have access to
CREATE POLICY "Users can add comments to accessible initiatives" ON initiative_comments
  FOR INSERT WITH CHECK (
    -- User must be authenticated and the comment user_id must match
    auth.uid() = user_id
    AND
    EXISTS (
      SELECT 1 FROM project_initiatives pi
      WHERE pi.id = initiative_comments.initiative_id
      AND (
        -- Admin can comment on anything
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.id = auth.uid()
          AND user_profiles.role = 'admin'
        )
        OR
        -- User is the creator
        pi.created_by = auth.uid()
        OR
        -- User is assigned to the initiative
        pi.assigned_to = auth.uid()
        OR
        -- User is the one who assigned it
        pi.assigned_by = auth.uid()
        OR
        -- Non-private initiatives: users with function access
        (
          (pi.is_private IS NULL OR pi.is_private = false)
          AND EXISTS (
            SELECT 1 FROM project_areas
            JOIN project_function_access ON project_function_access.function_id = project_areas.function_id
            WHERE project_areas.id = pi.area_id
            AND project_function_access.user_id = auth.uid()
          )
        )
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON initiative_comments
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments (or admin can delete any)
CREATE POLICY "Users can delete their own comments" ON initiative_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_initiative_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_initiative_comment_timestamp ON initiative_comments;
CREATE TRIGGER trigger_update_initiative_comment_timestamp
  BEFORE UPDATE ON initiative_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_initiative_comment_timestamp();

-- Comments
COMMENT ON TABLE initiative_comments IS 'Comments/discussions on project initiatives';
COMMENT ON COLUMN initiative_comments.initiative_id IS 'The initiative this comment belongs to';
COMMENT ON COLUMN initiative_comments.user_id IS 'The user who wrote the comment';
COMMENT ON COLUMN initiative_comments.content IS 'The comment text content';
