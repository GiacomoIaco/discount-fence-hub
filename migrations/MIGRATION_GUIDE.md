# Database Migration Guide

This document explains how to use the database migration system for safe and reliable schema changes.

## Overview

The migration system provides:
- ✅ **Version tracking** - Know which migrations have been applied
- ✅ **Conflict detection** - Prevent duplicate version numbers
- ✅ **Checksum verification** - Detect if migrations have changed
- ✅ **Dry-run mode** - Test before applying
- ✅ **Rollback information** - Track when and how migrations were applied

## Quick Start

### 1. Check Migration Status

See which migrations are pending:

```bash
npm run migrate:check
```

This runs in dry-run mode and shows what would be applied without making any changes.

### 2. View Migration History

See all migrations and their status:

```bash
npm run migrate:status
```

### 3. Apply Pending Migrations

Apply all pending migrations:

```bash
npm run migrate:apply
```

## Creating New Migrations

### Naming Convention

Migration files must follow this format:

```
NNN_descriptive_name.sql
```

Where:
- `NNN` = Three-digit version number (001, 002, 003, etc.)
- `descriptive_name` = Short description using snake_case
- `.sql` = File extension

**Examples:**
```
001_migration_tracking.sql
002_enhanced_requests_system.sql
003_add_unread_tracking.sql
011_sales_coach_recordings.sql
```

### Version Numbering

- Use sequential numbers: 001, 002, 003, etc.
- Never reuse a version number
- Check existing migrations before creating a new one
- If there are conflicts (duplicate numbers), renumber the newer one

### Migration Template

```sql
-- Migration: [Short description]
-- Version: NNN
-- Date: YYYY-MM-DD
--
-- [Detailed description of what this migration does and why]

-- Add your schema changes here
CREATE TABLE example (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_example_created_at ON example(created_at);

-- Add comments
COMMENT ON TABLE example IS 'Description of what this table stores';
```

## Safety Features

### 1. Duplicate Detection

The migration runner automatically detects duplicate version numbers:

```bash
npm run migrate:check
```

If duplicates are found:
```
✗ Duplicate migration version 003:
  - 003_add_missing_request_columns.sql
  - 003_add_unread_tracking.sql

Cannot proceed with duplicate migration versions!
```

**Solution:** Renumber the conflicting migrations (see below).

### 2. Dry Run First

Always run `migrate:check` before `migrate:apply`:

```bash
# See what will happen
npm run migrate:check

# If it looks good, apply
npm run migrate:apply
```

### 3. Checksum Verification

Each migration's content is checksummed. If a migration file changes after being applied, the system will detect it.

### 4. Sequential Application

Migrations are applied in version order. If one fails, the process stops to prevent cascading errors.

## Resolving Migration Conflicts

If you have duplicate version numbers, follow these steps:

### Step 1: Identify Conflicts

```bash
npm run migrate:check
```

### Step 2: Check Which Has Been Applied

```bash
npm run migrate:status
```

Look for the version in the "Applied Migrations" list.

### Step 3: Renumber the Conflict

**Option A: If neither has been applied (development only)**

Renumber one of them to the next available number:

```bash
# Example: Renaming 003_add_unread_tracking.sql to 011_add_unread_tracking.sql
git mv migrations/003_add_unread_tracking.sql migrations/011_add_unread_tracking.sql
```

**Option B: If one has been applied (production)**

Only renumber the one that hasn't been applied yet:

1. Check which one is applied in production database
2. Renumber the unapplied one
3. Update any dependent migrations

### Step 4: Verify

```bash
npm run migrate:check
```

Should show no conflicts.

## Current Migration Conflicts

Based on the analysis, these conflicts need to be resolved:

### 003 Conflict
- `003_add_missing_request_columns.sql` (older, likely applied)
- `003_add_unread_tracking.sql` (newer, rename to 011)

### 005 Conflict
- `005_add_request_pins.sql` (older)
- `005_enhance_chat_for_phase1.sql` (newer, rename to 012)

### 006 Conflict
- `006_add_request_attachments.sql` (older)
- `006_group_conversations.sql` (newer, rename to 013)

**Action Plan:**
```bash
# Renumber the newer migrations
git mv migrations/003_add_unread_tracking.sql migrations/011_add_unread_tracking.sql
git mv migrations/005_enhance_chat_for_phase1.sql migrations/012_enhance_chat_for_phase1.sql
git mv migrations/006_group_conversations.sql migrations/013_group_conversations.sql

# Verify no more conflicts
npm run migrate:check
```

