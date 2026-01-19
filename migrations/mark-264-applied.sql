-- Mark migration 264 as applied
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('264', 'restore_chat_menus', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
