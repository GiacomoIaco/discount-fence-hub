-- ============================================
-- Migration 083: Fence-Type Specific Filter Attributes
-- ============================================
-- Moves filter_attribute and filter_values from component_definitions
-- to a new junction table, so different fence types can have different
-- filter configurations for the same component.
--
-- Example:
-- - Post component for wood_vertical: filtered by post_type (WOOD, STEEL)
-- - Post component for iron: no filter (just iron posts)

-- ============================================
-- 1. Create fence-type-component configuration table
-- ============================================
CREATE TABLE IF NOT EXISTS fence_type_component_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fence_type TEXT NOT NULL CHECK (fence_type IN ('wood_vertical', 'wood_horizontal', 'iron')),
  component_id UUID NOT NULL REFERENCES component_definitions(id) ON DELETE CASCADE,

  -- Filter configuration for this fence type + component combination
  filter_attribute TEXT,  -- e.g., 'post_type', 'style'
  filter_values TEXT[],   -- e.g., ['WOOD', 'STEEL'] or ['Standard 2 Rail', 'Ameristar']

  -- Display settings
  display_order INT DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(fence_type, component_id)
);

-- RLS
ALTER TABLE fence_type_component_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ftcc_select" ON fence_type_component_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "ftcc_all" ON fence_type_component_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 2. Populate from existing component_definitions
-- ============================================
-- Wood Vertical components
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'wood_vertical', id,
  CASE WHEN code = 'post' THEN 'post_type' ELSE NULL END,
  CASE WHEN code = 'post' THEN ARRAY['WOOD', 'STEEL'] ELSE NULL END,
  display_order
FROM component_definitions
WHERE is_active = true AND 'wood_vertical' = ANY(fence_types);

-- Wood Horizontal components
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'wood_horizontal', id,
  CASE WHEN code = 'post' THEN 'post_type' ELSE NULL END,
  CASE WHEN code = 'post' THEN ARRAY['WOOD', 'STEEL'] ELSE NULL END,
  display_order
FROM component_definitions
WHERE is_active = true AND 'wood_horizontal' = ANY(fence_types);

-- Iron components (NO filter for posts - they're always iron)
INSERT INTO fence_type_component_config (fence_type, component_id, filter_attribute, filter_values, display_order)
SELECT 'iron', id,
  CASE
    WHEN code = 'panel' THEN 'style'
    WHEN code = 'bracket' THEN 'style'
    ELSE NULL
  END,
  CASE
    WHEN code = 'panel' THEN ARRAY['Standard 2 Rail', 'Standard 3 Rail', 'Ameristar']
    WHEN code = 'bracket' THEN ARRAY['Ameristar']
    ELSE NULL
  END,
  display_order
FROM component_definitions
WHERE is_active = true AND 'iron' = ANY(fence_types);

-- ============================================
-- 3. Create view that joins config with components
-- ============================================
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

-- ============================================
-- 4. Remove global filter_attribute from component_definitions
-- (Keep columns but set to NULL - can remove later)
-- ============================================
UPDATE component_definitions SET filter_attribute = NULL, filter_values = NULL;
