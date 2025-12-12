-- ============================================
-- Migration 146: Fix Formula Variable Names
-- ============================================
-- The FormulaInterpreter now stores calculated values with _qty suffix
-- to avoid collision with input variables (e.g., rail_count is both
-- an input variable AND a calculated result).
--
-- Changes:
-- - [post_count] -> [post_qty] (calculated post quantity)
-- - [picket_count] -> [picket_qty] (calculated picket quantity)
-- - [panel_count] -> [panel_qty] (calculated panel quantity)
-- - [board_count] -> [board_qty] (calculated board quantity)
-- - [nailer_count] -> [nailer_qty] (calculated nailer quantity)
--
-- Keeps unchanged:
-- - [rail_count] - this is the INPUT variable (2 or 3 rails per section)
-- - [height], [Quantity], [Lines], [Gates] - project inputs
-- ============================================

-- Update all formulas that reference [post_count]
UPDATE formula_templates_v2
SET formula = REPLACE(formula, '[post_count]', '[post_qty]')
WHERE formula LIKE '%[post_count]%';

-- Update all formulas that reference [picket_count]
UPDATE formula_templates_v2
SET formula = REPLACE(formula, '[picket_count]', '[picket_qty]')
WHERE formula LIKE '%[picket_count]%';

-- Update all formulas that reference [panel_count]
UPDATE formula_templates_v2
SET formula = REPLACE(formula, '[panel_count]', '[panel_qty]')
WHERE formula LIKE '%[panel_count]%';

-- Update all formulas that reference [board_count]
UPDATE formula_templates_v2
SET formula = REPLACE(formula, '[board_count]', '[board_qty]')
WHERE formula LIKE '%[board_count]%';

-- Update all formulas that reference [nailer_count]
UPDATE formula_templates_v2
SET formula = REPLACE(formula, '[nailer_count]', '[nailer_qty]')
WHERE formula LIKE '%[nailer_count]%';

-- Verify the changes
DO $$
DECLARE
  v_updated_count INT;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM formula_templates_v2
  WHERE formula LIKE '%_qty%';

  RAISE NOTICE 'Updated % formulas to use _qty suffix', v_updated_count;
END $$;
