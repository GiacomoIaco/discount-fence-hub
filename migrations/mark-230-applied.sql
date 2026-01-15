-- Mark migration 230 as applied
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('230', 'unified_permission_system', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
