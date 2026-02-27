INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('276', 'menu_visibility_approle_migration', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
