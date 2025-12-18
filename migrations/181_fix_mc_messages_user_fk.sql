-- Migration: 181_fix_mc_messages_user_fk
-- Description: Add foreign key from mc_messages.from_user_id to user_profiles for PostgREST joins
-- Date: 2024-12-18

-- The original FK is to auth.users, but we need to join to user_profiles
-- Add a FK to user_profiles so PostgREST can follow the relationship

-- First, drop the existing constraint if it exists (to auth.users)
ALTER TABLE mc_messages
DROP CONSTRAINT IF EXISTS mc_messages_from_user_id_fkey;

-- Add FK to user_profiles instead
-- Note: user_profiles.id references auth.users.id, so this is safe
ALTER TABLE mc_messages
ADD CONSTRAINT mc_messages_from_user_id_fkey
FOREIGN KEY (from_user_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
