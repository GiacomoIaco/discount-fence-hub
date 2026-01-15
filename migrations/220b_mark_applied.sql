-- Mark migration 220 as applied (it was already partially applied)
-- The job_line_items table, functions, and triggers already exist

INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('220', 'line_item_cost_split_and_job_items', 'manual', 0)
ON CONFLICT (version) DO NOTHING;

SELECT 'Migration 220 marked as applied';
