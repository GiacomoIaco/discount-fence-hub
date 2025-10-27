# Migration Instructions: Drop sales_reps Table

## 📁 Files Created

1. **`migrate-TEST-rollback.sql`** - Test run (no changes saved)
2. **`migrate-PRODUCTION-commit.sql`** - Production run (permanent changes)

---

## 🚀 Step-by-Step Process

### Step 1: Run Test Migration First

1. Open Supabase SQL Editor
2. Copy **entire contents** of `migrate-TEST-rollback.sql`
3. Paste and run it
4. **Expected result:** Success message followed by "ROLLING BACK - NO CHANGES SAVED"

**What this does:**
- Runs through all migration steps
- Shows you what would happen
- **ROLLS BACK** - nothing is saved to database
- Database remains unchanged

### Step 2: Verify Test Results

Check the output for:
- ✅ "TEST RUN COMPLETE!" message
- ✅ No errors shown
- ✅ Count of user_profiles (should be 8)
- ✅ "ROLLING BACK - NO CHANGES SAVED" confirmation

**If you see errors:**
- Stop and share them - don't proceed
- We'll fix the issue before running production version

### Step 3: Run Production Migration

**Only after test succeeds!**

1. Open Supabase SQL Editor (new query)
2. Copy **entire contents** of `migrate-PRODUCTION-commit.sql`
3. Paste and run it
4. **Expected result:** Success message followed by "ALL CHANGES HAVE BEEN COMMITTED AND SAVED!"

**What this does:**
- Runs same steps as test
- **COMMITS** - all changes are permanent
- sales_reps table is deleted
- All users now properly linked

### Step 4: Test Your Application

After migration completes:

1. **Check Messages:**
   - Open direct messages
   - Verify sender names show correctly (not "Unknown")

2. **Check Photo Gallery:**
   - Look at uploaded photos
   - Verify uploader names display correctly

3. **Check Requests:**
   - Open request list
   - Verify submitter names show correctly

---

## ✅ Expected Before/After

### Before Migration:
```
Messages: "Unknown" sent this
Photos: Uploaded by "Unknown"
Requests: Submitted by "Unknown"
```

### After Migration:
```
Messages: "John Doe" sent this
Photos: Uploaded by "Jane Smith"
Requests: Submitted by "Bob Johnson"
```

---

## ⚠️ Important Notes

- **Run TEST first** - never skip the test run
- **Check for errors** - if test fails, don't run production
- **Both files do the same thing** - only difference is ROLLBACK vs COMMIT
- **No data loss** - photos, messages, requests remain intact
- **Only fake test user removed** - your 8 real users are safe

---

## 🆘 Troubleshooting

**Test run shows errors:**
- Share the error message
- Don't run production version
- We'll debug together

**Test succeeds, production fails:**
- Unlikely since they're identical
- If it happens, transaction will auto-rollback
- Database returns to previous state

**After migration, still seeing "Unknown":**
- Check browser cache (hard refresh: Ctrl+Shift+R)
- Verify user_profiles table has 8 records
- Check application logs for errors

---

## 📊 Quick Reference

| File | Purpose | Effect |
|------|---------|--------|
| `migrate-TEST-rollback.sql` | Test dry run | No changes saved |
| `migrate-PRODUCTION-commit.sql` | Actual migration | Permanent changes |

---

## 🎯 Success Criteria

After migration:
- ✅ sales_reps table doesn't exist (will error if queried)
- ✅ user_profiles has 8 records
- ✅ Messages show real usernames
- ✅ Photos show real uploader names
- ✅ Requests show real submitter names
- ✅ No "Unknown" users anywhere

---

**Ready? Start with Step 1: Run the TEST migration!**
