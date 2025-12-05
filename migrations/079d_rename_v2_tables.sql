-- ============================================
-- Migration 079d: Rename V2 Tables
-- ============================================
-- Renames bom_calculator_v2 tables to have _v2 suffix
-- This allows the new component system to use the clean names

-- Drop views first (they depend on the tables)
DROP VIEW IF EXISTS v_component_eligible_materials CASCADE;
DROP VIEW IF EXISTS sku_components_view CASCADE;

-- Rename tables with _v2 suffix
ALTER TABLE IF EXISTS component_definitions RENAME TO component_definitions_v2;
ALTER TABLE IF EXISTS product_type_components RENAME TO product_type_components_v2;
ALTER TABLE IF EXISTS formula_parameters RENAME TO formula_parameters_v2;
ALTER TABLE IF EXISTS component_formulas RENAME TO component_formulas_v2;
ALTER TABLE IF EXISTS component_material_rules RENAME TO component_material_rules_v2;
ALTER TABLE IF EXISTS sku_components RENAME TO sku_components_v2;

-- Rename indexes to match new table names
ALTER INDEX IF EXISTS component_definitions_pkey RENAME TO component_definitions_v2_pkey;
ALTER INDEX IF EXISTS component_definitions_code_key RENAME TO component_definitions_v2_code_key;
ALTER INDEX IF EXISTS product_type_components_pkey RENAME TO product_type_components_v2_pkey;
ALTER INDEX IF EXISTS formula_parameters_pkey RENAME TO formula_parameters_v2_pkey;
ALTER INDEX IF EXISTS component_formulas_pkey RENAME TO component_formulas_v2_pkey;
ALTER INDEX IF EXISTS component_material_rules_pkey RENAME TO component_material_rules_v2_pkey;
ALTER INDEX IF EXISTS sku_components_pkey RENAME TO sku_components_v2_pkey;

-- Rename constraints on product_type_components_v2
ALTER TABLE IF EXISTS product_type_components_v2
  RENAME CONSTRAINT product_type_components_component_id_fkey
  TO product_type_components_v2_component_id_fkey;

ALTER TABLE IF EXISTS product_type_components_v2
  RENAME CONSTRAINT product_type_components_product_type_id_fkey
  TO product_type_components_v2_product_type_id_fkey;

-- Rename constraints on formula_parameters_v2
ALTER TABLE IF EXISTS formula_parameters_v2
  RENAME CONSTRAINT formula_parameters_component_id_fkey
  TO formula_parameters_v2_component_id_fkey;

-- Rename constraints on component_formulas_v2
ALTER TABLE IF EXISTS component_formulas_v2
  RENAME CONSTRAINT component_formulas_component_id_fkey
  TO component_formulas_v2_component_id_fkey;

-- Rename constraints on component_material_rules_v2
ALTER TABLE IF EXISTS component_material_rules_v2
  RENAME CONSTRAINT component_material_rules_component_id_fkey
  TO component_material_rules_v2_component_id_fkey;

-- Rename constraints on sku_components_v2
ALTER TABLE IF EXISTS sku_components_v2
  RENAME CONSTRAINT sku_components_sku_id_fkey
  TO sku_components_v2_sku_id_fkey;

ALTER TABLE IF EXISTS sku_components_v2
  RENAME CONSTRAINT sku_components_component_id_fkey
  TO sku_components_v2_component_id_fkey;

ALTER TABLE IF EXISTS sku_components_v2
  RENAME CONSTRAINT sku_components_material_id_fkey
  TO sku_components_v2_material_id_fkey;

-- Recreate the view with new table names
-- Note: v2 component_definitions uses 'category' not 'default_category'
CREATE OR REPLACE VIEW v_component_eligible_materials_v2 AS
SELECT
  cd.id AS component_id,
  cd.code AS component_code,
  cd.name AS component_name,
  m.id AS material_id,
  m.material_sku,
  m.material_name,
  m.category,
  m.sub_category,
  m.unit_cost,
  m.length_ft,
  m.actual_width
FROM component_definitions_v2 cd
CROSS JOIN materials m
WHERE m.status = 'Active';

-- Update RLS policy names if they exist
DO $$
BEGIN
  -- Drop old policies if they exist
  DROP POLICY IF EXISTS "component_definitions_select" ON component_definitions_v2;
  DROP POLICY IF EXISTS "component_definitions_all" ON component_definitions_v2;
  DROP POLICY IF EXISTS "product_type_components_select" ON product_type_components_v2;
  DROP POLICY IF EXISTS "product_type_components_all" ON product_type_components_v2;
  DROP POLICY IF EXISTS "formula_parameters_select" ON formula_parameters_v2;
  DROP POLICY IF EXISTS "formula_parameters_all" ON formula_parameters_v2;
  DROP POLICY IF EXISTS "component_formulas_select" ON component_formulas_v2;
  DROP POLICY IF EXISTS "component_formulas_all" ON component_formulas_v2;
  DROP POLICY IF EXISTS "component_material_rules_select" ON component_material_rules_v2;
  DROP POLICY IF EXISTS "component_material_rules_all" ON component_material_rules_v2;

  -- Recreate policies with _v2 names
  CREATE POLICY "component_definitions_v2_select" ON component_definitions_v2
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "component_definitions_v2_all" ON component_definitions_v2
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE POLICY "product_type_components_v2_select" ON product_type_components_v2
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "product_type_components_v2_all" ON product_type_components_v2
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE POLICY "formula_parameters_v2_select" ON formula_parameters_v2
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "formula_parameters_v2_all" ON formula_parameters_v2
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE POLICY "component_formulas_v2_select" ON component_formulas_v2
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "component_formulas_v2_all" ON component_formulas_v2
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

  CREATE POLICY "component_material_rules_v2_select" ON component_material_rules_v2
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "component_material_rules_v2_all" ON component_material_rules_v2
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- Table doesn't exist, skip
END $$;

-- Add comment to mark these as legacy v2 tables
COMMENT ON TABLE component_definitions_v2 IS 'Legacy v2 table - not in active use';
COMMENT ON TABLE product_type_components_v2 IS 'Legacy v2 table - not in active use';
COMMENT ON TABLE formula_parameters_v2 IS 'Legacy v2 table - not in active use';
COMMENT ON TABLE component_formulas_v2 IS 'Legacy v2 table - not in active use';
COMMENT ON TABLE component_material_rules_v2 IS 'Legacy v2 table - not in active use';
COMMENT ON TABLE sku_components_v2 IS 'Legacy v2 table - not in active use';
