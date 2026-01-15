-- Mark migration 233 as applied (it was run via migrate:direct)
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('233', 'restore_rate_sheets', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
