-- Check FSM lifecycle triggers are installed
SELECT
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgname LIKE 'trg_%'
  AND tgrelid::regclass::text IN ('service_requests', 'quotes', 'jobs', 'invoices', 'payments')
ORDER BY table_name, trigger_name;
