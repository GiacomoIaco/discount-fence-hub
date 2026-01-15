-- ============================================
-- MARK ALL APPLIED MIGRATIONS AS TRACKED
-- Generated: 2025-01-09
-- Purpose: Update schema_migrations to reflect all migrations that have been
--          manually applied via Supabase SQL Editor but weren't tracked
-- ============================================
--
-- IMPORTANT: This only updates the TRACKING table. It does NOT run any migrations.
-- All these migrations were already applied to the database.
--
-- Already tracked (will be skipped via ON CONFLICT):
-- 001-024 (marked 11/10/2025)
-- 031, 032 (marked 11/13/2025)
-- 041 (marked 11/25/2025)
-- 175, 176, 177 (marked 12/17/2025)
--
-- ============================================

INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms) VALUES
  -- Migration 000 (bootstrapping)
  ('000', 'enable_direct_migrations', 'manual_audit_2025_01_09', 0),

  -- Migrations 025-030 (Strategic/Leadership system)
  ('025', 'strategic_goal_system_simplified', 'manual_audit_2025_01_09', 0),
  ('026', 'add_goals_and_tasks', 'manual_audit_2025_01_09', 0),
  ('027', 'add_measurable_goal_tracking', 'manual_audit_2025_01_09', 0),
  ('028', 'strategy_and_comments', 'manual_audit_2025_01_09', 0),
  ('029', 'operating_plan_and_bonus_kpis', 'manual_audit_2025_01_09', 0),
  ('030', 'add_initiative_description', 'manual_audit_2025_01_09', 0),

  -- Migrations 033-040 (Annual planning, function owners, watchers)
  ('033', 'annual_plan_finalization', 'manual_audit_2025_01_09', 0),
  ('034', 'simplify_annual_targets', 'manual_audit_2025_01_09', 0),
  ('035', 'annual_plan_workflow_and_5color_system', 'manual_audit_2025_01_09', 0),
  ('036', 'initiative_week_locks', 'manual_audit_2025_01_09', 0),
  ('037', 'add_function_owners', 'manual_audit_2025_01_09', 0),
  ('038', 'request_watchers', 'manual_audit_2025_01_09', 0),
  ('039', 'fix_request_watchers_rls', 'manual_audit_2025_01_09', 0),
  ('040', 'user_notification_preferences', 'manual_audit_2025_01_09', 0),

  -- Migrations 042-060 (Tasks, initiatives, admin features)
  ('042', 'initiative_comments', 'manual_audit_2025_01_09', 0),
  ('043', 'task_assignees', 'manual_audit_2025_01_09', 0),
  ('044', 'personal_initiatives', 'manual_audit_2025_01_09', 0),
  ('045', 'personal_initiative_enhancements', 'manual_audit_2025_01_09', 0),
  ('046', 'task_ownership_and_comments', 'manual_audit_2025_01_09', 0),
  ('047', 'task_high_priority', 'manual_audit_2025_01_09', 0),
  ('048', 'consolidate_task_assignees', 'manual_audit_2025_01_09', 0),
  ('049', 'fix_task_assignees_rls', 'manual_audit_2025_01_09', 0),
  ('050', 'relaxed_task_assignees_rls', 'manual_audit_2025_01_09', 0),
  ('051', 'fix_task_assignees_recursion', 'manual_audit_2025_01_09', 0),
  ('052', 'fix_auto_assignment_permissions', 'manual_audit_2025_01_09', 0),
  ('053', 'backfill_completed_at', 'manual_audit_2025_01_09', 0),
  ('054', 'add_pricing_quote_columns', 'manual_audit_2025_01_09', 0),
  ('055', 'add_super_admin_flag', 'manual_audit_2025_01_09', 0),
  ('056', 'create_function_members_table', 'manual_audit_2025_01_09', 0),
  ('057', 'add_show_in_leadership_hub', 'manual_audit_2025_01_09', 0),
  ('058', 'fix_function_owners_rls_super_admin', 'manual_audit_2025_01_09', 0),
  ('059', 'fix_rls_recursion', 'manual_audit_2025_01_09', 0),
  ('060', 'fix_function_members_rls_for_owners', 'manual_audit_2025_01_09', 0),

  -- Migrations 061-070 (Storage, BOM, calculator)
  ('061', 'fix_storage_buckets', 'manual_audit_2025_01_09', 0),
  ('062', 'add_file_columns_to_request_notes', 'manual_audit_2025_01_09', 0),
  ('063', 'bom_tables_rls_policies', 'manual_audit_2025_01_09', 0),
  ('064', 'import_labor_rates_data', 'manual_audit_2025_01_09', 0),
  ('065', 'import_materials_data', 'manual_audit_2025_01_09', 0),
  ('066', 'add_notes_to_labor_codes', 'manual_audit_2025_01_09', 0),
  ('067', 'sku_labor_costs_table', 'manual_audit_2025_01_09', 0),
  ('068', 'add_labor_rates_unique_constraint', 'manual_audit_2025_01_09', 0),
  ('069', 'calculator_enhancements', 'manual_audit_2025_01_09', 0),
  ('070', 'project_bundles', 'manual_audit_2025_01_09', 0),

  -- Migrations 071-080 (Product framework, components)
  ('071', 'partial_pickup_and_status_simplification', 'manual_audit_2025_01_09', 0),
  ('072', 'product_definition_framework', 'manual_audit_2025_01_09', 0),
  ('073', 'recreate_product_definition_framework', 'manual_audit_2025_01_09', 0),
  ('074', 'component_material_rules', 'manual_audit_2025_01_09', 0),
  ('075', 'add_vertical_trim_to_wood_horizontal', 'manual_audit_2025_01_09', 0),
  ('076', 'custom_products_system', 'manual_audit_2025_01_09', 0),
  ('077', 'sku_import_status_tracking', 'manual_audit_2025_01_09', 0),
  ('078', 'price_history_tables', 'manual_audit_2025_01_09', 0),
  ('079', 'component_system', 'manual_audit_2025_01_09', 0),
  ('080', 'component_material_eligibility', 'manual_audit_2025_01_09', 0),

  -- Migrations 081-090 (Eligibility, yard workflow)
  ('081', 'component_attribute_filters', 'manual_audit_2025_01_09', 0),
  ('082', 'fix_eligibility_unique_constraint', 'manual_audit_2025_01_09', 0),
  ('083', 'fence_type_specific_filters', 'manual_audit_2025_01_09', 0),
  ('084', 'cleanup_post_eligibility', 'manual_audit_2025_01_09', 0),
  ('085', 'yard_workflow', 'manual_audit_2025_01_09', 0),
  ('086', 'project_archive', 'manual_audit_2025_01_09', 0),
  ('087', 'yard_stocking_areas', 'manual_audit_2025_01_09', 0),
  ('088', 'yard_locations_redesign', 'manual_audit_2025_01_09', 0),
  ('089', 'fix_project_materials_columns', 'manual_audit_2025_01_09', 0),
  ('090', 'fix_status_history_rls', 'manual_audit_2025_01_09', 0),

  -- Migrations 091-100 (Yard, menu, project codes)
  ('091', 'fix_yard_tables_rls', 'manual_audit_2025_01_09', 0),
  ('092', 'fix_views_archived_filter', 'manual_audit_2025_01_09', 0),
  ('093', 'yard_claim_workflow', 'manual_audit_2025_01_09', 0),
  ('094', 'staging_target_date', 'manual_audit_2025_01_09', 0),
  ('095', 'yard_analytics_views', 'manual_audit_2025_01_09', 0),
  ('096', 'advanced_analytics_views', 'manual_audit_2025_01_09', 0),
  ('097', 'menu_visibility_platform', 'manual_audit_2025_01_09', 0),
  ('098', 'add_requests_menu_item', 'manual_audit_2025_01_09', 0),
  ('099', 'fix_mobile_menu_visibility', 'manual_audit_2025_01_09', 0),
  ('100', 'new_project_code_format', 'manual_audit_2025_01_09', 0),

  -- Migrations 101-110 (Menu, roadmap)
  ('101', 'fix_status_constraint', 'manual_audit_2025_01_09', 0),
  ('102', 'platform_visibility_columns', 'manual_audit_2025_01_09', 0),
  ('103', 'menu_visibility_cleanup', 'manual_audit_2025_01_09', 0),
  ('104', 'roadmap_items', 'manual_audit_2025_01_09', 0),
  ('105', 'seed_roadmap_items', 'manual_audit_2025_01_09', 0),
  ('106', 'roadmap_hub_setup', 'manual_audit_2025_01_09', 0),
  ('107', 'roadmap_parked_and_future', 'manual_audit_2025_01_09', 0),
  ('108', 'menu_visibility_categories', 'manual_audit_2025_01_09', 0),
  ('109', 'add_roadmap_menu_visibility', 'manual_audit_2025_01_09', 0),
  ('110', 'roadmap_user_notes', 'manual_audit_2025_01_09', 0),

  -- Migrations 111-120 (Labor, SKU, BOM v2)
  ('111', 'fix_labor_rates_update_policy', 'manual_audit_2025_01_09', 0),
  ('112', 'sku_archive', 'manual_audit_2025_01_09', 0),
  ('113', 'add_prestained_materials', 'manual_audit_2025_01_09', 0),
  ('114', 'add_ctn05o_material', 'manual_audit_2025_01_09', 0),
  ('115', 'import_wood_vertical_skus', 'manual_audit_2025_01_09', 0),
  ('116', 'import_wood_vertical_products_v1', 'manual_audit_2025_01_09', 0),
  ('117', 'fix_wood_vertical_styles', 'manual_audit_2025_01_09', 0),
  ('119', 'roadmap_audio_url', 'manual_audit_2025_01_09', 0),
  ('120', 'o026_bom_v2_tables', 'manual_audit_2025_01_09', 0),

  -- Migrations 121-130 (Formula templates, surveys)
  ('121', 'o026_formula_templates', 'manual_audit_2025_01_09', 0),
  ('122', 'seed_v2_from_excel', 'manual_audit_2025_01_09', 0),
  ('123', 'fix_component_types', 'manual_audit_2025_01_09', 0),
  ('124', 'restore_v1_component_views', 'manual_audit_2025_01_09', 0),
  ('125', 'v1_component_system_full', 'manual_audit_2025_01_09', 0),
  ('126', 'seed_formula_templates_v2', 'manual_audit_2025_01_09', 0),
  ('127', 'product_type_manager_schema', 'manual_audit_2025_01_09', 0),
  ('128', 'component_material_eligibility_v2', 'manual_audit_2025_01_09', 0),
  ('129', 'component_filter_variable', 'manual_audit_2025_01_09', 0),
  ('130', 'survey_hub_schema', 'manual_audit_2025_01_09', 0),

  -- Migrations 131-140 (Client hub, QBO)
  ('131', 'add_survey_hub_menu_item', 'manual_audit_2025_01_09', 0),
  ('132', 'client_hub_phase1_schema', 'manual_audit_2025_01_09', 0),
  ('133', 'component_is_optional', 'manual_audit_2025_01_09', 0),
  ('134', 'add_client_hub_menu', 'manual_audit_2025_01_09', 0),
  ('135', 'bom_projects_client_link', 'manual_audit_2025_01_09', 0),
  ('136', 'client_hub_request_types', 'manual_audit_2025_01_09', 0),
  ('138', 'qbo_tokens', 'manual_audit_2025_01_09', 0),
  ('139', 'contact_roles', 'manual_audit_2025_01_09', 0),
  ('140', 'qbo_classes', 'manual_audit_2025_01_09', 0),

  -- Migrations 141-150 (Properties, FSM core, formulas)
  ('141', 'properties', 'manual_audit_2025_01_09', 0),
  ('142', 'labor_groups_v2', 'manual_audit_2025_01_09', 0),
  ('143', 'set_component_visibility_conditions', 'manual_audit_2025_01_09', 0),
  ('144', 'fsm_core_tables', 'manual_audit_2025_01_09', 0),
  ('145', 'fix_v2_formulas', 'manual_audit_2025_01_09', 0),
  ('146', 'fix_formula_variable_names', 'manual_audit_2025_01_09', 0),
  ('147', 'fix_steel_component_formulas', 'manual_audit_2025_01_09', 0),
  ('148', 'fix_labor_conditions', 'manual_audit_2025_01_09', 0),
  ('149', 'concrete_type_selection', 'manual_audit_2025_01_09', 0),
  ('150', 'fix_component_visibility_and_concrete', 'manual_audit_2025_01_09', 0),

  -- Migrations 151-160 (Concrete, menu, chain link, quotes)
  ('151', 'fix_concrete_as_system_component', 'manual_audit_2025_01_09', 0),
  ('152', 'add_ops_hub_v2_menu', 'manual_audit_2025_01_09', 0),
  ('153', 'roadmap_attachments', 'manual_audit_2025_01_09', 0),
  ('154', 'product_type_knowledge', 'manual_audit_2025_01_09', 0),
  ('155', 'fix_requests_visibility', 'manual_audit_2025_01_09', 0),
  ('156', 'chain_link_complete_setup', 'manual_audit_2025_01_09', 0),
  ('157', 'wood_vertical_other_labor', 'manual_audit_2025_01_09', 0),
  ('158', 'fix_wood_vertical_labor_conditions', 'manual_audit_2025_01_09', 0),
  ('159', 'wood_vertical_knowledge', 'manual_audit_2025_01_09', 0),
  ('160', 'quote_client_communication', 'manual_audit_2025_01_09', 0),

  -- Migrations 161-170 (Labor, FSM projects, message center)
  ('161', 'fix_cap_trim_labor_conditions', 'manual_audit_2025_01_09', 0),
  ('162', 'steel_post_cap_visibility', 'manual_audit_2025_01_09', 0),
  ('163', 'roadmap_bundles_idea', 'manual_audit_2025_01_09', 0),
  ('164', 'fsm_projects', 'manual_audit_2025_01_09', 0),
  ('165', 'add_code_handled_knowledge', 'manual_audit_2025_01_09', 0),
  ('166', 'community_extended_fields', 'manual_audit_2025_01_09', 0),
  ('167', 'custom_fields_system', 'manual_audit_2025_01_09', 0),
  ('168', 'message_center_core', 'manual_audit_2025_01_09', 0),
  ('169', 'quick_replies', 'manual_audit_2025_01_09', 0),
  ('170', 'schedule_entries', 'manual_audit_2025_01_09', 0),

  -- Migrations 171-174 (Assignments, contacts, roadmap, groups)
  ('171', 'assignment_and_skills_tables', 'manual_audit_2025_01_09', 0),
  ('172', 'mc_contacts_context_label', 'manual_audit_2025_01_09', 0),
  ('173', 'roadmap_custom_views', 'manual_audit_2025_01_09', 0),
  ('174', 'group_conversations', 'manual_audit_2025_01_09', 0),

  -- Migrations 178-185 (Geocoding, notifications, crews, territories, requests)
  ('178', 'add_geocoding_fields', 'manual_audit_2025_01_09', 0),
  ('179', 'notification_preferences', 'manual_audit_2025_01_09', 0),
  ('180', 'push_subscriptions', 'manual_audit_2025_01_09', 0),
  ('181', 'fix_mc_messages_user_fk', 'manual_audit_2025_01_09', 0),
  ('182', 'crew_subcontractor_support', 'manual_audit_2025_01_09', 0),
  ('183', 'multi_crew_preferences', 'manual_audit_2025_01_09', 0),
  ('184', 'territory_map_enhancement', 'manual_audit_2025_01_09', 0),
  ('185', 'request_system_updates', 'manual_audit_2025_01_09', 0),

  -- Migrations 186-195 (BU/QBO normalization, FSM lifecycle)
  ('186', 'bu_qbo_normalization_phase0', 'manual_audit_2025_01_09', 0),
  ('187', 'bu_qbo_normalization_phase1', 'manual_audit_2025_01_09', 0),
  ('188', 'bu_qbo_normalization_phase2', 'manual_audit_2025_01_09', 0),
  ('189', 'bu_qbo_normalization_phase3', 'manual_audit_2025_01_09', 0),
  ('190', 'bu_qbo_normalization_phase4', 'manual_audit_2025_01_09', 0),
  ('191', 'team_consolidation_phase5', 'manual_audit_2025_01_09', 0),
  ('192', 'fix_qbo_class_ids_type', 'manual_audit_2025_01_09', 0),
  ('193', 'apply_skipped_182_184_safe', 'manual_audit_2025_01_09', 0),
  ('194', 'fsm_lifecycle_automation', 'manual_audit_2025_01_09', 0),
  ('195', 'roadmap_voice_transcript', 'manual_audit_2025_01_09', 0),

  -- Migrations 196-205 (Views, demographics, projects, quotes, jobs)
  ('196', 'fix_zip_count_in_view', 'manual_audit_2025_01_09', 0),
  ('197', 'demographics_data', 'manual_audit_2025_01_09', 0),
  ('198', 'territories_use_fsm_team', 'manual_audit_2025_01_09', 0),
  ('199', 'roadmap_s011_role_consolidation', 'manual_audit_2025_01_09', 0),
  ('200', 'auto_create_rep_profiles', 'manual_audit_2025_01_09', 0),
  ('201', 'fix_sales_role_case', 'manual_audit_2025_01_09', 0),
  ('202', 'project_foundation', 'manual_audit_2025_01_09', 0),
  ('203', 'quote_enhancements', 'manual_audit_2025_01_09', 0),
  ('204', 'job_enhancements', 'manual_audit_2025_01_09', 0),
  ('205', 'job_visits', 'manual_audit_2025_01_09', 0),

  -- Migrations 206-216 (Triggers, views, properties, signup)
  ('206', 'auto_create_triggers', 'manual_audit_2025_01_09', 0),
  ('207', 'project_views', 'manual_audit_2025_01_09', 0),
  ('208', 'properties_residential_support', 'manual_audit_2025_01_09', 0),
  ('209', 'test_territory_coverage', 'manual_audit_2025_01_09', 0),
  ('210', 'fix_request_project_column', 'manual_audit_2025_01_09', 0),
  ('211', 'bu_default_rate_sheet', 'manual_audit_2025_01_09', 0),
  ('212', 'sku_labor_costs_v2', 'manual_audit_2025_01_09', 0),
  ('213', 'project_lifecycle_dates', 'manual_audit_2025_01_09', 0),
  ('214', 'self_signup_with_approval', 'manual_audit_2025_01_09', 0),
  ('215', 'fix_user_profiles_rls', 'manual_audit_2025_01_09', 0),
  ('216', 'phone_verification', 'manual_audit_2025_01_09', 0),

  -- Migration 217 (pick one representative entry for duplicates)
  ('217', 'combined_fgh', 'manual_audit_2025_01_09', 0),

  -- Migrations 218-219 (pick one representative for 218 duplicates)
  ('218', 'fix_approval_status_default', 'manual_audit_2025_01_09', 0),
  ('219', 'fix_invitation_approval', 'manual_audit_2025_01_09', 0)

ON CONFLICT (version) DO NOTHING;

-- Show final count
SELECT
  COUNT(*) as total_tracked,
  COUNT(*) FILTER (WHERE applied_by = 'manual_audit_2025_01_09') as newly_tracked
FROM schema_migrations;
