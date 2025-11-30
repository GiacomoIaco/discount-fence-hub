-- ============================================
-- Migration 055: Add Super Admin Flag
-- Created: 2025-11-30
-- Purpose: Add is_super_admin flag to user_profiles for unrestricted access
--          to Leadership Hub and My Todos Team View
-- ============================================

-- Add is_super_admin column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Set Giacomo as super admin
UPDATE user_profiles
SET is_super_admin = TRUE
WHERE email = 'giacomo@discountfenceusa.com';

-- Also check for alternate email
UPDATE user_profiles
SET is_super_admin = TRUE
WHERE email = 'giacomoiacoangeli@gmail.com';

-- Create index for super admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_super_admin
ON user_profiles(is_super_admin)
WHERE is_super_admin = TRUE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN user_profiles.is_super_admin IS 'Super admins have unrestricted access to Leadership Hub (all functions) and My Todos Team View (all functions). They can also perform CEO scoring.';
