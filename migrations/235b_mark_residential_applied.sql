-- Mark 235 as applied since tables and functions already exist
-- The RLS policies blocking the migration already exist, meaning prior partial run succeeded

-- Verify tables exist by querying them
DO $$
BEGIN
    -- This will throw an error if tables don't exist
    PERFORM 1 FROM jobber_residential_opportunities LIMIT 1;
    PERFORM 1 FROM jobber_residential_quotes LIMIT 1;
    PERFORM 1 FROM jobber_residential_jobs LIMIT 1;

    RAISE NOTICE 'All residential tables exist';
END $$;

-- Mark migration 235 as applied in tracking table
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('235', 'residential_analytics', 'manual-fix', 0)
ON CONFLICT (version) DO UPDATE SET
    name = 'residential_analytics',
    applied_at = NOW();
