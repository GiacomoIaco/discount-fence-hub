-- Audit: Find all data that references the old sales_reps table
-- This will show us what data will be affected by dropping sales_reps

-- Get the sales_reps ID (there's only 1)
SELECT 'OLD SALES_REPS RECORD:' as info;
SELECT id, email, name FROM sales_reps;

-- Check photos
SELECT 'PHOTOS uploaded_by old sales_reps:' as info;
SELECT COUNT(*) as count, uploaded_by
FROM photos
WHERE uploaded_by IN (SELECT id FROM sales_reps)
GROUP BY uploaded_by;

SELECT 'PHOTOS reviewed_by old sales_reps:' as info;
SELECT COUNT(*) as count, reviewed_by
FROM photos
WHERE reviewed_by IN (SELECT id FROM sales_reps)
GROUP BY reviewed_by;

-- Check presentations
SELECT 'PRESENTATIONS by old sales_reps:' as info;
SELECT COUNT(*) as count, created_by
FROM presentations
WHERE created_by IN (SELECT id FROM sales_reps)
GROUP BY created_by;

-- Check roi_calculations
SELECT 'ROI_CALCULATIONS by old sales_reps:' as info;
SELECT COUNT(*) as count, rep_id
FROM roi_calculations
WHERE rep_id IN (SELECT id FROM sales_reps)
GROUP BY rep_id;

-- Check activity_log
SELECT 'ACTIVITY_LOG by old sales_reps:' as info;
SELECT COUNT(*) as count, user_id
FROM activity_log
WHERE user_id IN (SELECT id FROM sales_reps)
GROUP BY user_id;

-- Check sales_resources tables (if they exist)
SELECT 'SALES_RESOURCES_FOLDERS by old sales_reps:' as info;
SELECT COUNT(*) as folders_created
FROM sales_resources_folders
WHERE created_by IN (SELECT id FROM sales_reps);

SELECT COUNT(*) as folders_archived
FROM sales_resources_folders
WHERE archived_by IN (SELECT id FROM sales_reps);

SELECT 'SALES_RESOURCES_FILES by old sales_reps:' as info;
SELECT COUNT(*) as files_uploaded
FROM sales_resources_files
WHERE uploaded_by IN (SELECT id FROM sales_reps);

SELECT COUNT(*) as files_archived
FROM sales_resources_files
WHERE archived_by IN (SELECT id FROM sales_reps);

SELECT 'SALES_RESOURCES_VIEWS by old sales_reps:' as info;
SELECT COUNT(*) as views
FROM sales_resources_views
WHERE user_id IN (SELECT id FROM sales_reps);

SELECT 'SALES_RESOURCES_FAVORITES by old sales_reps:' as info;
SELECT COUNT(*) as favorites
FROM sales_resources_favorites
WHERE user_id IN (SELECT id FROM sales_reps);

-- Summary
SELECT 'SUMMARY: Check above counts. If all are 0, we can safely drop sales_reps!' as conclusion;
