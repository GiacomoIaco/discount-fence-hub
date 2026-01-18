INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('258', 'user_salesperson_mapping', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
