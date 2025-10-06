-- Add missing columns to requests table
-- These columns are used by the Request interface but were not in the original schema

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Untitled Request',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT,
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS fence_type TEXT,
  ADD COLUMN IF NOT EXISTS linear_feet INTEGER,
  ADD COLUMN IF NOT EXISTS square_footage INTEGER,
  ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS deadline TEXT,
  ADD COLUMN IF NOT EXISTS special_requirements TEXT,
  ADD COLUMN IF NOT EXISTS voice_recording_url TEXT,
  ADD COLUMN IF NOT EXISTS voice_duration INTEGER,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_confidence DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- Remove the default from title after adding the column
ALTER TABLE requests ALTER COLUMN title DROP DEFAULT;

-- Update submitter_id to use submitted_at timestamp
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_requests_customer_name ON requests(customer_name);
CREATE INDEX IF NOT EXISTS idx_requests_urgency ON requests(urgency);
CREATE INDEX IF NOT EXISTS idx_requests_deadline ON requests(deadline);
