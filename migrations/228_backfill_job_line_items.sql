-- Migration 228: Backfill job_line_items for existing jobs
--
-- Jobs created before migration 220 don't have job_line_items because
-- the trigger didn't exist. This backfills them from their source quotes.

-- Backfill job_line_items for all jobs that have a quote but no line items
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
  j.id AS job_id,
  qli.id AS quote_line_item_id,
  qli.line_type,
  qli.description,
  qli.quantity,
  qli.unit_type,
  qli.unit_price,
  qli.unit_cost,
  COALESCE(qli.material_unit_cost, qli.unit_cost, 0),
  COALESCE(qli.labor_unit_cost, 0),
  qli.total_price,
  qli.sku_id,
  qli.sort_order
FROM jobs j
JOIN quote_line_items qli ON qli.quote_id = j.quote_id
WHERE j.quote_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM job_line_items jli WHERE jli.job_id = j.id
  )
ORDER BY j.id, qli.sort_order;

-- Report how many job_line_items were created
SELECT 'Backfilled ' || COUNT(*) || ' job_line_items' AS result
FROM job_line_items;

SELECT 'Migration 228 complete: Backfilled job_line_items for existing jobs';
