-- Mark migrations 261, 262, 263 as applied in tracking table
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES
  ('261', 'team_chat_migration_prep', 'manual', 0),
  ('262', 'announcements_broadcast', 'manual', 0),
  ('263', 'deprecate_old_chat_menus', 'manual', 0)
ON CONFLICT (version) DO NOTHING;

SELECT 'Migrations 261-263 marked as applied';
