-- Check if job_line_items table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'job_line_items'
) AS job_line_items_exists;

-- Check if triggers exist
SELECT tgname, tgrelid::regclass::text as table_name
FROM pg_trigger 
WHERE tgname LIKE '%copy%line%'
   OR tgname LIKE 'trg_job%';

-- Check if functions exist
SELECT proname 
FROM pg_proc 
WHERE proname LIKE 'copy%line%'
   OR proname LIKE 'trg_copy%';
