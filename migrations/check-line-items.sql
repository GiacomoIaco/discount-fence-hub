-- Check the full chain: quote -> job -> invoice line items
-- For job JOB-2026-0004

-- 1. Get job info and its quote_id
WITH job_info AS (
  SELECT id, job_number, quote_id, client_id
  FROM jobs
  WHERE job_number = 'JOB-2026-0004'
)
-- 2. Check if quote has line items
SELECT 'Quote Line Items Count:' AS check_type,
  (SELECT COUNT(*) FROM quote_line_items WHERE quote_id = (SELECT quote_id FROM job_info))::text AS result;

-- 3. Check if job has line items
SELECT 'Job Line Items Count:' AS check_type,
  (SELECT COUNT(*) FROM job_line_items WHERE job_id = (SELECT id FROM jobs WHERE job_number = 'JOB-2026-0004'))::text AS result;

-- 4. Check if invoice has line items
SELECT 'Invoice Line Items Count (latest invoice):' AS check_type,
  (SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = (
    SELECT id FROM invoices WHERE job_id = (SELECT id FROM jobs WHERE job_number = 'JOB-2026-0004') ORDER BY created_at DESC LIMIT 1
  ))::text AS result;

-- 5. Backfill: Copy quote line items to job
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
  (SELECT id FROM jobs WHERE job_number = 'JOB-2026-0004'),
  qli.id,
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
FROM quote_line_items qli
WHERE qli.quote_id = (SELECT quote_id FROM jobs WHERE job_number = 'JOB-2026-0004')
ON CONFLICT DO NOTHING;

SELECT 'Backfill complete: Quote line items copied to job' as status;
