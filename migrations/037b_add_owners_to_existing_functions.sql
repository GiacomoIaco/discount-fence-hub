-- Migration 037b: Add current user as owner to all existing functions
-- This ensures existing functions have at least one owner for the weight columns to appear

INSERT INTO project_function_owners (function_id, user_id, added_by)
SELECT
  pf.id,
  auth.uid(),
  auth.uid()
FROM project_functions pf
WHERE NOT EXISTS (
  SELECT 1 FROM project_function_owners pfo
  WHERE pfo.function_id = pf.id AND pfo.user_id = auth.uid()
)
ON CONFLICT (function_id, user_id) DO NOTHING;
