-- Add salesperson and lead_source columns to jobber_api_requests
-- These fields come from the Request's Assessment and source fields

ALTER TABLE jobber_api_requests
ADD COLUMN IF NOT EXISTS salesperson TEXT;

ALTER TABLE jobber_api_requests
ADD COLUMN IF NOT EXISTS lead_source TEXT;

ALTER TABLE jobber_api_requests
ADD COLUMN IF NOT EXISTS created_at_jobber TIMESTAMPTZ;

-- Add index for salesperson lookups
CREATE INDEX IF NOT EXISTS idx_api_requests_salesperson
ON jobber_api_requests(salesperson);

-- Add index for lead_source
CREATE INDEX IF NOT EXISTS idx_api_requests_lead_source
ON jobber_api_requests(lead_source);
