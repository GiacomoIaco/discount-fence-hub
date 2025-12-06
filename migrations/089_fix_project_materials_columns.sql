-- Migration: 089_fix_project_materials_columns.sql
-- Description: Add missing columns to project_materials and project_labor tables
-- These columns were added in migration 069 but may not have been applied

-- PROJECT MATERIALS
ALTER TABLE project_materials
ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_extended_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS adjusted_extended_cost DECIMAL(10,2);

-- PROJECT LABOR
ALTER TABLE project_labor
ADD COLUMN IF NOT EXISTS adjustment_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS calculated_extended_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS adjusted_extended_cost DECIMAL(10,2);
