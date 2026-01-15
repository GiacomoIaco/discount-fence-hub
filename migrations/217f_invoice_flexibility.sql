-- Migration 217f: Invoice Flexibility
-- PART 6 of Request-Project Lifecycle Architecture

-- Make job_id nullable (invoice can cover whole project, not single job)
ALTER TABLE invoices
  ALTER COLUMN job_id DROP NOT NULL;

-- Add job reference to line items for granular tracking
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);

SELECT 'Migration 217f complete: Invoice flexibility';
