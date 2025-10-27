-- Simplified audit: Find all data referencing old sales_reps table
-- Run each query one at a time if needed

-- ============================================
-- PART 1: What's in sales_reps?
-- ============================================
SELECT 'Step 1: Sales Reps Record' as step, id, email, name
FROM sales_reps;

-- ============================================
-- PART 2: Check each table individually
-- ============================================

-- Photos uploaded_by
SELECT 'Step 2: Photos uploaded_by' as step,
       COUNT(*) as count,
       COUNT(DISTINCT uploaded_by) as unique_users
FROM photos
WHERE uploaded_by IN (SELECT id FROM sales_reps);

-- Photos reviewed_by
SELECT 'Step 3: Photos reviewed_by' as step,
       COUNT(*) as count,
       COUNT(DISTINCT reviewed_by) as unique_users
FROM photos
WHERE reviewed_by IN (SELECT id FROM sales_reps);

-- Presentations
SELECT 'Step 4: Presentations' as step,
       COUNT(*) as count
FROM presentations
WHERE created_by IN (SELECT id FROM sales_reps);

-- ROI Calculations
SELECT 'Step 5: ROI Calculations' as step,
       COUNT(*) as count
FROM roi_calculations
WHERE rep_id IN (SELECT id FROM sales_reps);

-- Activity Log
SELECT 'Step 6: Activity Log' as step,
       COUNT(*) as count
FROM activity_log
WHERE user_id IN (SELECT id FROM sales_reps);

-- ============================================
-- PART 3: Summary
-- ============================================
SELECT 'Step 7: SUMMARY' as step,
       'If all counts above are 0, migration is safe!' as message;
