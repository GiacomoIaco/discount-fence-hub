-- Fix Auto-Assignment Permissions
-- The applyAssignmentRules function needs to UPDATE requests after creation,
-- but regular users don't have UPDATE permissions. This creates a SECURITY DEFINER
-- function that can apply assignment rules regardless of RLS.

-- ============================================
-- 1. CREATE SECURITY DEFINER FUNCTION
-- ============================================

-- Function to auto-assign a request based on assignment rules
-- Called after request creation to apply auto-assignment
CREATE OR REPLACE FUNCTION apply_request_assignment_rules(req_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  req RECORD;
  rule RECORD;
  result JSONB;
BEGIN
  -- Get the request
  SELECT * INTO req FROM requests WHERE id = req_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Find the highest priority active rule for this request type
  SELECT * INTO rule
  FROM request_assignment_rules
  WHERE request_type = req.request_type
    AND is_active = true
  ORDER BY priority ASC
  LIMIT 1;

  -- If no rule found, return success with no assignment
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'assigned', false, 'reason', 'No matching assignment rule');
  END IF;

  -- Apply the assignment
  UPDATE requests
  SET
    assigned_to = rule.assignee_id,
    assigned_at = NOW(),
    updated_at = NOW()
  WHERE id = req_id;

  -- Log the auto-assignment activity
  INSERT INTO request_activity_log (request_id, user_id, action, details)
  VALUES (
    req_id,
    rule.assignee_id,
    'auto_assigned',
    jsonb_build_object(
      'assignee_id', rule.assignee_id,
      'rule_id', rule.id,
      'rule_priority', rule.priority
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'assigned', true,
    'assignee_id', rule.assignee_id,
    'rule_id', rule.id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION apply_request_assignment_rules(UUID) TO authenticated;

-- ============================================
-- 2. CREATE TRIGGER FOR AUTO-ASSIGNMENT
-- ============================================

-- Trigger function to auto-apply assignment rules on new requests
CREATE OR REPLACE FUNCTION trigger_auto_assign_request()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  rule RECORD;
BEGIN
  -- Only apply on INSERT
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Skip if already assigned
  IF NEW.assigned_to IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find the highest priority active rule for this request type
  SELECT * INTO rule
  FROM request_assignment_rules
  WHERE request_type = NEW.request_type
    AND is_active = true
  ORDER BY priority ASC
  LIMIT 1;

  -- If a rule exists, apply the assignment
  IF FOUND THEN
    NEW.assigned_to := rule.assignee_id;
    NEW.assigned_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_assign_on_insert ON requests;

-- Create trigger that runs BEFORE INSERT to set assignment in the same transaction
CREATE TRIGGER trigger_auto_assign_on_insert
  BEFORE INSERT ON requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_request();

-- ============================================
-- 3. ALSO ADD RLS POLICY FOR ASSIGNED USERS
-- ============================================

-- Allow users to view requests assigned to them
DROP POLICY IF EXISTS "Assigned users can view their requests" ON requests;
CREATE POLICY "Assigned users can view their requests"
  ON requests FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- Allow submitters to update their own requests (for certain fields)
DROP POLICY IF EXISTS "Submitters can update own requests" ON requests;
CREATE POLICY "Submitters can update own requests"
  ON requests FOR UPDATE
  TO authenticated
  USING (submitter_id = auth.uid());

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Auto-Assignment Permissions Fix Applied';
  RAISE NOTICE '===========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '1. Created apply_request_assignment_rules() function';
  RAISE NOTICE '2. Created trigger_auto_assign_on_insert trigger';
  RAISE NOTICE '3. Added RLS policy for assigned users';
  RAISE NOTICE '4. Added RLS policy for submitters to update';
  RAISE NOTICE '';
  RAISE NOTICE 'New requests will now automatically be assigned';
  RAISE NOTICE 'based on assignment rules in Settings.';
END $$;
