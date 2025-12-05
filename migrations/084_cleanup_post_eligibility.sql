-- ============================================
-- Migration 084: Cleanup Post Eligibility Data
-- ============================================
-- Removes old category-based rules for posts so we can
-- add specific materials via the Component Configurator UI

-- Get post component ID and delete all its eligibility rules
DELETE FROM component_material_eligibility
WHERE component_id IN (
  SELECT id FROM component_definitions WHERE code = 'post'
);

-- Verify cleanup
-- SELECT COUNT(*) FROM component_material_eligibility
-- WHERE component_id IN (SELECT id FROM component_definitions WHERE code = 'post');
