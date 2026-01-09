-- Migration 218: Fix approval_status default for self-signup
-- Problem: Column defaults to 'approved', bypassing the approval workflow
-- Solution: Change default to 'pending' so self-signup users require approval

-- Change the default from 'approved' to 'pending'
ALTER TABLE user_profiles
ALTER COLUMN approval_status SET DEFAULT 'pending';

-- Note: Existing approved users are not affected
-- Only new signups will now default to 'pending' status

-- Add a comment explaining the workflow
COMMENT ON COLUMN user_profiles.approval_status IS
'Self-signup users default to pending and require admin approval.
Invited users should be set to approved during profile creation.';
