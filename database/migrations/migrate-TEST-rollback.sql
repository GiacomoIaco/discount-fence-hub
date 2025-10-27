-- ============================================
-- TEST RUN: Drop sales_reps table (DRY RUN - NO CHANGES SAVED)
-- ============================================
--
-- ⚠️ THIS IS A TEST VERSION - IT WILL NOT SAVE ANY CHANGES ⚠️
--
-- This script runs all the migration steps but ROLLS BACK at the end.
-- Use this to verify the migration works without making permanent changes.
--
-- After running this successfully, use migrate-PRODUCTION-commit.sql
--
-- ============================================

BEGIN;  -- Start transaction

-- ============================================
-- STEP 1: Update photos table
-- ============================================

-- Drop old FK constraints
ALTER TABLE photos
  DROP CONSTRAINT IF EXISTS photos_uploaded_by_fkey CASCADE;

ALTER TABLE photos
  DROP CONSTRAINT IF EXISTS photos_reviewed_by_fkey CASCADE;

-- Add new FK constraints pointing to auth.users
-- Note: Using SET NULL on delete since we want to preserve photos even if user is deleted
ALTER TABLE photos
  ADD CONSTRAINT photos_uploaded_by_fkey
    FOREIGN KEY (uploaded_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

ALTER TABLE photos
  ADD CONSTRAINT photos_reviewed_by_fkey
    FOREIGN KEY (reviewed_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Make columns nullable if they aren't already
ALTER TABLE photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE photos ALTER COLUMN reviewed_by DROP NOT NULL;

-- ============================================
-- STEP 2: Update presentations table
-- ============================================

ALTER TABLE presentations
  DROP CONSTRAINT IF EXISTS presentations_created_by_fkey CASCADE;

ALTER TABLE presentations
  ADD CONSTRAINT presentations_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- ============================================
-- STEP 3: Update roi_calculations table
-- ============================================

ALTER TABLE roi_calculations
  DROP CONSTRAINT IF EXISTS roi_calculations_rep_id_fkey CASCADE;

-- Rename rep_id to user_id for consistency
ALTER TABLE roi_calculations
  RENAME COLUMN rep_id TO user_id;

ALTER TABLE roi_calculations
  ADD CONSTRAINT roi_calculations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- ============================================
-- STEP 4: Update activity_log table
-- ============================================

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey CASCADE;

ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- ============================================
-- STEP 5: Update sales_resources tables (if they exist)
-- ============================================

-- Check if tables exist first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_folders') THEN
    -- Drop old constraints
    ALTER TABLE sales_resources_folders
      DROP CONSTRAINT IF EXISTS sales_resources_folders_created_by_fkey CASCADE;
    ALTER TABLE sales_resources_folders
      DROP CONSTRAINT IF EXISTS sales_resources_folders_archived_by_fkey CASCADE;

    -- Add new constraints
    ALTER TABLE sales_resources_folders
      ADD CONSTRAINT sales_resources_folders_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE sales_resources_folders
      ADD CONSTRAINT sales_resources_folders_archived_by_fkey
        FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;

    RAISE NOTICE '✓ Updated sales_resources_folders';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_files') THEN
    ALTER TABLE sales_resources_files
      DROP CONSTRAINT IF EXISTS sales_resources_files_uploaded_by_fkey CASCADE;
    ALTER TABLE sales_resources_files
      DROP CONSTRAINT IF EXISTS sales_resources_files_archived_by_fkey CASCADE;

    ALTER TABLE sales_resources_files
      ADD CONSTRAINT sales_resources_files_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE sales_resources_files
      ADD CONSTRAINT sales_resources_files_archived_by_fkey
        FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;

    RAISE NOTICE '✓ Updated sales_resources_files';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_views') THEN
    ALTER TABLE sales_resources_views
      DROP CONSTRAINT IF EXISTS sales_resources_views_user_id_fkey CASCADE;

    ALTER TABLE sales_resources_views
      ADD CONSTRAINT sales_resources_views_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    RAISE NOTICE '✓ Updated sales_resources_views';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_favorites') THEN
    ALTER TABLE sales_resources_favorites
      DROP CONSTRAINT IF EXISTS sales_resources_favorites_user_id_fkey CASCADE;

    ALTER TABLE sales_resources_favorites
      ADD CONSTRAINT sales_resources_favorites_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

    RAISE NOTICE '✓ Updated sales_resources_favorites';
  END IF;
END $$;

-- ============================================
-- STEP 6: Nullify orphaned references
-- ============================================

-- Set any UUIDs that reference the old sales_reps record to NULL
-- This prevents foreign key violations when we drop sales_reps

UPDATE photos
SET uploaded_by = NULL
WHERE uploaded_by IN (SELECT id FROM sales_reps);

UPDATE photos
SET reviewed_by = NULL
WHERE reviewed_by IN (SELECT id FROM sales_reps);

UPDATE presentations
SET created_by = NULL
WHERE created_by IN (SELECT id FROM sales_reps);

UPDATE roi_calculations
SET user_id = NULL
WHERE user_id IN (SELECT id FROM sales_reps);

UPDATE activity_log
SET user_id = NULL
WHERE user_id IN (SELECT id FROM sales_reps);

-- Update sales_resources tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_folders') THEN
    UPDATE sales_resources_folders SET created_by = NULL WHERE created_by IN (SELECT id FROM sales_reps);
    UPDATE sales_resources_folders SET archived_by = NULL WHERE archived_by IN (SELECT id FROM sales_reps);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_files') THEN
    UPDATE sales_resources_files SET uploaded_by = NULL WHERE uploaded_by IN (SELECT id FROM sales_reps);
    UPDATE sales_resources_files SET archived_by = NULL WHERE archived_by IN (SELECT id FROM sales_reps);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_views') THEN
    DELETE FROM sales_resources_views WHERE user_id IN (SELECT id FROM sales_reps);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_favorites') THEN
    DELETE FROM sales_resources_favorites WHERE user_id IN (SELECT id FROM sales_reps);
  END IF;
END $$;

-- ============================================
-- STEP 7: Drop sales_reps table
-- ============================================

DROP TABLE IF EXISTS sales_reps CASCADE;

-- ============================================
-- STEP 8: Backfill missing user_profiles
-- ============================================

-- Create user_profiles for any auth.users that don't have one
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
  COALESCE(au.raw_user_meta_data->>'role', 'sales'),
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- TEST COMPLETE - SHOW WHAT WOULD HAPPEN
-- ============================================

DO $$
DECLARE
  profile_count INTEGER;
  auth_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  SELECT COUNT(*) INTO auth_count FROM auth.users;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ TEST RUN COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes that WOULD be made:';
  RAISE NOTICE '  • Drop sales_reps table';
  RAISE NOTICE '  • Update 9 tables to reference auth.users';
  RAISE NOTICE '  • Nullify orphaned user references';
  RAISE NOTICE '  • Backfill % user_profiles', profile_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Current state:';
  RAISE NOTICE '  • auth.users: %', auth_count;
  RAISE NOTICE '  • user_profiles: %', profile_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ ROLLING BACK - NO CHANGES SAVED ⚠️';
  RAISE NOTICE '';
  RAISE NOTICE 'If this test ran without errors, you can now run:';
  RAISE NOTICE 'migrate-PRODUCTION-commit.sql to apply changes permanently';
  RAISE NOTICE '========================================';
END $$;

ROLLBACK;  -- UNDO ALL CHANGES - NOTHING IS SAVED!
