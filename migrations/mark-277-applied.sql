INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('277', 'approle_dual_write', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
