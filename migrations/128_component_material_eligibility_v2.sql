-- ============================================
-- Migration 128: Component Material Eligibility V2
-- ============================================
-- Creates V2 version of component_material_eligibility
-- Uses UUID product_type_id instead of enum fence_type
-- ============================================

-- V2 Material Eligibility Table
CREATE TABLE IF NOT EXISTS component_material_eligibility_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id UUID NOT NULL REFERENCES product_types_v2(id) ON DELETE CASCADE,
  component_type_id UUID NOT NULL REFERENCES component_types_v2(id) ON DELETE CASCADE,

  -- Selection mode: which materials to include
  selection_mode TEXT NOT NULL CHECK (selection_mode IN ('category', 'subcategory', 'specific')),

  -- For category/subcategory mode
  material_category TEXT,
  material_subcategory TEXT,

  -- For specific mode
  material_id UUID REFERENCES materials(id) ON DELETE CASCADE,

  -- Variable-based filter (e.g., {"post_type": "WOOD"})
  attribute_filter JSONB,

  -- Length range filter (optional)
  min_length_ft DECIMAL(10,2),
  max_length_ft DECIMAL(10,2),

  notes TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_cme_v2_product_type ON component_material_eligibility_v2(product_type_id);
CREATE INDEX idx_cme_v2_component ON component_material_eligibility_v2(component_type_id);
CREATE INDEX idx_cme_v2_material ON component_material_eligibility_v2(material_id) WHERE material_id IS NOT NULL;
CREATE INDEX idx_cme_v2_category ON component_material_eligibility_v2(material_category) WHERE material_category IS NOT NULL;

-- RLS
ALTER TABLE component_material_eligibility_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cme_v2_select" ON component_material_eligibility_v2;
DROP POLICY IF EXISTS "cme_v2_all" ON component_material_eligibility_v2;

CREATE POLICY "cme_v2_select" ON component_material_eligibility_v2
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cme_v2_all" ON component_material_eligibility_v2
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_cme_v2_updated_at
  BEFORE UPDATE ON component_material_eligibility_v2
  FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();

-- ============================================
-- View: Expanded eligible materials for V2
-- ============================================
DROP VIEW IF EXISTS v_component_eligible_materials_v2;
CREATE VIEW v_component_eligible_materials_v2 AS
SELECT
  cme.product_type_id,
  pt.code AS product_type_code,
  cme.component_type_id,
  ct.code AS component_code,
  ct.name AS component_name,
  cme.attribute_filter,
  m.id AS material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_cost,
  m.length_ft
FROM component_material_eligibility_v2 cme
JOIN product_types_v2 pt ON pt.id = cme.product_type_id
JOIN component_types_v2 ct ON ct.id = cme.component_type_id
JOIN materials m ON (
  -- Specific material match
  (cme.selection_mode = 'specific' AND m.id = cme.material_id)
  OR
  -- Category match (all materials in category)
  (cme.selection_mode = 'category' AND m.category = cme.material_category)
  OR
  -- Subcategory match
  (cme.selection_mode = 'subcategory' AND m.category = cme.material_category AND m.sub_category = cme.material_subcategory)
)
WHERE cme.is_active = true
  AND m.status = 'Active'
  AND (cme.min_length_ft IS NULL OR m.length_ft >= cme.min_length_ft)
  AND (cme.max_length_ft IS NULL OR m.length_ft <= cme.max_length_ft);

GRANT SELECT ON v_component_eligible_materials_v2 TO authenticated;

-- ============================================
-- SUMMARY
-- ============================================
-- New table: component_material_eligibility_v2
--   - Uses product_type_id (UUID) instead of fence_type (enum)
--   - Otherwise identical to V1 structure
-- New view: v_component_eligible_materials_v2
--   - Expands eligibility rules to material rows
