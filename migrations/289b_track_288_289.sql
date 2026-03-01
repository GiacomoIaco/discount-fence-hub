-- Track migrations 288 and 289 as applied
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('288', 'request_note_reads', 'manual', 0)
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('289', 'inbox_dismissed_items', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
