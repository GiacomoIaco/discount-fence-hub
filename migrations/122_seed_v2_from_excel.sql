-- ============================================
-- Migration 122: Seed V2 Tables from Excel Data
-- ============================================
-- Populates V2 tables using data from:
-- "2025.12.09 DFU App - DB structure for Ops Hub.xlsx"
-- First 4 tabs: sku_catalog, product_styles, formula_templates, product_variables
-- ============================================

-- Clear existing data (in dependency order)
DELETE FROM sku_catalog_v2 WHERE true;
DELETE FROM formula_templates_v2 WHERE true;
DELETE FROM product_variables_v2 WHERE true;
DELETE FROM product_styles_v2 WHERE true;
DELETE FROM product_types_v2 WHERE true;

-- ============================================
-- PART 1: PRODUCT TYPES
-- ============================================
INSERT INTO product_types_v2 (code, name, description, default_post_spacing, display_order) VALUES
  ('wood-vertical', 'Wood Vertical', 'Traditional vertical picket fence', 8.0, 1),
  ('wood-horizontal', 'Wood Horizontal', 'Modern horizontal board fence', 8.0, 2),
  ('iron', 'Iron', 'Ornamental iron/steel fence', 6.0, 3),
  ('chain-link', 'Chain Link', 'Chain link fence', 10.0, 4),
  ('custom', 'Custom', 'Custom products, services, add-ons', NULL, 5);

-- ============================================
-- PART 2: PRODUCT STYLES
-- ============================================

-- Wood Vertical Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard', 'Standard', 'Basic privacy fence with pickets on one side', '{}', 1
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good-neighbor-residential', 'Good Neighbor Residential', 'Alternating pickets visible from both sides', '{"post_spacing": 7.71, "picket_multiplier": 1.11}', 2
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good-neighbor-builder', 'Good Neighbor Builder', 'Alternating pickets visible from both sides (does not use brackets)', '{"post_spacing": 7.71, "picket_multiplier": 1.11}', 3
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'board-on-board', 'Board on Board', '2 layers of pickets', '{"picket_multiplier": 1.14}', 4
FROM product_types_v2 WHERE code = 'wood-vertical';

-- Wood Horizontal Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard-horizontal', 'Standard Horizontal', 'Horizontal boards with vertical trim at posts', '{}', 1
FROM product_types_v2 WHERE code = 'wood-horizontal';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'good-neighbor-horizontal', 'Good Neighbor Horizontal', 'Horizontal boards visible from both sides', '{"board_multiplier": 2}', 2
FROM product_types_v2 WHERE code = 'wood-horizontal';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'exposed-posts-horizontal', 'Exposed Posts Horizontal', 'Alternating horizontal boards', '{}', 3
FROM product_types_v2 WHERE code = 'wood-horizontal';

-- Iron Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard-2-rail', 'Standard 2 Rail', '2 Rail panels (welded)', '{}', 1
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'standard-3-rail', 'Standard 3 Rail', '3 Rail panels with brackets', '{}', 2
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'ameristar', 'Ameristar', 'Ameristar Panels with Brackets', '{}', 3
FROM product_types_v2 WHERE code = 'iron';

-- Custom Styles
INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'product', 'Product', 'Products that do not have a dedicated product type!', '{}', 1
FROM product_types_v2 WHERE code = 'custom';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'service', 'Service', 'Usually labor only cost items', '{}', 2
FROM product_types_v2 WHERE code = 'custom';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'add-on', 'Add-on', 'Additional items', '{}', 3
FROM product_types_v2 WHERE code = 'custom';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'upgrade', 'Upgrade', 'Upgrade items', '{}', 4
FROM product_types_v2 WHERE code = 'custom';

INSERT INTO product_styles_v2 (product_type_id, code, name, description, formula_adjustments, display_order)
SELECT id, 'miscellaneous', 'Miscellaneous', 'Miscellaneous items', '{}', 5
FROM product_types_v2 WHERE code = 'custom';

