-- Add missing pricing quote columns
-- These columns are used by the pricing request workflow but were never added to the schema

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS pricing_quote DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quoted_by UUID REFERENCES auth.users(id);

-- Add index for pricing analytics
CREATE INDEX IF NOT EXISTS idx_requests_pricing_quote ON requests(pricing_quote) WHERE pricing_quote IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Added pricing_quote, quoted_at, quoted_by columns to requests table';
END $$;
