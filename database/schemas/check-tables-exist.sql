-- Check which tables actually exist in your database
-- This helps us understand what's going on

SELECT
  table_name,
  CASE
    WHEN table_name IN ('sales_reps', 'photos', 'presentations', 'roi_calculations', 'activity_log',
                        'sales_resources_folders', 'sales_resources_files',
                        'sales_resources_views', 'sales_resources_favorites')
    THEN '✓ Related to migration'
    ELSE ''
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'sales_reps',
    'photos',
    'presentations',
    'roi_calculations',
    'activity_log',
    'sales_resources_folders',
    'sales_resources_files',
    'sales_resources_views',
    'sales_resources_favorites',
    'user_profiles',
    'requests'
  )
ORDER BY table_name;
