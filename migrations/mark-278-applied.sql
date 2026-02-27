INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('278', 'jobber_salesperson_on_fsm_profiles', 'manual', 0)
ON CONFLICT (version) DO NOTHING;
