-- Migration Tracking System
-- This migration creates a table to track which migrations have been applied
-- to the database, preventing conflicts and enabling safe rollback capabilities.

-- Create schema_migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64),
  execution_time_ms INTEGER,
  applied_by VARCHAR(255),

  -- Add indexes for common queries
  CONSTRAINT unique_version UNIQUE (version)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version
  ON schema_migrations(version);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at
  ON schema_migrations(applied_at DESC);

-- Add comment to table
COMMENT ON TABLE schema_migrations IS
  'Tracks all database migrations applied to this schema. Used by the migration runner to determine which migrations need to be applied.';

COMMENT ON COLUMN schema_migrations.version IS
  'Migration version number (e.g., 001, 002, 003)';

COMMENT ON COLUMN schema_migrations.name IS
  'Human-readable migration name (e.g., migration_tracking, enhanced_requests_system)';

COMMENT ON COLUMN schema_migrations.checksum IS
  'SHA-256 checksum of the migration file content to detect changes';

COMMENT ON COLUMN schema_migrations.execution_time_ms IS
  'Time taken to execute the migration in milliseconds';

COMMENT ON COLUMN schema_migrations.applied_by IS
  'User or system that applied the migration';

-- Insert this migration itself as the first entry
INSERT INTO schema_migrations (version, name, applied_by, execution_time_ms)
VALUES ('001', 'migration_tracking', 'system', 0)
ON CONFLICT (version) DO NOTHING;

-- Create a function to get the latest migration version
CREATE OR REPLACE FUNCTION get_latest_migration_version()
RETURNS VARCHAR(255) AS $$
  SELECT version
  FROM schema_migrations
  ORDER BY version DESC
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Create a function to check if a migration has been applied
CREATE OR REPLACE FUNCTION is_migration_applied(migration_version VARCHAR(255))
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE version = migration_version
  );
$$ LANGUAGE SQL STABLE;

-- Create a view for migration status
CREATE OR REPLACE VIEW migration_status AS
SELECT
  version,
  name,
  applied_at,
  execution_time_ms,
  applied_by,
  CASE
    WHEN applied_at > NOW() - INTERVAL '1 day' THEN 'recent'
    WHEN applied_at > NOW() - INTERVAL '7 days' THEN 'this_week'
    WHEN applied_at > NOW() - INTERVAL '30 days' THEN 'this_month'
    ELSE 'older'
  END as age_category
FROM schema_migrations
ORDER BY version DESC;

COMMENT ON VIEW migration_status IS
  'Provides a summary view of all applied migrations with categorization by age';
