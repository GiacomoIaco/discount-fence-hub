-- Add CTN05O (Oxford variant of CTN05)
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
WHERE material_sku = 'CTN05'
  AND NOT EXISTS (SELECT 1 FROM materials WHERE material_sku = 'CTN05O');
