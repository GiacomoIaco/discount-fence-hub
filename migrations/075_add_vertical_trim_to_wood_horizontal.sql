-- Migration: 075_add_vertical_trim_to_wood_horizontal
-- Description: Add vertical_trim_material_id column to wood_horizontal_products
-- This allows SKUs to define which trim material covers post faces on horizontal fences

-- Add the column
ALTER TABLE wood_horizontal_products
ADD COLUMN IF NOT EXISTS vertical_trim_material_id UUID REFERENCES materials(id);

-- Add comment for documentation
COMMENT ON COLUMN wood_horizontal_products.vertical_trim_material_id IS
  'Optional: Material for vertical trim boards that cover post faces. Standard uses posts×1, Good Neighbor uses posts×2.';
