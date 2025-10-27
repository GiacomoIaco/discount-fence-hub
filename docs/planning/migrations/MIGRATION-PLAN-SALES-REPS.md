# Migration Plan: Eliminate sales_reps Table

## Problem Summary

**Finding:** Your system has 0 matching IDs between `sales_reps` (1 record) and `auth.users` (8 records).

This means:
- The old `sales_reps` table is **abandoned legacy data**
- All current users are in `auth.users` only
- Data referencing the old sales_reps UUID can't find user info → shows "Unknown"

## Root Cause

When messages/photos/requests try to display usernames, they:
1. Look up the UUID in `user_profiles` table
2. `user_profiles` only has `auth.users` IDs (not the old sales_reps ID)
3. Lookup fails → "Unknown" appears

## Solution

**Option 1 is SAFE and RECOMMENDED** because there's zero overlap - we're not losing any current user data.

We will:
1. ✅ Check what data references the old sales_reps record (run audit)
2. ✅ Update all foreign keys to point to `auth.users` instead
3. ✅ Nullify any references to the old record
4. ✅ Drop the `sales_reps` table
5. ✅ Backfill missing `user_profiles` records

---

## Pre-Migration Checklist

### ⚠️ BEFORE RUNNING ANYTHING:

- [ ] **Backup your database** (Critical!)
- [ ] Run `audit-sales-reps-usage.sql` in Supabase SQL Editor
- [ ] Review audit results - see what data references old sales_reps
- [ ] Decide if you need to reassign any important data
- [ ] Read through `migrate-drop-sales-reps.sql` entirely
- [ ] Test on a staging database if available

---

## Step-by-Step Instructions

### Step 1: Run Audit (Required)

**File:** `audit-sales-reps-usage.sql`

```sql
-- Run this in Supabase SQL Editor
-- Copy/paste entire contents of audit-sales-reps-usage.sql
```

**Review the output:**
- Check if any photos, presentations, or ROI calculations reference the old user
- If counts are all 0, migration is trivial
- If counts > 0, decide whether to:
  - Nullify (set to NULL) - data remains but shows no creator
  - Reassign to a real user - manually update before migration

### Step 2: Backup Database

In Supabase Dashboard:
1. Go to Database → Backups
2. Create manual backup
3. Download it locally

### Step 3: Run Migration (After Confirmation)

**File:** `migrate-drop-sales-reps.sql`

**Important:** The script is wrapped in commented BEGIN/COMMIT statements:
- Uncomment `BEGIN;` at the start
- Uncomment `COMMIT;` at the end
- This allows you to test without committing

**To test without committing:**
```sql
BEGIN;
-- ... entire migration script ...
ROLLBACK; -- Use ROLLBACK instead of COMMIT to test
```

**To actually run the migration:**
```sql
BEGIN;
-- ... entire migration script ...
COMMIT; -- Use COMMIT to apply changes
```

### Step 4: Verify Results

After migration, check:

1. **Database:**
   ```sql
   -- Verify sales_reps is gone
   SELECT * FROM sales_reps; -- Should error: table doesn't exist

   -- Verify user_profiles has all 8 users
   SELECT COUNT(*) FROM user_profiles; -- Should be 8

   -- Verify FK constraints
   SELECT
     tc.table_name,
     tc.constraint_name,
     kcu.column_name,
     ccu.table_name AS foreign_table_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu
     ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu
     ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY'
     AND ccu.table_name = 'sales_reps'; -- Should return 0 rows
   ```

2. **Application:**
   - Check messages - should show usernames
   - Check photo gallery - should show uploader names
   - Check requests - should show submitter names
   - Verify no "Unknown" users appear

---

## What the Migration Does

### Tables Updated (9 total):

1. **photos** - uploaded_by, reviewed_by → auth.users
2. **presentations** - created_by → auth.users
3. **roi_calculations** - rep_id renamed to user_id → auth.users
4. **activity_log** - user_id → auth.users
5. **sales_resources_folders** - created_by, archived_by → auth.users
6. **sales_resources_files** - uploaded_by, archived_by → auth.users
7. **sales_resources_views** - user_id → auth.users
8. **sales_resources_favorites** - user_id → auth.users

### Data Cleanup:

- Any references to the old sales_reps UUID are set to NULL
- No data is deleted (photos/presentations/etc. remain)
- Creator field just shows NULL instead of "Unknown"

### Backfill:

- Creates `user_profiles` records for any `auth.users` without them
- Uses email and metadata from auth.users
- Ensures all 8 users have profiles

---

## Expected Results

### Before:
- Messages: "Unknown" sender
- Photos: "Unknown" uploader
- Requests: "Unknown" submitter

### After:
- Messages: "John Doe" (actual name from user_profiles)
- Photos: "Jane Smith" (actual name)
- Requests: "Bob Johnson" (actual name)

---

## Rollback Plan

If something goes wrong:

1. **If you haven't committed yet:**
   ```sql
   ROLLBACK;
   ```

2. **If you already committed:**
   - Restore from backup (Step 2)
   - Supabase Dashboard → Database → Backups → Restore

---

## After Migration

### Clean up your codebase:

1. **Delete these files:**
   - `supabase-schema.sql` (contains old sales_reps definition)
   - Any migration files referencing sales_reps

2. **Update documentation:**
   - Remove any references to sales_reps table
   - Update schema diagrams

3. **Test thoroughly:**
   - All user-related features
   - Photo uploads and display
   - Request creation and viewing
   - Direct messaging

---

## FAQ

**Q: Will this delete any users?**
A: No. Your 8 auth.users remain unchanged. Only the 1 legacy sales_reps record is removed.

**Q: Will this delete any photos/requests/messages?**
A: No. All data remains. Only the user references are updated.

**Q: What if I need to rollback?**
A: Use `ROLLBACK;` before committing, or restore from backup.

**Q: Is this reversible?**
A: Only via backup restoration. Once dropped, sales_reps can't be recreated with the same data.

**Q: How long will this take?**
A: < 1 minute. It's just dropping constraints and updating references.

---

## Success Criteria

✅ No "Unknown" users in the application
✅ All 8 users have profiles in user_profiles
✅ Messages show sender names
✅ Photos show uploader names
✅ Requests show submitter names
✅ sales_reps table is dropped
✅ All FK constraints point to auth.users

---

## Support

If you encounter issues:
1. Check Supabase logs for errors
2. Verify foreign key constraints
3. Check user_profiles has all 8 records
4. Restore from backup if needed

**Do NOT proceed without running the audit first!**
