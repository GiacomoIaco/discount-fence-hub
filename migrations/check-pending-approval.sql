-- Check quotes that should have pending_manager_approval status
SELECT
  id,
  quote_number,
  status,
  approval_requested_at,
  manager_approved_at,
  manager_rejected_at
FROM quotes
WHERE approval_requested_at IS NOT NULL
ORDER BY approval_requested_at DESC
LIMIT 10;
