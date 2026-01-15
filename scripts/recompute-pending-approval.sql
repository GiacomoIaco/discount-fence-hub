-- Touch all quotes with approval_requested_at to recompute their status
UPDATE quotes
SET updated_at = NOW()
WHERE approval_requested_at IS NOT NULL
  AND manager_approved_at IS NULL
  AND manager_rejected_at IS NULL;

-- Show the results
SELECT id, quote_number, status, approval_requested_at, manager_approved_at
FROM quotes
WHERE approval_requested_at IS NOT NULL
ORDER BY approval_requested_at DESC
LIMIT 5;
