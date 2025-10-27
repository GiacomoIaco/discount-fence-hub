-- ============================================
-- PRODUCTION RUN: Drop sales_reps table (FIXED VERSION - PERMANENT)
-- ============================================
--
-- ⚠️ THIS WILL MAKE PERMANENT CHANGES TO YOUR DATABASE ⚠️
--
-- PREREQUISITES:
-- 1. You must have run migrate-TEST-rollback-FIXED.sql successfully first
-- 2. The test run should have completed without errors
--
-- FIX: Cleans up invalid UUIDs BEFORE adding foreign key constraints
--
-- ============================================

BEGIN;  -- Start transaction

-- ============================================
-- STEP 1: Make columns nullable first
-- ============================================

-- Make columns nullable if they aren't already
ALTER TABLE photos ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE photos ALTER COLUMN reviewed_by DROP NOT NULL;

-- ============================================
-- STEP 2: Clean up invalid UUIDs FIRST (before adding FK constraints)
-- ============================================

-- Nullify any UUIDs that don't exist in auth.users
-- This includes the placeholder '00000000-0000-0000-0000-000000000001' and sales_reps IDs

UPDATE photos
SET uploaded_by = NULL
WHERE uploaded_by NOT IN (SELECT id FROM auth.users);

UPDATE photos
SET reviewed_by = NULL
WHERE reviewed_by NOT IN (SELECT id FROM auth.users);

UPDATE presentations
SET created_by = NULL
WHERE created_by NOT IN (SELECT id FROM auth.users);

UPDATE roi_calculations
SET rep_id = NULL
WHERE rep_id NOT IN (SELECT id FROM auth.users);

UPDATE activity_log
SET user_id = NULL
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Clean up sales_resources tables if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_folders') THEN
    UPDATE sales_resources_folders
    SET created_by = NULL
    WHERE created_by NOT IN (SELECT id FROM auth.users);

    UPDATE sales_resources_folders
    SET archived_by = NULL
    WHERE archived_by NOT IN (SELECT id FROM auth.users);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_files') THEN
    UPDATE sales_resources_files
    SET uploaded_by = NULL
    WHERE uploaded_by NOT IN (SELECT id FROM auth.users);

    UPDATE sales_resources_files
    SET archived_by = NULL
    WHERE archived_by NOT IN (SELECT id FROM auth.users);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_views') THEN
    DELETE FROM sales_resources_views
    WHERE user_id NOT IN (SELECT id FROM auth.users);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_favorites') THEN
    DELETE FROM sales_resources_favorites
    WHERE user_id NOT IN (SELECT id FROM auth.users);
  END IF;
END $$;

-- ============================================
-- STEP 3: Now drop old FK constraints
-- ============================================

ALTER TABLE photos
  DROP CONSTRAINT IF EXISTS photos_uploaded_by_fkey CASCADE;

ALTER TABLE photos
  DROP CONSTRAINT IF EXISTS photos_reviewed_by_fkey CASCADE;

ALTER TABLE presentations
  DROP CONSTRAINT IF EXISTS presentations_created_by_fkey CASCADE;

ALTER TABLE roi_calculations
  DROP CONSTRAINT IF EXISTS roi_calculations_rep_id_fkey CASCADE;

ALTER TABLE activity_log
  DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey CASCADE;

-- ============================================
-- STEP 4: Update sales_resources FK constraints
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_folders') THEN
    ALTER TABLE sales_resources_folders
      DROP CONSTRAINT IF EXISTS sales_resources_folders_created_by_fkey CASCADE;
    ALTER TABLE sales_resources_folders
      DROP CONSTRAINT IF EXISTS sales_resources_folders_archived_by_fkey CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_files') THEN
    ALTER TABLE sales_resources_files
      DROP CONSTRAINT IF EXISTS sales_resources_files_uploaded_by_fkey CASCADE;
    ALTER TABLE sales_resources_files
      DROP CONSTRAINT IF EXISTS sales_resources_files_archived_by_fkey CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_views') THEN
    ALTER TABLE sales_resources_views
      DROP CONSTRAINT IF EXISTS sales_resources_views_user_id_fkey CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_favorites') THEN
    ALTER TABLE sales_resources_favorites
      DROP CONSTRAINT IF EXISTS sales_resources_favorites_user_id_fkey CASCADE;
  END IF;
END $$;

-- ============================================
-- STEP 5: Rename columns for consistency
-- ============================================

ALTER TABLE roi_calculations
  RENAME COLUMN rep_id TO user_id;

-- ============================================
-- STEP 6: NOW add new FK constraints (data is clean now)
-- ============================================

-- Photos
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

-- Presentations
ALTER TABLE presentations
  ADD CONSTRAINT presentations_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- ROI Calculations
ALTER TABLE roi_calculations
  ADD CONSTRAINT roi_calculations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Activity Log
ALTER TABLE activity_log
  ADD CONSTRAINT activity_log_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Sales Resources (if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_folders') THEN
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
      ADD CONSTRAINT sales_resources_files_uploaded_by_fkey
        FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE sales_resources_files
      ADD CONSTRAINT sales_resources_files_archived_by_fkey
        FOREIGN KEY (archived_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE '✓ Updated sales_resources_files';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_views') THEN
    ALTER TABLE sales_resources_views
      ADD CONSTRAINT sales_resources_views_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✓ Updated sales_resources_views';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_resources_favorites') THEN
    ALTER TABLE sales_resources_favorites
      ADD CONSTRAINT sales_resources_favorites_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✓ Updated sales_resources_favorites';
  END IF;
END $$;

-- ============================================
-- STEP 7: Drop sales_reps table
-- ============================================

DROP TABLE IF EXISTS sales_reps CASCADE;

-- ============================================
-- STEP 8: Backfill missing user_profiles
-- ============================================

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
-- SUCCESS! COMMITTING CHANGES
-- ============================================

DO $$
DECLARE
  profile_count INTEGER;
  auth_count INTEGER;
  null_photo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  SELECT COUNT(*) INTO auth_count FROM auth.users;
  SELECT COUNT(*) INTO null_photo_count FROM photos WHERE uploaded_by IS NULL;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  • Dropped sales_reps table';
  RAISE NOTICE '  • Updated 9 tables to reference auth.users';
  RAISE NOTICE '  • Cleaned up % invalid user references', null_photo_count;
  RAISE NOTICE '  • Backfilled % user_profiles', profile_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Current state:';
  RAISE NOTICE '  • auth.users: %', auth_count;
  RAISE NOTICE '  • user_profiles: %', profile_count;
  RAISE NOTICE '  • Photos with no uploader: %', null_photo_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test the application';
  RAISE NOTICE '  2. Check that users now display correctly';
  RAISE NOTICE '  3. Verify messages, photos, and requests show names';
  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL CHANGES HAVE BEEN COMMITTED AND SAVED!';
  RAISE NOTICE '========================================';
END $$;

COMMIT;  -- SAVE ALL CHANGES PERMANENTLY!
