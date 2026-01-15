INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('231', 'remove_bu_price_books', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
