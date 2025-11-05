-- ============================================
-- MARK ALL EXISTING MIGRATIONS AS APPLIED
-- Purpose: Tag all migrations that have been manually applied
-- ============================================
--
-- Run this once to mark all existing migrations (001-024) as already applied
-- This prevents the migration runner from trying to re-apply them
--
-- ============================================

INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms) VALUES
  ('001', 'migration_tracking', 'manual', 0),
  ('002', 'enhanced_requests_system', 'manual', 0),
  ('003', 'add_missing_request_columns', 'manual', 0),
  ('004', 'direct_messaging_system', 'manual', 0),
  ('005', 'add_request_pins', 'manual', 0),
  ('006', 'add_request_attachments', 'manual', 0),
  ('007', 'user_management_enhancements', 'manual', 0),
  ('008', 'add_photo_tagging_fields', 'manual', 0),
  ('009', 'menu_visibility_control', 'manual', 0),
  ('010', 'request_notifications', 'manual', 0),
  ('011', 'add_unread_tracking', 'manual', 0),
  ('012', 'enhance_chat_for_phase1', 'manual', 0),
  ('013', 'group_conversations', 'manual', 0),
  ('014', 'sales_coach_to_supabase', 'manual', 0),
  ('015', 'fix_n_plus_1_unread_counts', 'manual', 0),
  ('016', 'performance_indexes', 'manual', 0),
  ('017', 'bom_calculator_system', 'manual', 0),
  ('018', 'custom_photo_tags_table', 'manual', 0),
  ('019', 'add_bom_calculator_to_menu_visibility', 'manual', 0),
  ('020', 'add_file_hash_for_duplicate_detection', 'manual', 0),
  ('021', 'leadership_project_management', 'manual', 0),
  ('022', 'fix_leadership_rls_policies', 'manual', 0),
  ('023', 'fix_recursive_rls_policies', 'manual', 0),
  ('024', 'fix_project_activity_rls', 'manual', 0)
ON CONFLICT (version) DO UPDATE SET
  applied_by = EXCLUDED.applied_by,
  applied_at = NOW();

-- Verify all migrations are marked
SELECT version, name, applied_at, applied_by
FROM schema_migrations
ORDER BY version;
