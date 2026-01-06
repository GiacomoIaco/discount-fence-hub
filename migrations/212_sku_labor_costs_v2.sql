-- Migration 212: SKU Labor Costs V2
-- Stores pre-calculated labor costs per SKU per Business Unit
-- Material costs are universal; labor costs vary by BU due to different labor rates
-- ============================================

-- Create the junction table for V2 SKU labor costs
CREATE TABLE IF NOT EXISTS sku_labor_costs_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id UUID NOT NULL REFERENCES sku_catalog_v2(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,

  -- Labor costs (calculated based on 100 LF standard)
  labor_cost DECIMAL(10,2) NOT NULL DEFAULT 0,         -- Total labor cost for 100 LF
  labor_cost_per_foot DECIMAL(10,4) NOT NULL DEFAULT 0, -- Labor cost per 1 LF

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One labor cost per SKU per Business Unit
  UNIQUE(sku_id, business_unit_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sku_labor_costs_v2_sku
  ON sku_labor_costs_v2(sku_id);

CREATE INDEX IF NOT EXISTS idx_sku_labor_costs_v2_bu
  ON sku_labor_costs_v2(business_unit_id);

-- Comments for documentation
COMMENT ON TABLE sku_labor_costs_v2 IS 'Pre-calculated labor costs per SKU per Business Unit for V2 SKU Catalog';
COMMENT ON COLUMN sku_labor_costs_v2.sku_id IS 'Foreign key to sku_catalog_v2';
COMMENT ON COLUMN sku_labor_costs_v2.business_unit_id IS 'Business Unit - labor rates vary by BU';
COMMENT ON COLUMN sku_labor_costs_v2.labor_cost IS 'Total labor cost based on standard 100 LF calculation';
COMMENT ON COLUMN sku_labor_costs_v2.labor_cost_per_foot IS 'Labor cost per linear foot (labor_cost / 100)';

-- Enable RLS
ALTER TABLE sku_labor_costs_v2 ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view sku_labor_costs_v2"
  ON sku_labor_costs_v2 FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert sku_labor_costs_v2"
  ON sku_labor_costs_v2 FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update sku_labor_costs_v2"
  ON sku_labor_costs_v2 FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated can delete sku_labor_costs_v2"
  ON sku_labor_costs_v2 FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_sku_labor_costs_v2_updated_at
  BEFORE UPDATE ON sku_labor_costs_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();
