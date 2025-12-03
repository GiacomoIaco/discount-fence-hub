-- Migration: Add unique constraint to labor_rates table
-- Required for upsert operations on labor_code_id + business_unit_id

-- First, remove any duplicate rows (keep the most recent one)
DELETE FROM labor_rates a
USING labor_rates b
WHERE a.id < b.id
  AND a.labor_code_id = b.labor_code_id
  AND a.business_unit_id = b.business_unit_id;

-- Add unique constraint
ALTER TABLE labor_rates
ADD CONSTRAINT labor_rates_labor_code_id_business_unit_id_key
UNIQUE (labor_code_id, business_unit_id);

-- Add comment
COMMENT ON CONSTRAINT labor_rates_labor_code_id_business_unit_id_key ON labor_rates
IS 'Ensures only one rate per labor code per business unit';
