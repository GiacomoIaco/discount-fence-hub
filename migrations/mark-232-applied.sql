INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('232', 'rename_rate_sheets_to_price_books', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
