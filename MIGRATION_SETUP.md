# Database Migration Setup

This document explains how to set up and use the direct migration system for Supabase.

## One-Time Setup

You need to run these SQL files **once** in your Supabase SQL Editor to enable the migration system:

### Step 1: Mark Existing Migrations as Applied

Since you've been manually applying migrations, run this to mark them all as applied:

```sql
-- File: migrations/MARK_ALL_APPLIED.sql
-- Copy and paste the contents of this file into Supabase SQL Editor
```

This will mark migrations 001-024 as already applied.

### Step 2: Enable Direct Migrations (Optional)

If you want me (Claude Code) to apply migrations directly in the future, run this:

```sql
-- File: migrations/000_enable_direct_migrations.sql
-- Copy and paste the contents of this file into Supabase SQL Editor
```

This creates an `exec_sql()` function that allows programmatic SQL execution.

## How to Use Going Forward

### Option 1: Manual Application (Current Method)

1. I create a migration file in `migrations/`
2. I commit and push it
3. You copy the SQL and paste it into Supabase SQL Editor
4. Run the SQL manually

### Option 2: Direct Application (After Setup)

Once you've run the setup from Step 2 above:

1. I create a migration file in `migrations/`
2. I run: `npm run migrate:direct <filename>.sql`
3. The migration is applied automatically
4. I commit and push the changes

Example:
```bash
npm run migrate:direct 024_fix_project_activity_rls.sql
```

## Current Status

- **Migrations 001-024**: Need to be marked as applied (use MARK_ALL_APPLIED.sql)
- **Direct migrations**: Not yet enabled (need to run 000_enable_direct_migrations.sql)

## Next Steps

1. Go to your Supabase Dashboard → SQL Editor
2. Run `migrations/MARK_ALL_APPLIED.sql` to mark existing migrations
3. Run `migrations/000_enable_direct_migrations.sql` to enable direct application
4. Run `migrations/024_fix_project_activity_rls.sql` to fix the RLS issue
5. Test creating an initiative - it should work now!

## Security Notes

- The `exec_sql()` function is `SECURITY DEFINER` with access limited to `service_role` only
- This means only server-side code with your service role key can execute it
- Regular users and anon keys cannot access this function
- This is safe for programmatic migrations
