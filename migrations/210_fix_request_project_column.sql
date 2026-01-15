-- Migration 210: Fix missing converted_to_project_id column
-- Migration 206 trigger references this column but it was never added

-- Add the missing column to service_requests
ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS converted_to_project_id UUID REFERENCES projects(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_service_requests_converted_to_project
ON service_requests(converted_to_project_id)
WHERE converted_to_project_id IS NOT NULL;

SELECT 'Migration 210 complete: Added converted_to_project_id column to service_requests';
