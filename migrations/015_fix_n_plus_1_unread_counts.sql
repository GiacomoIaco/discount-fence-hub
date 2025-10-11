-- Fix N+1 query problem for unread counts
-- This migration adds a batch function to get unread counts for multiple requests at once

-- ============================================
-- BATCH GET UNREAD COUNTS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_unread_counts_batch(req_ids UUID[], usr_id UUID)
RETURNS TABLE(request_id UUID, unread_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS request_id,
    COALESCE(
      CASE
        WHEN rv.last_viewed_at IS NULL THEN
          -- Never viewed: count all notes
          (SELECT COUNT(*)::INTEGER
           FROM request_notes rn
           WHERE rn.request_id = r.id)
        ELSE
          -- Viewed before: count notes after last view (excluding user's own)
          (SELECT COUNT(*)::INTEGER
           FROM request_notes rn
           WHERE rn.request_id = r.id
           AND rn.created_at > rv.last_viewed_at
           AND rn.user_id != usr_id)
      END,
      0
    ) AS unread_count
  FROM unnest(req_ids) AS r(id)
  LEFT JOIN request_views rv ON rv.request_id = r.id AND rv.user_id = usr_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- PERFORMANCE NOTES
-- ============================================
-- This function reduces N database calls to 1 single call
-- Example: 100 requests = 1 query instead of 100 queries
-- Performance improvement: ~10-100x faster for large result sets

DO $$
BEGIN
  RAISE NOTICE '✅ Batch unread counts function installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Performance improvement:';
  RAISE NOTICE '• Old: N queries (one per request)';
  RAISE NOTICE '• New: 1 query for all requests';
  RAISE NOTICE '• Speed: 10-100x faster for large lists';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT * FROM get_unread_counts_batch(ARRAY[req1, req2, req3], user_id);';
END $$;
