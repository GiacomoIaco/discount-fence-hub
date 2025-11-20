-- Migration 037c: Add admin user as owner to all existing functions
-- Gets the first admin user and adds them as owner to all functions

INSERT INTO project_function_owners (function_id, user_id, added_by)
SELECT
  pf.id,
  up.id,
  up.id
FROM project_functions pf
CROSS JOIN (
  SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1
) up
WHERE NOT EXISTS (
  SELECT 1 FROM project_function_owners pfo
  WHERE pfo.function_id = pf.id AND pfo.user_id = up.id
)
ON CONFLICT (function_id, user_id) DO NOTHING;
