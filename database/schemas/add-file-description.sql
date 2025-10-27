-- Add description field to sales_resources_files table
-- Run this in Supabase SQL Editor

ALTER TABLE sales_resources_files
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for faster searches on description
CREATE INDEX IF NOT EXISTS idx_sales_resources_files_description
ON sales_resources_files USING gin(to_tsvector('english', description));
