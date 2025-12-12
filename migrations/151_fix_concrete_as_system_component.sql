-- ============================================
-- Migration 151: Fix Concrete as System Component
-- ============================================
-- In V1, concrete type is selected PER CALCULATION, not per SKU.
-- The SKU doesn't configure which concrete to use - that's decided when calculating a quote.
--
-- Fix:
-- 1. Mark all concrete components as "is_labor = false" and add a special system flag
-- 2. Remove them from product_type_components_v2 (they don't need material assignment)
-- 3. The SKU Builder will calculate concrete based on post_qty and concrete_type dropdown
-- 4. Add concrete materials to the materials table if not present
-- ============================================

-- 1. Remove concrete component assignments (they shouldn't appear in left panel)
DELETE FROM product_type_components_v2
WHERE component_type_id IN (
  SELECT id FROM component_types_v2
  WHERE code IN ('concrete_sand', 'concrete_portland', 'concrete_quickrock', 'concrete_yellow', 'concrete_red')
);

-- 2. Delete concrete formulas from formula_templates_v2
-- (we'll calculate concrete directly in code like V1 does)
DELETE FROM formula_templates_v2
WHERE component_type_id IN (
  SELECT id FROM component_types_v2
  WHERE code IN ('concrete_sand', 'concrete_portland', 'concrete_quickrock', 'concrete_yellow', 'concrete_red')
);

-- 3. Ensure concrete materials exist
-- These are the hardcoded materials V1 uses
INSERT INTO materials (material_sku, material_name, category, unit_type, unit_cost, status)
VALUES
  ('CTS', 'Concrete Sand', '09-Concrete', 'Bag', 5.00, 'Active'),
  ('CTP', 'Concrete Portland', '09-Concrete', 'Bag', 10.00, 'Active'),
  ('CTQ', 'Concrete Quickite', '09-Concrete', 'Bag', 8.00, 'Active'),
  ('CTY', 'Concrete Yellow Bags', '09-Concrete', 'Bag', 6.50, 'Active'),
  ('CTR', 'Concrete Red Bags', '09-Concrete', 'Bag', 7.00, 'Active')
ON CONFLICT (material_sku) DO NOTHING;

-- 4. Remove concrete_type variable from product types
-- (it's a calculation parameter, not a SKU property)
DELETE FROM product_variables_v2
WHERE variable_code = 'concrete_type';

-- 5. Verify changes
DO $$
DECLARE
  v_concrete_assignments INT;
  v_concrete_formulas INT;
  v_concrete_materials INT;
BEGIN
  SELECT COUNT(*) INTO v_concrete_assignments
  FROM product_type_components_v2
  WHERE component_type_id IN (
    SELECT id FROM component_types_v2 WHERE code LIKE 'concrete%'
  );

  SELECT COUNT(*) INTO v_concrete_formulas
  FROM formula_templates_v2
  WHERE component_type_id IN (
    SELECT id FROM component_types_v2 WHERE code LIKE 'concrete%'
  );

  SELECT COUNT(*) INTO v_concrete_materials
  FROM materials
  WHERE material_sku IN ('CTS', 'CTP', 'CTQ', 'CTY', 'CTR');

  RAISE NOTICE 'Concrete component assignments remaining: %', v_concrete_assignments;
  RAISE NOTICE 'Concrete formulas remaining: %', v_concrete_formulas;
  RAISE NOTICE 'Concrete materials in database: %', v_concrete_materials;
END $$;
