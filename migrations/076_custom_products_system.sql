-- ============================================
-- CUSTOM PRODUCTS SYSTEM
-- Created: 2025-12-04
-- Purpose: Flexible products/services that don't fit structured fence patterns
-- Examples: TOFO, Staining, Lock Upgrades, etc.
-- ============================================

-- ============================================
-- MAIN TABLE: Custom Products
-- ============================================

CREATE TABLE custom_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku_code TEXT UNIQUE NOT NULL,
  sku_name TEXT NOT NULL,

  -- Unit basis for pricing
  unit_basis TEXT NOT NULL CHECK (unit_basis IN ('LF', 'SF', 'EA', 'PROJECT')),
  -- LF = Linear Feet, SF = Square Feet, EA = Each/Unit, PROJECT = Flat rate

  -- Cached costs (updated on save)
  standard_material_cost DECIMAL(10,2) DEFAULT 0,
  standard_labor_cost DECIMAL(10,2) DEFAULT 0,
  standard_cost_per_unit DECIMAL(10,2) DEFAULT 0,
  standard_cost_calculated_at TIMESTAMPTZ,

  -- Metadata
  product_description TEXT,
  category TEXT, -- e.g., 'Service', 'Add-On', 'Repair', 'Upgrade'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- JUNCTION TABLE: Custom Product Materials
-- ============================================

CREATE TABLE custom_product_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  custom_product_id UUID NOT NULL REFERENCES custom_products(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materials(id),

  -- Quantity per unit (e.g., 1 lock per EA, 0.5 bags per SF)
  quantity_per_unit DECIMAL(10,4) NOT NULL DEFAULT 1,

  -- Optional notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(custom_product_id, material_id)
);

-- ============================================
-- JUNCTION TABLE: Custom Product Labor
-- ============================================

CREATE TABLE custom_product_labor (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  custom_product_id UUID NOT NULL REFERENCES custom_products(id) ON DELETE CASCADE,
  labor_code_id UUID NOT NULL REFERENCES labor_codes(id),

  -- Quantity per unit (e.g., 1 LF of labor per 1 LF of service)
  quantity_per_unit DECIMAL(10,4) NOT NULL DEFAULT 1,

  -- Optional notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(custom_product_id, labor_code_id)
);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_custom_products_updated_at
  BEFORE UPDATE ON custom_products
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_custom_products_sku ON custom_products(sku_code);
CREATE INDEX idx_custom_products_active ON custom_products(is_active) WHERE is_active = true;
CREATE INDEX idx_custom_products_category ON custom_products(category);

CREATE INDEX idx_custom_product_materials_product ON custom_product_materials(custom_product_id);
CREATE INDEX idx_custom_product_materials_material ON custom_product_materials(material_id);

CREATE INDEX idx_custom_product_labor_product ON custom_product_labor(custom_product_id);
CREATE INDEX idx_custom_product_labor_code ON custom_product_labor(labor_code_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE custom_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_product_labor ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "Anyone can view custom products"
  ON custom_products FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view custom product materials"
  ON custom_product_materials FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view custom product labor"
  ON custom_product_labor FOR SELECT
  USING (true);

-- Write access for all authenticated users (adjust as needed)
CREATE POLICY "Authenticated users can insert custom products"
  ON custom_products FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update custom products"
  ON custom_products FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete custom products"
  ON custom_products FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert custom product materials"
  ON custom_product_materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update custom product materials"
  ON custom_product_materials FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete custom product materials"
  ON custom_product_materials FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert custom product labor"
  ON custom_product_labor FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update custom product labor"
  ON custom_product_labor FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete custom product labor"
  ON custom_product_labor FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- SEED DATA: Common Custom Products
-- ============================================

INSERT INTO custom_products (sku_code, sku_name, unit_basis, category, product_description, is_active) VALUES
  ('TOFO', 'Tear Out & Haul Off', 'LF', 'Service', 'Remove existing fence and haul away debris', true),
  ('STAIN-EXIST', 'Stain Existing Fence', 'LF', 'Service', 'Stain/seal existing wood fence (outsourced)', true),
  ('LOCK-UPG', 'Gate Lock Upgrade', 'EA', 'Upgrade', 'Upgrade gate lock hardware', true),
  ('ROCK-FEE', 'Rock Fee', 'LF', 'Service', 'Additional charge for rocky soil conditions', true)
ON CONFLICT (sku_code) DO NOTHING;

-- Link TOFO to labor code W01
INSERT INTO custom_product_labor (custom_product_id, labor_code_id, quantity_per_unit)
SELECT
  cp.id,
  lc.id,
  1.0
FROM custom_products cp
CROSS JOIN labor_codes lc
WHERE cp.sku_code = 'TOFO' AND lc.labor_sku = 'W01'
ON CONFLICT (custom_product_id, labor_code_id) DO NOTHING;

-- Link ROCK-FEE to labor code LB04
INSERT INTO custom_product_labor (custom_product_id, labor_code_id, quantity_per_unit)
SELECT
  cp.id,
  lc.id,
  1.0
FROM custom_products cp
CROSS JOIN labor_codes lc
WHERE cp.sku_code = 'ROCK-FEE' AND lc.labor_sku = 'LB04'
ON CONFLICT (custom_product_id, labor_code_id) DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE custom_products IS 'Flexible products/services with custom material and labor combinations';
COMMENT ON TABLE custom_product_materials IS 'Materials assigned to custom products with quantity per unit';
COMMENT ON TABLE custom_product_labor IS 'Labor codes assigned to custom products with quantity per unit';
COMMENT ON COLUMN custom_products.unit_basis IS 'LF=Linear Feet, SF=Square Feet, EA=Each, PROJECT=Flat Rate';
COMMENT ON COLUMN custom_product_materials.quantity_per_unit IS 'How many of this material per 1 unit of the product';
COMMENT ON COLUMN custom_product_labor.quantity_per_unit IS 'How many units of this labor per 1 unit of the product';
