-- Migration 276: Migrate menu_visibility.visible_for_roles from legacy strings to AppRole values
-- This is Phase 1 of the User Identity Consolidation plan.
--
-- Mapping:
--   'admin'         -> 'admin' (unchanged)
--   'sales-manager' -> 'sales_manager'
--   'sales'         -> 'sales_rep'
--   'operations'    -> 'operations' (unchanged)
--   'yard'          -> 'yard' (unchanged)
--
-- Also adds reasonable defaults for new roles: owner, front_desk, ops_manager, crew

-- Step 1: Transform existing role values in visible_for_roles arrays
UPDATE menu_visibility
SET visible_for_roles = (
  SELECT array_agg(DISTINCT
    CASE val
      WHEN 'admin' THEN 'admin'
      WHEN 'sales-manager' THEN 'sales_manager'
      WHEN 'sales' THEN 'sales_rep'
      WHEN 'operations' THEN 'operations'
      WHEN 'yard' THEN 'yard'
      ELSE val  -- keep any already-migrated values
    END
  )
  FROM unnest(visible_for_roles) AS val
)
WHERE visible_for_roles IS NOT NULL;

-- Step 2: Add 'owner' to everything 'admin' can see
UPDATE menu_visibility
SET visible_for_roles = array_append(visible_for_roles, 'owner')
WHERE 'admin' = ANY(visible_for_roles)
  AND NOT ('owner' = ANY(visible_for_roles));

-- Step 3: Add 'ops_manager' to everything 'operations' can see
UPDATE menu_visibility
SET visible_for_roles = array_append(visible_for_roles, 'ops_manager')
WHERE 'operations' = ANY(visible_for_roles)
  AND NOT ('ops_manager' = ANY(visible_for_roles));

-- Step 4: Add 'front_desk' to basic items (requests, schedule, clients, chat, notifications)
UPDATE menu_visibility
SET visible_for_roles = array_append(visible_for_roles, 'front_desk')
WHERE menu_id IN ('requests', 'schedule', 'direct-messages', 'team-communication', 'my-todos')
  AND NOT ('front_desk' = ANY(visible_for_roles));

-- Step 5: Add 'crew' to minimal items (schedule, chat)
UPDATE menu_visibility
SET visible_for_roles = array_append(visible_for_roles, 'crew')
WHERE menu_id IN ('schedule', 'direct-messages', 'team-communication', 'my-todos')
  AND NOT ('crew' = ANY(visible_for_roles));
