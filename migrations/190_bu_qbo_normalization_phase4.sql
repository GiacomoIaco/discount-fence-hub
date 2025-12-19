-- Migration 190: BU/QBO Normalization - Phase 4 (Transactions)
-- Adds qbo_class_id to service_requests, quotes, and jobs tables
-- This allows transactions to be tagged with the correct QBO Class for accounting

-- ============================================================
-- 4.1 Add qbo_class_id to service_requests
-- ============================================================
ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);

-- Add FK constraint (qbo_classes.id is VARCHAR)
-- Note: qbo_classes uses string IDs from QuickBooks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_service_requests_qbo_class'
  ) THEN
    ALTER TABLE service_requests
      ADD CONSTRAINT fk_service_requests_qbo_class
      FOREIGN KEY (qbo_class_id) REFERENCES qbo_classes(id);
  END IF;
END $$;

-- ============================================================
-- 4.2 Add qbo_class_id to quotes
-- ============================================================
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_quotes_qbo_class'
  ) THEN
    ALTER TABLE quotes
      ADD CONSTRAINT fk_quotes_qbo_class
      FOREIGN KEY (qbo_class_id) REFERENCES qbo_classes(id);
  END IF;
END $$;

-- ============================================================
-- 4.3 Add qbo_class_id to jobs
-- ============================================================
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS qbo_class_id VARCHAR(50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_jobs_qbo_class'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT fk_jobs_qbo_class
      FOREIGN KEY (qbo_class_id) REFERENCES qbo_classes(id);
  END IF;
END $$;

-- ============================================================
-- 4.4 Create indexes for qbo_class_id lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_service_requests_qbo_class ON service_requests(qbo_class_id);
CREATE INDEX IF NOT EXISTS idx_quotes_qbo_class ON quotes(qbo_class_id);
CREATE INDEX IF NOT EXISTS idx_jobs_qbo_class ON jobs(qbo_class_id);

-- ============================================================
-- 4.5 Migrate existing service_requests with business_unit_id
-- Map to qbo_class_id using the client's default or derive from BU + location
-- ============================================================
-- For existing requests, try to derive QBO class from client's default
UPDATE service_requests sr
SET qbo_class_id = c.default_qbo_class_id
FROM clients c
WHERE sr.client_id = c.id
  AND sr.qbo_class_id IS NULL
  AND c.default_qbo_class_id IS NOT NULL;

-- ============================================================
-- Note: business_unit_id is kept on service_requests for now
-- It will be deprecated in Phase 6 after UI is updated
-- ============================================================

-- ============================================================
-- Verification queries (run manually)
-- ============================================================
-- SELECT id, request_number, qbo_class_id, business_unit_id FROM service_requests;
-- SELECT id, qbo_class_id FROM quotes LIMIT 5;
-- SELECT id, qbo_class_id FROM jobs LIMIT 5;
