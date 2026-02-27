INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('279', 'remove_legacy_role_fallback', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
