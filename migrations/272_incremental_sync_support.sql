-- Add updated_at_jobber column to track Jobber's updatedAt per record
-- This enables incremental sync by filtering on updatedAt instead of fetching all records

ALTER TABLE jobber_api_quotes ADD COLUMN IF NOT EXISTS updated_at_jobber TIMESTAMPTZ;
ALTER TABLE jobber_api_jobs ADD COLUMN IF NOT EXISTS updated_at_jobber TIMESTAMPTZ;
ALTER TABLE jobber_api_requests ADD COLUMN IF NOT EXISTS updated_at_jobber TIMESTAMPTZ;
