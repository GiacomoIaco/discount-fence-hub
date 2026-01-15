-- Check what columns exist in quotes table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotes'
  AND column_name IN ('lost_at', 'lost_reason', 'archived_at', 'approval_requested_at', 'manager_approved_at')
ORDER BY column_name;
