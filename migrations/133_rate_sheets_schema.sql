-- Migration: Rate Sheets - Phase 4 of O-027
-- Supports both hard-coded prices AND formula-based pricing rules

-- ============================================
-- RATE SHEETS (Price Lists)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE,                   -- e.g., 'PERRY-STD', 'AUSTIN-COMM'
  description TEXT,

  -- Type: 'custom' = hard-coded prices, 'formula' = calculated from rules, 'hybrid' = both
  pricing_type VARCHAR(20) DEFAULT 'custom', -- 'custom', 'formula', 'hybrid'

  -- Default pricing rules (when pricing_type is 'formula' or 'hybrid')
  -- These apply to SKUs not explicitly listed in rate_sheet_items
  default_labor_markup DECIMAL(5,2) DEFAULT 0,        -- % markup on labor
  default_material_markup DECIMAL(5,2) DEFAULT 0,     -- % markup on materials
  default_margin_target DECIMAL(5,2),                 -- Target gross margin %

  -- Validity
  effective_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_template BOOLEAN DEFAULT false,         -- Template rate sheets can be cloned

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),
  updated_by UUID REFERENCES user_profiles(id)
);

-- ============================================
-- RATE SHEET ITEMS (Individual SKU Prices)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_sheet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id UUID NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,                      -- References sku_catalog

  -- Pricing method for this item
  pricing_method VARCHAR(20) DEFAULT 'fixed', -- 'fixed', 'markup', 'margin', 'cost_plus'

  -- Fixed pricing (when pricing_method = 'fixed')
  fixed_price DECIMAL(10,2),                 -- Hard-coded sell price
  fixed_labor_price DECIMAL(10,2),           -- Hard-coded labor component (optional)
  fixed_material_price DECIMAL(10,2),        -- Hard-coded material component (optional)

  -- Formula pricing (when pricing_method != 'fixed')
  labor_markup_percent DECIMAL(5,2),         -- % markup on base labor cost
  material_markup_percent DECIMAL(5,2),      -- % markup on base material cost
  margin_target_percent DECIMAL(5,2),        -- Target gross margin %

  -- Unit info (can override SKU default)
  unit VARCHAR(20),                          -- 'LF', 'EA', 'SF', etc.
  min_quantity DECIMAL(10,2) DEFAULT 1,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(rate_sheet_id, sku_id)
);

-- ============================================
-- RATE SHEET ASSIGNMENTS
-- Tracks which clients/communities use which rate sheets
-- ============================================

CREATE TABLE IF NOT EXISTS rate_sheet_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id UUID NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,

  -- Can be assigned to client OR community (not both)
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

  -- Assignment type
  is_default BOOLEAN DEFAULT false,          -- Is this the default for this client/community?
  priority INTEGER DEFAULT 0,                -- Higher = takes precedence

  -- Validity
  effective_date DATE DEFAULT CURRENT_DATE,
  expires_at DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),

  CONSTRAINT assignment_has_target CHECK (
    (client_id IS NOT NULL AND community_id IS NULL) OR
    (client_id IS NULL AND community_id IS NOT NULL)
  )
);

-- ============================================
-- RATE SHEET HISTORY (Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS rate_sheet_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_sheet_id UUID NOT NULL REFERENCES rate_sheets(id) ON DELETE CASCADE,

  action VARCHAR(20) NOT NULL,               -- 'created', 'updated', 'item_added', 'item_updated', 'item_removed'

  -- What changed
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,

  -- For item changes
  sku_id UUID,
  item_changes JSONB,                        -- {field: {old, new}}

  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by UUID REFERENCES user_profiles(id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rate_sheets_code ON rate_sheets(code);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_is_active ON rate_sheets(is_active);
CREATE INDEX IF NOT EXISTS idx_rate_sheets_is_template ON rate_sheets(is_template);

CREATE INDEX IF NOT EXISTS idx_rate_sheet_items_rate_sheet_id ON rate_sheet_items(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_items_sku_id ON rate_sheet_items(sku_id);

CREATE INDEX IF NOT EXISTS idx_rate_sheet_assignments_rate_sheet_id ON rate_sheet_assignments(rate_sheet_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_assignments_client_id ON rate_sheet_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_rate_sheet_assignments_community_id ON rate_sheet_assignments(community_id);

CREATE INDEX IF NOT EXISTS idx_rate_sheet_history_rate_sheet_id ON rate_sheet_history(rate_sheet_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE rate_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheet_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_sheet_history ENABLE ROW LEVEL SECURITY;

-- Rate sheets: All can read, admin/ops/sales-manager can write
DROP POLICY IF EXISTS "rate_sheets_read" ON rate_sheets;
CREATE POLICY "rate_sheets_read" ON rate_sheets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_sheets_write" ON rate_sheets;
CREATE POLICY "rate_sheets_write" ON rate_sheets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "rate_sheet_items_read" ON rate_sheet_items;
CREATE POLICY "rate_sheet_items_read" ON rate_sheet_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_sheet_items_write" ON rate_sheet_items;
CREATE POLICY "rate_sheet_items_write" ON rate_sheet_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "rate_sheet_assignments_read" ON rate_sheet_assignments;
CREATE POLICY "rate_sheet_assignments_read" ON rate_sheet_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_sheet_assignments_write" ON rate_sheet_assignments;
CREATE POLICY "rate_sheet_assignments_write" ON rate_sheet_assignments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'operations', 'sales-manager'))
);

DROP POLICY IF EXISTS "rate_sheet_history_read" ON rate_sheet_history;
CREATE POLICY "rate_sheet_history_read" ON rate_sheet_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rate_sheet_history_write" ON rate_sheet_history;
CREATE POLICY "rate_sheet_history_write" ON rate_sheet_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- ADD FK TO CLIENTS AND COMMUNITIES
-- ============================================

-- Add FK constraint to clients.default_rate_sheet_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'clients_default_rate_sheet_id_fkey'
  ) THEN
    ALTER TABLE clients
    ADD CONSTRAINT clients_default_rate_sheet_id_fkey
    FOREIGN KEY (default_rate_sheet_id) REFERENCES rate_sheets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add FK constraint to communities.rate_sheet_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'communities_rate_sheet_id_fkey'
  ) THEN
    ALTER TABLE communities
    ADD CONSTRAINT communities_rate_sheet_id_fkey
    FOREIGN KEY (rate_sheet_id) REFERENCES rate_sheets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- HELPER FUNCTION: Get effective rate sheet for a community
