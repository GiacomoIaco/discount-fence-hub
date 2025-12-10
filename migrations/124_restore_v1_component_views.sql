-- ============================================
-- FIX: Restore V1 component views that were dropped
-- These views are needed by ComponentConfiguratorPage
-- ============================================

-- 1. Recreate v_fence_type_components view
CREATE OR REPLACE VIEW v_fence_type_components AS
SELECT
  ftcc.fence_type,
  ftcc.component_id,
  cd.code AS component_code,
  cd.name AS component_name,
  cd.description AS component_description,
  cd.default_category,
  cd.default_sub_category,
  cd.is_required,
  ftcc.filter_attribute,
  ftcc.filter_values,
  ftcc.display_order,
  ftcc.is_visible
FROM fence_type_component_config ftcc
JOIN component_definitions cd ON cd.id = ftcc.component_id
WHERE cd.is_active = true AND ftcc.is_visible = true
ORDER BY ftcc.fence_type, ftcc.display_order;

GRANT SELECT ON v_fence_type_components TO authenticated;

-- 2. Recreate v_component_eligible_materials view
DROP VIEW IF EXISTS v_component_eligible_materials;

CREATE VIEW v_component_eligible_materials AS
WITH expanded_rules AS (
  -- Category-based rules
  SELECT
    cme.fence_type,
    cme.component_id,
    cd.code AS component_code,
    cd.name AS component_name,
    cd.filter_attribute,
    cd.filter_values,
    cme.attribute_filter,
    m.id AS material_id,
    m.material_sku,
    m.material_name,
    m.category,
    m.sub_category,
    m.unit_cost,
    m.length_ft,
    m.actual_width,
    cme.display_order,
    cme.selection_mode
  FROM component_material_eligibility cme
  JOIN component_definitions cd ON cd.id = cme.component_id
  JOIN materials m ON m.status = 'Active'
    AND m.category = cme.material_category
    AND (cme.material_subcategory IS NULL OR m.sub_category = cme.material_subcategory)
    AND (cme.min_length_ft IS NULL OR m.length_ft >= cme.min_length_ft)
    AND (cme.max_length_ft IS NULL OR m.length_ft <= cme.max_length_ft)
  WHERE cme.selection_mode IN ('category', 'subcategory')
    AND cme.is_active = true
    AND cd.is_active = true

  UNION

  -- Specific material rules
  SELECT
    cme.fence_type,
    cme.component_id,
    cd.code AS component_code,
    cd.name AS component_name,
    cd.filter_attribute,
    cd.filter_values,
    cme.attribute_filter,
    m.id AS material_id,
    m.material_sku,
    m.material_name,
    m.category,
    m.sub_category,
    m.unit_cost,
    m.length_ft,
    m.actual_width,
    cme.display_order,
    cme.selection_mode
  FROM component_material_eligibility cme
  JOIN component_definitions cd ON cd.id = cme.component_id
  JOIN materials m ON m.id = cme.material_id AND m.status = 'Active'
  WHERE cme.selection_mode = 'specific'
    AND cme.is_active = true
    AND cd.is_active = true
)
SELECT DISTINCT ON (fence_type, component_id, COALESCE(attribute_filter::text, ''), material_id)
  fence_type,
  component_id,
  component_code,
  component_name,
  filter_attribute,
  filter_values,
  attribute_filter,
  material_id,
  material_sku,
  material_name,
  category,
  sub_category,
  unit_cost,
  length_ft,
  actual_width,
  display_order,
  selection_mode
FROM expanded_rules
ORDER BY fence_type, component_id, COALESCE(attribute_filter::text, ''), material_id, display_order;

GRANT SELECT ON v_component_eligible_materials TO authenticated;
