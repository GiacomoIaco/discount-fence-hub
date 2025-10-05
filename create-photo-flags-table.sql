-- Photo Flagging System for Quality Review
-- Run this in Supabase SQL Editor

-- Create photo_flags table
CREATE TABLE IF NOT EXISTS photo_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flagged_by_name TEXT NOT NULL,

  -- Flag details
  flag_reason TEXT NOT NULL CHECK (flag_reason IN ('wrong_tags', 'poor_quality', 'needs_enhancement', 'other')),
  notes TEXT,
  suggested_tags TEXT[], -- Optional: tags the user thinks should be added

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_photo_flags_photo ON photo_flags(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_flags_flagged_by ON photo_flags(flagged_by);
CREATE INDEX IF NOT EXISTS idx_photo_flags_status ON photo_flags(status);
CREATE INDEX IF NOT EXISTS idx_photo_flags_created_at ON photo_flags(created_at DESC);

-- Prevent duplicate active flags from same user for same photo
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_flag
ON photo_flags(photo_id, flagged_by)
WHERE status = 'pending';

-- RLS Policies
ALTER TABLE photo_flags ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read flags
CREATE POLICY "Anyone can read flags"
ON photo_flags FOR SELECT
TO authenticated
USING (true);

-- Authenticated users can create flags
CREATE POLICY "Authenticated users can create flags"
ON photo_flags FOR INSERT
TO authenticated
WITH CHECK (flagged_by = auth.uid());

-- Only admins and sales managers can update flags (resolve them)
CREATE POLICY "Managers can update flags"
ON photo_flags FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin', 'sales-manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role IN ('admin', 'sales-manager')
  )
);

-- Users can delete their own pending flags
CREATE POLICY "Users can delete own pending flags"
ON photo_flags FOR DELETE
TO authenticated
USING (
  flagged_by = auth.uid() AND status = 'pending'
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_photo_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_photo_flags_updated_at
BEFORE UPDATE ON photo_flags
FOR EACH ROW EXECUTE FUNCTION update_photo_flags_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully created photo_flags table!';
  RAISE NOTICE 'Users can now flag photos for quality review';
END $$;