-- ============================================

CREATE OR REPLACE FUNCTION get_effective_rate_sheet(p_community_id UUID)
RETURNS UUID AS $$
DECLARE
  v_rate_sheet_id UUID;
  v_client_id UUID;
BEGIN
  -- First check if community has its own rate sheet
  SELECT rate_sheet_id, client_id INTO v_rate_sheet_id, v_client_id
  FROM communities
  WHERE id = p_community_id;

  IF v_rate_sheet_id IS NOT NULL THEN
    RETURN v_rate_sheet_id;
  END IF;

  -- Fall back to client's default rate sheet
  SELECT default_rate_sheet_id INTO v_rate_sheet_id
  FROM clients
  WHERE id = v_client_id;

  RETURN v_rate_sheet_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Get price for SKU from rate sheet
-- Returns NULL if no price defined (use catalog price)
-- ============================================

CREATE OR REPLACE FUNCTION get_rate_sheet_price(
  p_rate_sheet_id UUID,
  p_sku_id UUID,
  p_base_cost DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  price DECIMAL(10,2),
  labor_price DECIMAL(10,2),
  material_price DECIMAL(10,2),
  pricing_method VARCHAR(20)
) AS $$
DECLARE
  v_item rate_sheet_items%ROWTYPE;
  v_sheet rate_sheets%ROWTYPE;
  v_calc_price DECIMAL(10,2);
BEGIN
  -- Get the rate sheet item if exists
  SELECT * INTO v_item
  FROM rate_sheet_items
  WHERE rate_sheet_id = p_rate_sheet_id AND sku_id = p_sku_id;

  IF FOUND THEN
    -- Item exists in rate sheet
    IF v_item.pricing_method = 'fixed' THEN
      RETURN QUERY SELECT
        v_item.fixed_price,
        v_item.fixed_labor_price,
        v_item.fixed_material_price,
        v_item.pricing_method;
    ELSIF v_item.pricing_method = 'markup' AND p_base_cost IS NOT NULL THEN
      v_calc_price := p_base_cost * (1 + COALESCE(v_item.material_markup_percent, 0) / 100);
      RETURN QUERY SELECT
        v_calc_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        v_item.pricing_method;
    ELSIF v_item.pricing_method = 'margin' AND p_base_cost IS NOT NULL AND v_item.margin_target_percent IS NOT NULL THEN
      -- Price = Cost / (1 - Margin%)
      v_calc_price := p_base_cost / (1 - v_item.margin_target_percent / 100);
      RETURN QUERY SELECT
        v_calc_price,
        NULL::DECIMAL(10,2),
        NULL::DECIMAL(10,2),
        v_item.pricing_method;
    ELSE
      -- Return fixed price if available, otherwise null
      RETURN QUERY SELECT
        v_item.fixed_price,
        v_item.fixed_labor_price,
        v_item.fixed_material_price,
        v_item.pricing_method;
    END IF;
  ELSE
    -- No item in rate sheet, check if sheet has default rules
    SELECT * INTO v_sheet FROM rate_sheets WHERE id = p_rate_sheet_id;

    IF v_sheet.pricing_type IN ('formula', 'hybrid') AND p_base_cost IS NOT NULL THEN
      -- Apply default markup
      IF v_sheet.default_margin_target IS NOT NULL THEN
        v_calc_price := p_base_cost / (1 - v_sheet.default_margin_target / 100);
      ELSIF v_sheet.default_material_markup IS NOT NULL THEN
        v_calc_price := p_base_cost * (1 + v_sheet.default_material_markup / 100);
      END IF;

      IF v_calc_price IS NOT NULL THEN
        RETURN QUERY SELECT
          v_calc_price,
          NULL::DECIMAL(10,2),
          NULL::DECIMAL(10,2),
          'default_formula'::VARCHAR(20);
      END IF;
    END IF;
  END IF;

  -- No price found
  RETURN;
END;
$$ LANGUAGE plpgsql;
