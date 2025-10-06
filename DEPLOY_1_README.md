# 🚀 DEPLOY 1: Database & Backend Infrastructure

## Overview

This is the first of two deploys for the enhanced Request Management System. Deploy 1 focuses on **backend-only changes** (database schema and API hooks) with **no UI changes**. This makes it low-risk and easy to test.

## What's Included

### 1. Enhanced Database Schema
- **File:** `migrations/002_enhanced_requests_system.sql`
- **Changes:**
  - New columns on `requests` table (stage, SLA tracking, assignment, priority scoring)
  - New tables: `request_notes`, `request_activity_log`, `request_assignment_rules`, `request_sla_defaults`
  - Automated triggers for SLA calculation and activity logging
  - Row Level Security (RLS) policies
  - Helper view: `request_summary`

### 2. Supabase API Hooks
- **File:** `src/lib/requests.ts`
- **Features:**
  - CRUD operations for requests
  - Assignment system
  - Notes and activity logging
  - Real-time subscriptions
  - Analytics queries

### 3. React Hooks
- **File:** `src/hooks/useRequests.ts`
- **Hooks:**
  - `useMyRequests()` - Get user's requests
  - `useAllRequests()` - Get all requests (operations)
  - `useRequest(id)` - Get single request
  - `useCreateRequest()` - Create new request
  - `useUpdateRequest()` - Update request
  - `useAssignRequest()` - Assign request
  - `useRequestNotes()` - Manage notes
  - `useRequestActivity()` - View activity log
  - `useRequestAge()` - Calculate age with color coding

## 🔧 Installation Steps

### Step 1: Run Database Migration

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy contents of `migrations/002_enhanced_requests_system.sql`
6. Paste into SQL Editor
7. Click **Run** (bottom right)
8. Wait for success message (should see ✅ in console)

**Expected Result:**
```
✅ Enhanced Request Management System installed successfully!

New features:
• SLA tracking with auto-calculated breach detection
• Priority scoring based on urgency, value, and age
• Assignment rules for auto-routing
• Activity logging for audit trail
• Request notes for communication

Tables created: request_notes, request_activity_log, request_assignment_rules, request_sla_defaults
View created: request_summary
```

### Step 2: Verify Database Changes

Run this query to verify tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'request%'
ORDER BY table_name;
```

**Expected tables:**
- requests (existing, now enhanced)
- request_activity_log (new)
- request_assignment_rules (new)
- request_notes (new)
- request_sla_defaults (new)

### Step 3: Check SLA Defaults

```sql
SELECT * FROM request_sla_defaults;
```

**Expected data:**
| request_type | target_hours | urgent_target_hours | critical_target_hours |
|--------------|--------------|---------------------|----------------------|
| pricing      | 24           | 8                   | 4                    |
| material     | 24           | 12                  | 6                    |
| support      | 8            | 4                   | 2                    |
| new_builder  | 48           | 24                  | 12                   |
| warranty     | 12           | 6                   | 3                    |
| other        | 24           | 12                  | 6                    |

### Step 4: Test with Sample Data (Optional)

Create a test request to verify triggers work:

```sql
-- Insert test request
INSERT INTO requests (
  request_type,
  title,
  customer_name,
  urgency,
  expected_value,
  submitter_id
) VALUES (
  'pricing',
  'Test Request - Cedar Fence',
  'Test Customer',
  'high',
  10000,
  (SELECT id FROM auth.users LIMIT 1)
);

-- Check if SLA fields populated automatically
SELECT
  title,
  stage,
  sla_target_hours,
  sla_status,
  priority_score
FROM requests
WHERE title LIKE 'Test Request%';
```

**Expected:**
- `sla_target_hours` = 8 (because urgency is 'high')
- `sla_status` = 'on_track' (just created)
- `priority_score` > 0 (auto-calculated)

### Step 5: Commit Backend Code

```bash
git add migrations/ src/lib/requests.ts src/hooks/useRequests.ts
git commit -m "Add enhanced request management backend

- Database schema with SLA tracking and assignment
- Supabase CRUD hooks with real-time
- React hooks for components
- Auto-calculated priority and SLA status

Part 1 of 2: Backend only, no UI changes yet"

git push
```

## ✅ Testing Checklist

- [ ] SQL migration ran without errors
- [ ] All 5 new tables created
- [ ] SLA defaults populated
- [ ] Test request creates successfully
- [ ] SLA fields auto-populate
- [ ] Priority score calculates
- [ ] Code pushed to GitHub

## 🎯 What's Next

**Deploy 2** (coming next):
- Mobile home consolidation (single "Requests" button)
- Wire up new hooks to existing components
- Data migration from localStorage to Supabase
- Updated UI with filters and age indicators

## ⚠️ Important Notes

1. **No breaking changes** - Existing app still works with localStorage
2. **RLS is enabled** - Make sure user_profiles table exists with proper roles
3. **Triggers are automatic** - SLA and priority recalculate on every insert/update
4. **Real-time ready** - Subscriptions will work once UI is connected

## 🐛 Troubleshooting

**Error: relation "user_profiles" does not exist**
- Run the main schema migration first (should already exist)
- Verify: `SELECT * FROM user_profiles LIMIT 1;`

**Error: permission denied for table requests**
- RLS policies need auth context
- Make sure you're logged in when testing
- Or temporarily disable RLS: `ALTER TABLE requests DISABLE ROW LEVEL SECURITY;`

**Triggers not firing**
- Check function exists: `\df update_sla_status`
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_sla_status';`

## 📊 Database Diagram

```
┌─────────────────┐
│    requests     │ (enhanced)
├─────────────────┤
│ • stage         │ NEW
│ • assigned_to   │ NEW
│ • sla_status    │ NEW
│ • priority_score│ NEW
│ • (30+ columns) │
└────────┬────────┘
         │
         ├─────► request_notes (1:many)
         ├─────► request_activity_log (1:many)
         └─────► request_assignment_rules (type-based)
```

## 🎉 Success!

If all tests pass, Deploy 1 is complete! The backend is ready for Deploy 2 where we'll build the UI and migrate data.

**Estimated time for Deploy 1:** 15-20 minutes
