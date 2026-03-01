-- Priority/urgent messaging support
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent'));
ALTER TABLE company_messages ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent'));

-- Track migration
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('294', 'message_priority', 'claude', 0)
ON CONFLICT (version) DO NOTHING;
