-- Update sync status to success
UPDATE jobber_sync_status
SET
  last_sync_at = NOW(),
  last_sync_type = 'full',
  last_sync_status = 'success',
  last_error = NULL,
  requests_synced = 2000,
  opportunities_computed = 7565,
  updated_at = NOW()
WHERE id = 'residential';
