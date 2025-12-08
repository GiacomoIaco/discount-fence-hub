-- Migration: Fix labor_rates update functionality
-- Issue: O-023 - Labor rate edits fail with "column 'code' does not exist"
-- Root cause: Trigger function log_labor_rate_change() references wrong column name

-- ============================================
-- 1. Fix the trigger function (main issue)
-- The function references 'code' but labor_codes table has 'labor_sku'
-- ============================================
CREATE OR REPLACE FUNCTION log_labor_rate_change()
RETURNS TRIGGER AS $$
DECLARE
  v_labor_code TEXT;
  v_labor_description TEXT;
  v_bu_code TEXT;
BEGIN
  -- Only log if rate actually changed
  IF OLD.rate IS DISTINCT FROM NEW.rate THEN
    -- Get labor code info (FIXED: was 'code', should be 'labor_sku')
    SELECT labor_sku, description INTO v_labor_code, v_labor_description
    FROM labor_codes WHERE id = NEW.labor_code_id;

    -- Get business unit code
    SELECT code INTO v_bu_code
    FROM business_units WHERE id = NEW.business_unit_id;

    INSERT INTO labor_rate_history (
      labor_rate_id,
      labor_code_id,
      business_unit_id,
      old_rate,
      new_rate,
      changed_by,
      change_source,
      labor_code,
      labor_description,
      business_unit_code
    ) VALUES (
      NEW.id,
      NEW.labor_code_id,
      NEW.business_unit_id,
      OLD.rate,
      NEW.rate,
      auth.uid(),
      'manual',
      v_labor_code,
      v_labor_description,
      v_bu_code
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Fix RLS UPDATE policies (add WITH CHECK for upsert)
-- ============================================
DROP POLICY IF EXISTS "labor_rates_admin_update" ON labor_rates;
CREATE POLICY "labor_rates_admin_update" ON labor_rates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "labor_codes_admin_update" ON labor_codes;
CREATE POLICY "labor_codes_admin_update" ON labor_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );
