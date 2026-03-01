-- ============================================================================
-- 284: TODO AUTO-ARCHIVE
-- ============================================================================

-- Add archived_at column (cleaner than changing status enum)
ALTER TABLE todo_items
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Index for filtering archived items
CREATE INDEX IF NOT EXISTS idx_todo_items_archived ON todo_items(archived_at) WHERE archived_at IS NOT NULL;

-- RPC function to archive stale completed items
CREATE OR REPLACE FUNCTION archive_stale_todo_items(days_threshold int DEFAULT 30)
RETURNS int AS $$
DECLARE affected int;
BEGIN
  UPDATE todo_items
  SET archived_at = now()
  WHERE status = 'done'
    AND completed_at IS NOT NULL
    AND completed_at < now() - (days_threshold || ' days')::interval
    AND archived_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
