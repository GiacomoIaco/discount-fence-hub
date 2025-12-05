-- ============================================
-- Migration 078: Price History Tables
-- ============================================
-- Tracks historical changes to material prices and labor rates
-- for audit trail and analytics purposes.

-- ============================================
-- 1. Material Price History Table
-- ============================================
CREATE TABLE IF NOT EXISTS material_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,

  -- Price change details
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2) NOT NULL,
  price_change DECIMAL(10,2) GENERATED ALWAYS AS (new_price - COALESCE(old_price, 0)) STORED,
  price_change_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN old_price IS NULL OR old_price = 0 THEN NULL
      ELSE ROUND(((new_price - old_price) / old_price * 100)::NUMERIC, 2)
    END
  ) STORED,

  -- Audit fields
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  change_source TEXT DEFAULT 'manual' CHECK (change_source IN ('manual', 'import', 'bulk_update', 'system')),

  -- Snapshot of material info at time of change
  material_code TEXT,
  material_name TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_material_price_history_material_id ON material_price_history(material_id);
CREATE INDEX IF NOT EXISTS idx_material_price_history_changed_at ON material_price_history(changed_at DESC);

-- ============================================
-- 2. Labor Rate History Table
-- ============================================
CREATE TABLE IF NOT EXISTS labor_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_rate_id UUID NOT NULL REFERENCES labor_rates(id) ON DELETE CASCADE,
  labor_code_id UUID REFERENCES labor_codes(id),
  business_unit_id UUID REFERENCES business_units(id),

  -- Rate change details
  old_rate DECIMAL(10,2),
  new_rate DECIMAL(10,2) NOT NULL,
  rate_change DECIMAL(10,2) GENERATED ALWAYS AS (new_rate - COALESCE(old_rate, 0)) STORED,
  rate_change_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN old_rate IS NULL OR old_rate = 0 THEN NULL
      ELSE ROUND(((new_rate - old_rate) / old_rate * 100)::NUMERIC, 2)
    END
  ) STORED,

  -- Audit fields
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  change_source TEXT DEFAULT 'manual' CHECK (change_source IN ('manual', 'import', 'bulk_update', 'system')),

  -- Snapshot of labor info at time of change
  labor_code TEXT,
  labor_description TEXT,
  business_unit_code TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_labor_rate_history_labor_rate_id ON labor_rate_history(labor_rate_id);
CREATE INDEX IF NOT EXISTS idx_labor_rate_history_changed_at ON labor_rate_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_labor_rate_history_labor_code_id ON labor_rate_history(labor_code_id);

-- ============================================
-- 3. RLS Policies
-- ============================================
ALTER TABLE material_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rate_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read history
CREATE POLICY "Authenticated users can view material price history"
  ON material_price_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view labor rate history"
  ON labor_rate_history FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert history (for logging)
CREATE POLICY "Authenticated users can insert material price history"
  ON material_price_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert labor rate history"
  ON labor_rate_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 4. Trigger Function: Log Material Price Changes
-- ============================================
CREATE OR REPLACE FUNCTION log_material_price_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if unit_cost actually changed
  IF OLD.unit_cost IS DISTINCT FROM NEW.unit_cost THEN
    INSERT INTO material_price_history (
      material_id,
      old_price,
      new_price,
      changed_by,
      change_source,
      material_code,
      material_name
    ) VALUES (
      NEW.id,
      OLD.unit_cost,
      NEW.unit_cost,
      auth.uid(),
      'manual',
      NEW.material_code,
      NEW.material_name
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Trigger Function: Log Labor Rate Changes
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
    -- Get labor code info
    SELECT code, description INTO v_labor_code, v_labor_description
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
-- 6. Create Triggers
-- ============================================
DROP TRIGGER IF EXISTS tr_material_price_change ON materials;
CREATE TRIGGER tr_material_price_change
  AFTER UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION log_material_price_change();

DROP TRIGGER IF EXISTS tr_labor_rate_change ON labor_rates;
CREATE TRIGGER tr_labor_rate_change
  AFTER UPDATE ON labor_rates
  FOR EACH ROW
  EXECUTE FUNCTION log_labor_rate_change();

-- ============================================
-- 7. Analytics Summary View
-- ============================================
CREATE OR REPLACE VIEW price_change_summary AS
SELECT
  'material' as type,
  COUNT(*) as total_changes,
  COUNT(DISTINCT material_id) as items_changed,
  AVG(price_change_percent) as avg_change_percent,
  MIN(changed_at) as first_change,
  MAX(changed_at) as last_change,
  DATE_TRUNC('month', changed_at) as change_month
FROM material_price_history
GROUP BY DATE_TRUNC('month', changed_at)

UNION ALL

SELECT
  'labor' as type,
  COUNT(*) as total_changes,
  COUNT(DISTINCT labor_rate_id) as items_changed,
  AVG(rate_change_percent) as avg_change_percent,
  MIN(changed_at) as first_change,
  MAX(changed_at) as last_change,
  DATE_TRUNC('month', changed_at) as change_month
FROM labor_rate_history
GROUP BY DATE_TRUNC('month', changed_at);

-- Grant access to the view
GRANT SELECT ON price_change_summary TO authenticated;
