-- ============================================
-- Migration 147: Fix Steel Component Formulas
-- ============================================
-- The bracket and steel_post_cap formulas use IF([post_type]==STEEL,...)
-- but the FormulaInterpreter doesn't support IF() syntax.
--
-- Solution: Remove the IF() wrapper. The V2 SKU Builder uses component
-- visibility conditions to control whether these components are included.
-- The formula should just be the calculation - visibility rules handle
-- whether the component appears.
--
-- Changes:
-- - bracket: IF([post_type]==STEEL,[post_qty]*[rail_count],0)
--           -> [post_qty]*[rail_count]
-- - steel_post_cap: IF([post_type]==STEEL,[post_qty],0)
--                  -> [post_qty]
-- ============================================

-- Fix bracket formula
UPDATE formula_templates_v2
SET formula = '[post_qty]*[rail_count]',
    notes = 'Brackets per post×rails. Component visibility handles STEEL-only logic.'
WHERE formula LIKE 'IF([post_type]==STEEL,[post_qty]*[rail_count]%'
  AND formula NOT LIKE '%*2%';

-- Fix bracket formula for good-neighbor (has *2)
UPDATE formula_templates_v2
SET formula = '[post_qty]*[rail_count]*2',
    notes = 'Good Neighbor: 2 brackets per connection. Visibility handles STEEL-only.'
WHERE formula LIKE 'IF([post_type]==STEEL,[post_qty]*[rail_count]*2%';

-- Fix steel_post_cap formula
UPDATE formula_templates_v2
SET formula = '[post_qty]',
    notes = 'One cap per steel post. Component visibility handles STEEL-only logic.'
WHERE formula LIKE 'IF([post_type]==STEEL,[post_qty]%';

-- Verify changes
DO $$
DECLARE
  v_remaining_if INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining_if
  FROM formula_templates_v2
  WHERE formula LIKE 'IF(%';

  IF v_remaining_if > 0 THEN
    RAISE NOTICE 'Warning: % formulas still contain IF() syntax', v_remaining_if;
  ELSE
    RAISE NOTICE 'Success: All IF() formulas have been simplified';
  END IF;
END $$;