## Environment Setup

### Required Environment Variables

Add to your `.env` file:

```env
# Supabase connection (existing)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Service role key for migrations (NEW - required for migrations)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find the service role key:**
1. Go to Supabase Dashboard
2. Navigate to: Settings → API
3. Copy the `service_role` secret key
4. **⚠️ NEVER commit this to git!** (already in .gitignore)

## Workflow

### Development

```bash
# 1. Create your migration file
# migrations/NNN_my_feature.sql

# 2. Test it locally
npm run migrate:check

# 3. Apply it
npm run migrate:apply

# 4. Verify
npm run migrate:status

# 5. Commit to git
git add migrations/NNN_my_feature.sql
git commit -m "Add migration: my_feature"
```

### Staging/Production

```bash
# 1. Pull latest code
git pull

# 2. Check what will be applied (DRY RUN)
npm run migrate:check

# 3. If approved, apply
npm run migrate:apply

# 4. Verify success
npm run migrate:status
```

## Best Practices

### ✅ DO:
- Always run `migrate:check` before `migrate:apply`
- Use descriptive migration names
- Add comments explaining what and why
- Create indexes for foreign keys and query columns
- Use transactions for complex migrations
- Test migrations on a copy of production data first

### ❌ DON'T:
- Modify a migration file after it's been applied
- Skip version numbers
- Use duplicate version numbers
- Apply migrations directly in Supabase SQL editor (use the runner)
- Rush - migrations are permanent!

## Rollback Procedures

If a migration causes issues:

### Option 1: Forward-fix (Preferred)
Create a new migration to fix the issue:
```sql
-- migrations/NNN_fix_previous_issue.sql
ALTER TABLE my_table DROP COLUMN problematic_column;
```

### Option 2: Manual Rollback (Last Resort)
1. Identify the problem migration
2. Write reverse SQL manually
3. Apply in Supabase SQL editor
4. Remove from `schema_migrations` table:
   ```sql
   DELETE FROM schema_migrations WHERE version = 'NNN';
   ```

### Option 3: Database Restore (Critical Issues)
1. Restore from backup (Supabase automatic backups)
2. Re-apply migrations up to the point before the issue
3. Fix the problematic migration
4. Continue

## Monitoring

### Check Migration Table

```sql
SELECT * FROM schema_migrations ORDER BY version DESC;
```

### View Migration Status

```sql
SELECT * FROM migration_status;
```

This view shows:
- All applied migrations
- When they were applied
- Execution time
- Age category (recent, this_week, this_month, older)

## Troubleshooting

### "Missing SUPABASE_SERVICE_ROLE_KEY"

**Solution:** Add the service role key to your `.env` file (see Environment Setup above).

### "Duplicate migration version"

**Solution:** Renumber the conflicting migrations (see Resolving Migration Conflicts above).

### "Migration failed"

**Solutions:**
1. Check the error message
2. Fix the SQL syntax
3. Check if tables/columns already exist
4. Verify your database permissions
5. Test SQL directly in Supabase SQL editor first

### "Table schema_migrations does not exist"

**Solution:** Run the migration system once to create it:
```bash
npm run migrate:apply
```

The first migration (001_migration_tracking.sql) creates this table.

## Migration System Architecture

```
migrations/
├── 001_migration_tracking.sql    ← Creates schema_migrations table
├── 002_enhanced_requests_system.sql
├── 003_add_missing_request_columns.sql
├── 004_direct_messaging_system.sql
└── ...

scripts/
└── run-migrations.ts              ← Migration runner

schema_migrations table:
- version (unique)
- name
- applied_at
- checksum
- execution_time_ms
- applied_by
```

## Support

For issues or questions:
1. Check this guide first
2. Review RISK_MITIGATION_STRATEGY.md
3. Review DEEP_ARCHITECTURAL_ANALYSIS.md
4. Check Supabase logs
5. Test in local environment first

## Related Documentation

- [Risk Mitigation Strategy](../RISK_MITIGATION_STRATEGY.md) - Safety procedures
- [Architectural Analysis](../DEEP_ARCHITECTURAL_ANALYSIS.md) - Technical details
- [Session Handoff](../SESSION_HANDOFF.md) - Implementation roadmap
