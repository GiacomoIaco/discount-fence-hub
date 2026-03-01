INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('295', 'conversation_preferences', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
