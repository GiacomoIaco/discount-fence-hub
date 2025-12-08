-- ============================================
-- Migration 113: Add Pre-stained Material Variants
-- ============================================
-- Creates Cedartone (C) and Oxford (O) variants of existing materials
-- by copying the base material and updating SKU and name

-- Helper function to create a variant if it doesn't exist
-- PS13 → PS13C (Cedartone) and PS13O (Oxford)
INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'C',
  material_name || ' - Cedartone',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'PS13'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'PS13C');

INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'O',
  material_name || ' - Oxford',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'PS13'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'PS13O');

-- RA01 → RA01C (Cedartone) and RA01O (Oxford)
INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'C',
  material_name || ' - Cedartone',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'RA01'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'RA01C');

INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'O',
  material_name || ' - Oxford',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'RA01'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'RA01O');

-- CTN09 → CTN09C (Cedartone) and CTN09O (Oxford)
INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'C',
  material_name || ' - Cedartone',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'CTN09'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN09C');

INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'O',
  material_name || ' - Oxford',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'CTN09'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN09O');

-- CTN07 → CTN07C (Cedartone) and CTN07O (Oxford)
INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'C',
  material_name || ' - Cedartone',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'CTN07'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN07C');

INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'O',
  material_name || ' - Oxford',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'CTN07'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN07O');

-- CTN05 → CTN05C (Cedartone) - needed for C&T2 variants
INSERT INTO materials (
  material_sku, material_name, category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, created_at
)
SELECT
  material_sku || 'C',
  material_name || ' - Cedartone',
  category, sub_category,
  unit_cost, unit_type, length_ft, actual_width,
  status, component_uses, NOW()
FROM materials
WHERE material_sku = 'CTN05'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN05C');