-- ============================================
-- PART 3: PRODUCT VARIABLES
-- ============================================

-- Wood Vertical Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'height', 'Height', 'select', '6', ARRAY['6', '8'], true, 1
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'post_type', 'Post Type', 'select', 'WOOD', ARRAY['WOOD', 'STEEL'], true, 2
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'rail_count', 'Rail Count', 'select', '2', ARRAY['2', '3', '4'], true, 3
FROM product_types_v2 WHERE code = 'wood-vertical';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'select', '8', ARRAY['8', '7.71'], 'ft', true, 4
FROM product_types_v2 WHERE code = 'wood-vertical';

-- Wood Horizontal Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'height', 'Height', 'select', '6', ARRAY['6', '8'], true, 1
FROM product_types_v2 WHERE code = 'wood-horizontal';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'post_type', 'Post Type', 'select', 'WOOD', ARRAY['WOOD'], true, 2
FROM product_types_v2 WHERE code = 'wood-horizontal';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'select', '8', ARRAY['6', '8'], 'ft', true, 3
FROM product_types_v2 WHERE code = 'wood-horizontal';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'board_width', 'Board Width', 'select', '6', ARRAY['4', '6', '8'], 'in', false, 4
FROM product_types_v2 WHERE code = 'wood-horizontal';

-- Iron Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'height', 'Height', 'select', '4', ARRAY['3', '4', '5', '6'], true, 1
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'select', '6', ARRAY['6', '8'], 'ft', true, 2
FROM product_types_v2 WHERE code = 'iron';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'panel_width', 'Panel Width', 'select', '72', ARRAY['72', '96'], 'in', true, 3
FROM product_types_v2 WHERE code = 'iron';

-- Chain Link Variables
INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'height', 'Height', 'select', '4', ARRAY['4', '5', '6', '8', '10', '12'], true, 1
FROM product_types_v2 WHERE code = 'chain-link';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, is_required, display_order)
SELECT id, 'gauge', 'Gauge', 'select', '11', ARRAY['9', '11', '11.5'], true, 2
FROM product_types_v2 WHERE code = 'chain-link';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'mesh_size', 'Mesh Size', 'select', '2', ARRAY['2', '2.25'], 'in', true, 3
FROM product_types_v2 WHERE code = 'chain-link';

INSERT INTO product_variables_v2 (product_type_id, variable_code, variable_name, variable_type, default_value, allowed_values, unit, is_required, display_order)
SELECT id, 'post_spacing', 'Post Spacing', 'select', '10', ARRAY['8', '10'], 'ft', true, 4
FROM product_types_v2 WHERE code = 'chain-link';

-- ============================================
-- PART 4: UPDATE COMPONENT TYPES
-- ============================================
-- Add any missing component types from the SKU catalog columns

INSERT INTO component_types_v2 (code, name, description, unit_type, display_order) VALUES
  ('lag_screws', 'Lag Screws', 'Lag screws for steel post brackets', 'Box', 19),
  ('self_tapping_screws', 'Self Tapping Screws', 'Self tapping screws for steel posts', 'Box', 20),
  ('concrete', 'Concrete', 'System calculated concrete', 'System', 21)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Update nails_frame to nails_framing to match Excel
