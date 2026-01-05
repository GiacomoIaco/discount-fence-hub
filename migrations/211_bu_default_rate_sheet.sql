-- Migration 211: Add default rate sheet per Business Unit (QBO Class)
--
-- Purpose: Provide a fallback rate sheet when client/community don't have one assigned.
-- Each BU (ATX-RES, ATX-HB, SA-RES, etc.) can have its own default rate sheet.
--
-- Price Resolution Priority:
-- 1. Community rate sheet (community.rate_sheet_id)
-- 2. Client rate sheet (client.default_rate_sheet_id)
-- 3. BU default rate sheet (qbo_class.default_rate_sheet_id) ← NEW
-- 4. No rate sheet (use cost as price + show warning)

-- Add the column to qbo_classes
ALTER TABLE qbo_classes
ADD COLUMN IF NOT EXISTS default_rate_sheet_id UUID REFERENCES rate_sheets(id) ON DELETE SET NULL;

COMMENT ON COLUMN qbo_classes.default_rate_sheet_id IS
  'Default rate sheet for this Business Unit - used when client/community have no rate sheet assigned';

-- Create index for lookup performance
CREATE INDEX IF NOT EXISTS idx_qbo_classes_default_rate_sheet
ON qbo_classes(default_rate_sheet_id) WHERE default_rate_sheet_id IS NOT NULL;

-- Drop ALL versions of the function using a loop over pg_proc
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_effective_rate_sheet'
    AND n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func_oid::regprocedure);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors
  NULL;
END $$;

-- Create the function with 3 parameters for BU fallback
CREATE FUNCTION get_effective_rate_sheet(
  p_community_id UUID DEFAULT NULL,
  p_client_id UUID DEFAULT NULL,
  p_qbo_class_id VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_rate_sheet_id UUID;
  v_client_id UUID;
BEGIN
  -- Priority 1: Community rate sheet
  IF p_community_id IS NOT NULL THEN
    SELECT rate_sheet_id, client_id INTO v_rate_sheet_id, v_client_id
    FROM communities
    WHERE id = p_community_id;

    IF v_rate_sheet_id IS NOT NULL THEN
      RETURN v_rate_sheet_id;
    END IF;

    -- Store client_id for fallback
    p_client_id := COALESCE(p_client_id, v_client_id);
  END IF;

  -- Priority 2: Client default rate sheet
  IF p_client_id IS NOT NULL THEN
    SELECT default_rate_sheet_id INTO v_rate_sheet_id
    FROM clients
    WHERE id = p_client_id;

    IF v_rate_sheet_id IS NOT NULL THEN
      RETURN v_rate_sheet_id;
    END IF;
  END IF;

  -- Priority 3: QBO Class (BU) default rate sheet (NEW)
  IF p_qbo_class_id IS NOT NULL THEN
    SELECT default_rate_sheet_id INTO v_rate_sheet_id
    FROM qbo_classes
    WHERE id = p_qbo_class_id;

    IF v_rate_sheet_id IS NOT NULL THEN
      RETURN v_rate_sheet_id;
    END IF;
  END IF;

  -- No rate sheet found
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_effective_rate_sheet(UUID, UUID, VARCHAR) IS
  'Returns the effective rate sheet ID based on priority: community > client > BU default';
