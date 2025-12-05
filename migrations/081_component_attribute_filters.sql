-- ============================================
-- Migration 081: Component Attribute Filters
-- ============================================
-- Adds attribute-based filtering to component material eligibility
-- e.g., Post materials filtered by post_type (WOOD/STEEL)
-- e.g., Panel materials filtered by style (Standard 2 Rail, Ameristar)

-- ============================================
-- 1. Add attribute_filter column
-- ============================================
ALTER TABLE component_material_eligibility
ADD COLUMN IF NOT EXISTS attribute_filter JSONB DEFAULT NULL;

COMMENT ON COLUMN component_material_eligibility.attribute_filter IS
'Filter condition based on product attributes. E.g., {"post_type": "WOOD"} or {"style": "Ameristar"}';

-- ============================================
-- 2. Add filter_attribute to component_definitions
-- ============================================
-- Defines which attribute (if any) this component is filtered by
ALTER TABLE component_definitions
ADD COLUMN IF NOT EXISTS filter_attribute TEXT DEFAULT NULL;

ALTER TABLE component_definitions
ADD COLUMN IF NOT EXISTS filter_values TEXT[] DEFAULT NULL;

COMMENT ON COLUMN component_definitions.filter_attribute IS
'Attribute name that filters this component. E.g., "post_type" for posts, "style" for panels';

COMMENT ON COLUMN component_definitions.filter_values IS
'Possible values for the filter attribute. E.g., ["WOOD", "STEEL"] or ["Standard 2 Rail", "Ameristar"]';

-- ============================================
-- 3. Update component definitions with filter attributes
-- ============================================

-- Post component: filtered by post_type
UPDATE component_definitions
SET filter_attribute = 'post_type',
    filter_values = ARRAY['WOOD', 'STEEL']
WHERE code = 'post';

-- Panel component (iron): filtered by style
UPDATE component_definitions
SET filter_attribute = 'style',
    filter_values = ARRAY['Standard 2 Rail', 'Standard 3 Rail', 'Ameristar']
WHERE code = 'panel';

-- Bracket component (iron): only for Ameristar style
UPDATE component_definitions
SET filter_attribute = 'style',
    filter_values = ARRAY['Ameristar']
WHERE code = 'bracket';

-- ============================================
-- 4. Update existing eligibility rules with attribute filters
-- ============================================

-- Get component IDs
DO $$
DECLARE
  v_post_id UUID;
  v_panel_id UUID;
  v_bracket_id UUID;
BEGIN
  SELECT id INTO v_post_id FROM component_definitions WHERE code = 'post';
  SELECT id INTO v_panel_id FROM component_definitions WHERE code = 'panel';
  SELECT id INTO v_bracket_id FROM component_definitions WHERE code = 'bracket';

  -- Update Wood Vertical post rules
  UPDATE component_material_eligibility
  SET attribute_filter = '{"post_type": "WOOD"}'::jsonb
  WHERE fence_type = 'wood_vertical'
    AND component_id = v_post_id
    AND material_subcategory = 'Wood';

  UPDATE component_material_eligibility
  SET attribute_filter = '{"post_type": "STEEL"}'::jsonb
  WHERE fence_type = 'wood_vertical'
    AND component_id = v_post_id
    AND material_subcategory = 'Steel';

  -- Update Wood Horizontal post rules
  UPDATE component_material_eligibility
  SET attribute_filter = '{"post_type": "WOOD"}'::jsonb
  WHERE fence_type = 'wood_horizontal'
    AND component_id = v_post_id
    AND material_subcategory = 'Wood';

  UPDATE component_material_eligibility
  SET attribute_filter = '{"post_type": "STEEL"}'::jsonb
  WHERE fence_type = 'wood_horizontal'
    AND component_id = v_post_id
    AND material_subcategory = 'Steel';

  -- Iron posts are always steel, no attribute filter needed
  -- (they don't have post_type selection)

  -- Update Iron panel rule - applies to all styles for now
  -- User can add specific style rules via UI

  -- Bracket only for Ameristar
  UPDATE component_material_eligibility
  SET attribute_filter = '{"style": "Ameristar"}'::jsonb
  WHERE fence_type = 'iron'
    AND component_id = v_bracket_id;

END $$;

-- ============================================
-- 5. Update the view to include attribute_filter
-- ============================================
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

-- ============================================
-- 6. Remove iron_picket component (not used - panels are prefab)
-- ============================================
UPDATE component_definitions
SET is_active = false
WHERE code = 'iron_picket';

-- Also remove rail from iron (rails are part of panels)
UPDATE component_definitions
SET fence_types = array_remove(fence_types, 'iron')
WHERE code = 'rail';
