-- Mark migration 260 as applied
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('260', 'unified_messaging_entity_links', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
