-- Migration 227: Fix invoice line items carryover
--
-- Problem: copy_job_line_items_to_invoice function tries to insert columns
-- that don't exist (job_id, line_type, unit_type, total_price)
--
-- Solution:
-- 1. Add missing columns to invoice_line_items
-- 2. Fix the copy function to use correct column names

-- ============================================
-- 1. Add missing columns to invoice_line_items
-- ============================================

-- Add job_id for tracking source job
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Add line_type for categorization
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS line_type TEXT DEFAULT 'material'
  CHECK (line_type IN ('material', 'labor', 'service', 'adjustment', 'discount'));

-- Add unit_type for display
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'EA';

-- Add index for job lookup
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_job ON invoice_line_items(job_id);

-- ============================================
-- 2. Fix copy_job_line_items_to_invoice function
-- ============================================

CREATE OR REPLACE FUNCTION copy_job_line_items_to_invoice(
  p_job_id UUID,
  p_invoice_id UUID
) RETURNS void AS $$
BEGIN
  -- Copy all line items from job to invoice
  INSERT INTO invoice_line_items (
    invoice_id,
    job_id,
    line_type,
    description,
    quantity,
    unit_type,
    unit_price,
    total,  -- Correct column name (not total_price)
    quote_line_item_id,
    sort_order
  )
  SELECT
    p_invoice_id,
    p_job_id,
    line_type,
    description,
    COALESCE(actual_quantity, quantity),  -- Use actual if available
    unit_type,
    unit_price,
    COALESCE(actual_quantity, quantity) * unit_price AS total,
    quote_line_item_id,  -- Maintain link to original quote line item
    sort_order
  FROM job_line_items
  WHERE job_id = p_job_id
  ORDER BY sort_order;

  -- Also update invoice totals from line items
  UPDATE invoices
  SET
    subtotal = (
      SELECT COALESCE(SUM(total), 0)
      FROM invoice_line_items
      WHERE invoice_id = p_invoice_id
    ),
    total = (
      SELECT COALESCE(SUM(total), 0)
      FROM invoice_line_items
      WHERE invoice_id = p_invoice_id
    ),
    balance_due = (
      SELECT COALESCE(SUM(total), 0) - COALESCE(amount_paid, 0)
      FROM invoice_line_items
      WHERE invoice_id = p_invoice_id
    )
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Mark as applied
-- ============================================

SELECT 'Migration 227 complete: Fixed invoice line items carryover function';
