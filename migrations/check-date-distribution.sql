-- Check date distribution in jobber_builder_jobs
-- This is a diagnostic query, not a migration

SELECT
  'Total jobs' as metric,
  COUNT(*)::text as value
FROM jobber_builder_jobs

UNION ALL

SELECT
  'Jobs with closed_date',
  COUNT(*)::text
FROM jobber_builder_jobs
WHERE closed_date IS NOT NULL

UNION ALL

SELECT
  'Jobs without closed_date',
  COUNT(*)::text
FROM jobber_builder_jobs
WHERE closed_date IS NULL

UNION ALL

SELECT
  'Min created_date',
  MIN(created_date)::text
FROM jobber_builder_jobs

UNION ALL

SELECT
  'Max created_date',
  MAX(created_date)::text
FROM jobber_builder_jobs

UNION ALL

SELECT
  'Min closed_date',
  MIN(closed_date)::text
FROM jobber_builder_jobs
WHERE closed_date IS NOT NULL

UNION ALL

SELECT
  'Max closed_date',
  MAX(closed_date)::text
FROM jobber_builder_jobs
WHERE closed_date IS NOT NULL;
