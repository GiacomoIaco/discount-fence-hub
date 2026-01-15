-- Mark migration 234 as applied
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('234', 'create_price_books', 'manual', 0)
ON CONFLICT (version) DO NOTHING;

-- Log info
DO $$ BEGIN RAISE NOTICE 'Migration 234 marked as applied'; END $$;
