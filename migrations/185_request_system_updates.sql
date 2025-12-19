-- Migration 185: Request System Updates (R-007)
-- Updates service_requests for new request flow:
-- - Request types: new_quote, repair, warranty (renamed from new_business, change_order)
-- - Product types: multi-select array instead of single value
-- - Quick-add leads: is_lead flag on clients table

-- ============================================
-- 1. ADD PRODUCT_TYPES ARRAY TO SERVICE_REQUESTS
-- ============================================

-- Add product_types array column (multi-select)
ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS product_types TEXT[] DEFAULT '{}';

-- Add request_type column if not exists (was using just VARCHAR)
-- and set default to 'new_quote'
DO $$
BEGIN
  -- Check if request_type column exists, add if not
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_requests' AND column_name = 'request_type'
  ) THEN
    ALTER TABLE service_requests ADD COLUMN request_type VARCHAR(50) DEFAULT 'new_quote';
  END IF;
END $$;

-- Migrate existing product_type values to product_types array
UPDATE service_requests
SET product_types = ARRAY[product_type]
WHERE product_type IS NOT NULL AND product_types = '{}';

-- Migrate existing request_type values to new names
UPDATE service_requests SET request_type = 'new_quote' WHERE request_type = 'new_business';
UPDATE service_requests SET request_type = 'repair' WHERE request_type = 'change_order';

-- Create index for product_types array queries
CREATE INDEX IF NOT EXISTS idx_requests_product_types ON service_requests USING GIN(product_types);

-- Create index for request_type queries
CREATE INDEX IF NOT EXISTS idx_requests_request_type ON service_requests(request_type);

-- ============================================
-- 2. ADD IS_LEAD FLAG TO CLIENTS TABLE
-- ============================================

-- Add is_lead column for quick-add leads (like Jobber)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_lead BOOLEAN DEFAULT false;

-- Create index for lead filtering
CREATE INDEX IF NOT EXISTS idx_clients_is_lead ON clients(is_lead);

-- ============================================
-- 3. ADD BUSINESS_UNIT_ID TO SERVICE_REQUESTS
-- ============================================

-- Add business_unit_id for BU-based filtering and assignment
ALTER TABLE service_requests
ADD COLUMN IF NOT EXISTS business_unit_id UUID REFERENCES business_units(id);

-- Create index for BU filtering
CREATE INDEX IF NOT EXISTS idx_requests_business_unit ON service_requests(business_unit_id);

-- ============================================
-- 4. COMMENTS
-- ============================================

COMMENT ON COLUMN service_requests.product_types IS 'Multi-select product types for the request (Wood Vertical, Iron, etc.)';
COMMENT ON COLUMN service_requests.request_type IS 'Type of request: new_quote, repair, warranty';
COMMENT ON COLUMN service_requests.business_unit_id IS 'Business unit for BU-based rep filtering';
COMMENT ON COLUMN clients.is_lead IS 'Quick-add lead flag - true for minimal-info leads added during request creation';