UPDATE component_types_v2 SET code = 'nails_framing' WHERE code = 'nails_frame';
-- ============================================
-- PART 5: SKU CATALOG (112 SKUs)
-- ============================================

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A01', '6'' Ver 1x6 : 2R : WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A02', '6'' Ver 1x6 : 2R : WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A03', '6'' Ver 1x6 : 2R : WOOD Post : C&T',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A04', '6'' Ver 1x6 : 3R : WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A05', '6'' Ver 1x6 : 3R : WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A06', '6'' Ver 1x6 : 3R : WOOD Post : C&T2',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN05","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A07', '6'' Ver 1x6 : 3R : WOOD Post : C&T4',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B01', '6'' Ver 1x4 : 2R : WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B02', '6'' Ver 1x4 : 2R : WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B03', '6'' Ver 1x4 : 2R : WOOD Post : C&T',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B04', '6'' Ver 1x4 : 3R : WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B05', '6'' Ver 1x4 : 3R : WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B06', '6'' Ver 1x4 : 3R : WOOD Post : C&T2',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN05","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B07', '6'' Ver 1x4 : 3R : WOOD Post : C&T4',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C01', '6'' Ver 1x6 : 2R : STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C02', '6'' Ver 1x6 : 2R : STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C03', '6'' Ver 1x6 : 2R : STEEL Post : C&T',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C04', '6'' Ver 1x6 : 3R : STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C05', '6'' Ver 1x6 : 3R : STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C06', '6'' Ver 1x6 : 3R : STEEL Post : C&T2',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN05","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C07', '6'' Ver 1x6 : 3R : STEEL Post : C&T4',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA01","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D01', '6'' Ver 1x4 : 2R : STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D02', '6'' Ver 1x4 : 2R : STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D03', '6'' Ver 1x4 : 2R : STEEL Post : C&T',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D04', '6'' Ver 1x4 : 3R : STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D05', '6'' Ver 1x4 : 3R : STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D06', '6'' Ver 1x4 : 3R : STEEL Post : C&T2',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN05","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D07', '6'' Ver 1x4 : 3R : STEEL Post : C&T4',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA01","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A01T', '6'' Ver 1x6 : 2R Tr: WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A02T', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A03T', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A04T', '6'' Ver 1x6 : 3R Tr: WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A05T', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A06T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN05","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A07T', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B01T', '6'' Ver 1x4 : 2R Tr: WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B02T', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B03T', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B04T', '6'' Ver 1x4 : 3R Tr: WOOD Post',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B05T', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B06T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN05","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B07T', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN07","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C01T', '6'' Ver 1x6 : 2R Tr: STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C02T', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C03T', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C04T', '6'' Ver 1x6 : 3R Tr: STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C05T', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C06T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN05","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C07T', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P601","rail":"RA02","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D01T', '6'' Ver 1x4 : 2R Tr: STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D02T', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D03T', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D04T', '6'' Ver 1x4 : 3R Tr: STEEL Post',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D05T', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D06T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN05","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D07T', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P401","rail":"RA02","cap":"CTN09","trim":"CTN07","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A01C', '6'' Ver 1x6 : 2R : WOOD Post - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A02C', '6'' Ver 1x6 : 2R : WOOD Post : GN - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A03C', '6'' Ver 1x6 : 2R : WOOD Post : C&T - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A04C', '6'' Ver 1x6 : 3R : WOOD Post - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A05C', '6'' Ver 1x6 : 3R : WOOD Post : GN - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A06C', '6'' Ver 1x6 : 3R : WOOD Post : C&T2 - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN05C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A07C', '6'' Ver 1x6 : 3R : WOOD Post : C&T4 - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B01C', '6'' Ver 1x4 : 2R : WOOD Post - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B02C', '6'' Ver 1x4 : 2R : WOOD Post : GN - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B03C', '6'' Ver 1x4 : 2R : WOOD Post : C&T - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B04C', '6'' Ver 1x4 : 3R : WOOD Post - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B05C', '6'' Ver 1x4 : 3R : WOOD Post : GN - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B06C', '6'' Ver 1x4 : 3R : WOOD Post : C&T2 - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN05C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B07C', '6'' Ver 1x4 : 3R : WOOD Post : C&T4 - Cedartone',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13C","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C01C', '6'' Ver 1x6 : 2R : STEEL Post - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C02C', '6'' Ver 1x6 : 2R : STEEL Post : GN - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C03C', '6'' Ver 1x6 : 2R : STEEL Post : C&T - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C04C', '6'' Ver 1x6 : 3R : STEEL Post - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C05C', '6'' Ver 1x6 : 3R : STEEL Post : GN - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C06C', '6'' Ver 1x6 : 3R : STEEL Post : C&T2 - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN05C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C07C', '6'' Ver 1x6 : 3R : STEEL Post : C&T4 - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P604","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D01C', '6'' Ver 1x4 : 2R : STEEL Post - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D02C', '6'' Ver 1x4 : 2R : STEEL Post : GN - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D03C', '6'' Ver 1x4 : 2R : STEEL Post : C&T - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D04C', '6'' Ver 1x4 : 3R : STEEL Post - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D05C', '6'' Ver 1x4 : 3R : STEEL Post : GN - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D06C', '6'' Ver 1x4 : 3R : STEEL Post : C&T2 - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN05C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D07C', '6'' Ver 1x4 : 3R : STEEL Post : C&T4 - Cedartone',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P404","rail":"RA01C","cap":"CTN09C","trim":"CTN07C","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A01O', '6'' Ver 1x6 : 2R Tr: WOOD Post - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A02O', '6'' Ver 1x6 : 2R Tr: WOOD Post : GN - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A03O', '6'' Ver 1x6 : 2R Tr: WOOD Post : C&T - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A04O', '6'' Ver 1x6 : 3R Tr: WOOD Post - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A05O', '6'' Ver 1x6 : 3R Tr: WOOD Post : GN - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A06O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T2 - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":"CTN05O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'A07O', '6'' Ver 1x6 : 3R Tr: WOOD Post : C&T4 - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B01O', '6'' Ver 1x4 : 2R Tr: WOOD Post - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B02O', '6'' Ver 1x4 : 2R Tr: WOOD Post : GN - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B03O', '6'' Ver 1x4 : 2R Tr: WOOD Post : C&T - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B04O', '6'' Ver 1x4 : 3R Tr: WOOD Post - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B05O', '6'' Ver 1x4 : 3R Tr: WOOD Post : GN - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B06O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T2 - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN05O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'B07O', '6'' Ver 1x4 : 3R Tr: WOOD Post : C&T4 - Oxford',
  pt.id, ps.id, 6, 'WOOD',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS13O","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C01O', '6'' Ver 1x6 : 2R Tr: STEEL Post - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C02O', '6'' Ver 1x6 : 2R Tr: STEEL Post : GN - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C03O', '6'' Ver 1x6 : 2R Tr: STEEL Post : C&T - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":" ","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C04O', '6'' Ver 1x6 : 3R Tr: STEEL Post - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C05O', '6'' Ver 1x6 : 3R Tr: STEEL Post : GN - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C06O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T2 - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":"CTN05O","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'C07O', '6'' Ver 1x6 : 3R Tr: STEEL Post : C&T4 - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P605","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D01O', '6'' Ver 1x4 : 2R Tr: STEEL Post - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D02O', '6'' Ver 1x4 : 2R Tr: STEEL Post : GN - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D03O', '6'' Ver 1x4 : 2R Tr: STEEL Post : C&T - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":2,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D04O', '6'' Ver 1x4 : 3R Tr: STEEL Post - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","steel_post_cap":"PC01","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D05O', '6'' Ver 1x4 : 3R Tr: STEEL Post : GN - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":7.71}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","steel_post_cap":"PC01","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'good-neighbor-builder'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D06O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T2 - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN05O","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';

INSERT INTO sku_catalog_v2 (sku_code, sku_name, product_type_id, product_style_id, height, post_type, variables, components)
SELECT 'D07O', '6'' Ver 1x4 : 3R Tr: STEEL Post : C&T4 - Oxford',
  pt.id, ps.id, 6, 'STEEL',
  '{"rail_count":3,"post_spacing":8}'::jsonb,
  '{"post":"PS04","picket":"P405","rail":"RA01O","cap":"CTN09O","trim":"CTN07O","steel_post_cap":"PC02","bracket":"HW06","nails_picket":"HW08","nails_framing":"HW07","self_tapping_screws":"HW09","concrete":"SYSTEM"}'::jsonb
FROM product_types_v2 pt
JOIN product_styles_v2 ps ON ps.product_type_id = pt.id AND ps.code = 'standard'
WHERE pt.code = 'wood-vertical';


