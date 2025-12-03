-- Migration: Create sku_labor_costs table
-- Stores pre-calculated labor costs per SKU per Business Unit
-- Labor rates are stable, so we store calculated values for performance

-- Create the junction table for SKU labor costs
CREATE TABLE IF NOT EXISTS sku_labor_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type TEXT NOT NULL CHECK (product_type IN ('wood-vertical', 'wood-horizontal', 'iron')),
  product_id UUID NOT NULL,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  labor_cost DECIMAL(10,2) NOT NULL DEFAULT 0, -- Total labor cost (100ft, 4 lines basis)
  labor_cost_per_foot DECIMAL(10,4) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one labor cost per SKU per BU
  UNIQUE(product_type, product_id, business_unit_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sku_labor_costs_product
  ON sku_labor_costs(product_type, product_id);

CREATE INDEX IF NOT EXISTS idx_sku_labor_costs_bu
  ON sku_labor_costs(business_unit_id);

-- Add comments for documentation
COMMENT ON TABLE sku_labor_costs IS 'Pre-calculated labor costs per SKU per Business Unit';
COMMENT ON COLUMN sku_labor_costs.product_type IS 'Type of product: wood-vertical, wood-horizontal, or iron';
COMMENT ON COLUMN sku_labor_costs.product_id IS 'Foreign key to the specific product table';
COMMENT ON COLUMN sku_labor_costs.labor_cost IS 'Total labor cost based on standard assumptions (100ft, 4 lines)';
COMMENT ON COLUMN sku_labor_costs.labor_cost_per_foot IS 'Labor cost per linear foot';

-- Enable RLS
ALTER TABLE sku_labor_costs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow authenticated users to read, admins to write
CREATE POLICY "Anyone can view sku_labor_costs"
  ON sku_labor_costs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert sku_labor_costs"
  ON sku_labor_costs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update sku_labor_costs"
  ON sku_labor_costs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete sku_labor_costs"
  ON sku_labor_costs FOR DELETE
  TO authenticated
  USING (true);
