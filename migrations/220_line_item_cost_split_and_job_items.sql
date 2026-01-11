-- Migration 218: Line Item Cost Split and Job Line Items
--
-- Fixes:
-- 1. Add material_unit_cost and labor_unit_cost columns to quote_line_items
-- 2. Create job_line_items table for tracking line items through conversion
-- 3. Add function to copy line items from quote to job

-- ============================================
-- 1. Add cost split columns to quote_line_items
-- ============================================

ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS material_unit_cost DECIMAL(10,2) DEFAULT 0;

ALTER TABLE quote_line_items
  ADD COLUMN IF NOT EXISTS labor_unit_cost DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN quote_line_items.material_unit_cost IS 'Material cost per unit (what we pay for materials)';
COMMENT ON COLUMN quote_line_items.labor_unit_cost IS 'Labor cost per unit (what we pay for labor)';

-- Migrate existing data: assume unit_cost was all material
UPDATE quote_line_items
SET material_unit_cost = COALESCE(unit_cost, 0)
WHERE material_unit_cost IS NULL OR material_unit_cost = 0;

-- ============================================
-- 2. Create job_line_items table
-- ============================================

CREATE TABLE IF NOT EXISTS job_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  quote_line_item_id UUID REFERENCES quote_line_items(id) ON DELETE SET NULL,

  -- Line item details (copied from quote)
  line_type TEXT DEFAULT 'material' CHECK (line_type IN ('material', 'labor', 'service', 'adjustment', 'discount')),
  description TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  unit_type TEXT DEFAULT 'EA',

  -- Pricing (from quote)
  unit_price DECIMAL(10,2) DEFAULT 0,
  unit_cost DECIMAL(10,2) DEFAULT 0,
  material_unit_cost DECIMAL(10,2) DEFAULT 0,
  labor_unit_cost DECIMAL(10,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,

  -- SKU reference
  sku_id UUID,

  -- Actual tracking (can differ from quoted)
  actual_quantity DECIMAL(12,2),
  actual_unit_cost DECIMAL(10,2),
  actual_total_cost DECIMAL(12,2),

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_line_items_job ON job_line_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_line_items_quote_item ON job_line_items(quote_line_item_id);

-- RLS
ALTER TABLE job_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_line_items_select" ON job_line_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_line_items_insert" ON job_line_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "job_line_items_update" ON job_line_items
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "job_line_items_delete" ON job_line_items
  FOR DELETE TO authenticated USING (true);

GRANT ALL ON job_line_items TO authenticated;

-- ============================================
-- 3. Function to copy line items from quote to job
-- ============================================

CREATE OR REPLACE FUNCTION copy_quote_line_items_to_job(
  p_quote_id UUID,
  p_job_id UUID
) RETURNS void AS $$
BEGIN
  -- Copy all line items from quote to job
  INSERT INTO job_line_items (
    job_id,
    quote_line_item_id,
    line_type,
    description,
    quantity,
    unit_type,
    unit_price,
    unit_cost,
    material_unit_cost,
    labor_unit_cost,
    total_price,
    sku_id,
    sort_order
  )
  SELECT
    p_job_id,
    id,  -- quote_line_item_id
    line_type,
    description,
    quantity,
    unit_type,
    unit_price,
    unit_cost,
    COALESCE(material_unit_cost, unit_cost, 0),
    COALESCE(labor_unit_cost, 0),
    total_price,
    sku_id,
    sort_order
  FROM quote_line_items
  WHERE quote_id = p_quote_id
  ORDER BY sort_order;

  -- Also update job budget columns from quote totals
  UPDATE jobs
  SET
    budgeted_material_cost = (
      SELECT COALESCE(SUM(quantity * material_unit_cost), 0)
      FROM job_line_items WHERE job_id = p_job_id
    ),
    budgeted_labor_cost = (
      SELECT COALESCE(SUM(quantity * labor_unit_cost), 0)
      FROM job_line_items WHERE job_id = p_job_id
    ),
    budgeted_total_cost = (
      SELECT COALESCE(SUM(quantity * (material_unit_cost + labor_unit_cost)), 0)
      FROM job_line_items WHERE job_id = p_job_id
    )
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Function to copy line items from job to invoice
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
    total_price,
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
    COALESCE(actual_quantity, quantity) * unit_price,
    sort_order
  FROM job_line_items
  WHERE job_id = p_job_id
  ORDER BY sort_order;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. Trigger to auto-copy line items on job creation
-- ============================================

CREATE OR REPLACE FUNCTION trg_copy_line_items_on_job_create()
RETURNS TRIGGER AS $$
BEGIN
  -- If job was created from a quote, copy line items
  IF NEW.quote_id IS NOT NULL THEN
    PERFORM copy_quote_line_items_to_job(NEW.quote_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_job_created_copy_line_items ON jobs;
CREATE TRIGGER trg_job_created_copy_line_items
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trg_copy_line_items_on_job_create();

SELECT 'Migration 218 complete: Line item cost split and job line items';
