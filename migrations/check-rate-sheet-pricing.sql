-- Check ATX-HB QBO class and its default rate sheet
SELECT 
  qc.id,
  qc.name,
  qc.default_rate_sheet_id,
  rs.name as rate_sheet_name,
  rs.pricing_type
FROM qbo_classes qc
LEFT JOIN rate_sheets rs ON rs.id = qc.default_rate_sheet_id
WHERE qc.name ILIKE '%Austin%Builder%';
