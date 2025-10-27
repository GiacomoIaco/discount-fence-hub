# Chat Database Setup Guide

## 📋 Phase 1: Database Migration

Follow these steps in **exact order** to set up the database for direct messaging.

---

## Step 1: Run SQL Migrations in Supabase

### 1.1 Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `discount-fence-hub`
3. Click **SQL Editor** in left sidebar
4. Click **New query**

### 1.2 Run Migration 004 (Core Chat System)

**Copy the entire contents of:**
```
migrations/004_direct_messaging_system.sql
```

**Paste into SQL Editor and click "Run"**

✅ **Expected output:**
```
✅ Direct messaging system installed successfully!

New features:
• Direct messages between users
• Conversation threads
• @mentions with notifications
• Unread message tracking
```

### 1.3 Run Migration 005 (Phase 1 Enhancements)

**Copy the entire contents of:**
```
migrations/005_enhance_chat_for_phase1.sql
```

**Paste into SQL Editor and click "Run"**

✅ **Expected output:**
```
✅ Chat enhancements for Phase 1 installed!

New features:
• File attachments in messages
• User online/offline status tracking
• Enhanced conversation list query
```

---

## Step 2: Enable Realtime

### 2.1 Enable Tables for Realtime

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Find these tables and toggle them **ON**:
   - ✅ `direct_messages`
   - ✅ `conversation_participants`
   - ✅ `user_presence`

**Why:** This allows real-time message updates without refreshing.

---

## Step 3: Create Storage Bucket for Files

### 3.1 Create Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Settings:
   - **Name:** `chat-files`
   - **Public:** ❌ **NO** (keep private)
   - **File size limit:** `10485760` (10MB)
4. Click **Create bucket**

### 3.2 Add Storage Policies

1. Click on `chat-files` bucket
2. Go to **Policies** tab
3. Click **New Policy**

**Policy 1: Upload Files**
- Click **For full customization**
- **Policy name:** `Authenticated users can upload`
- **Allowed operation:** `INSERT`
- **Target roles:** `authenticated`
- **Policy definition:**
```sql
bucket_id = 'chat-files'
```
- Click **Review** → **Save policy**

**Policy 2: View Files**
- Click **New Policy** → **For full customization**
- **Policy name:** `Users can view chat files`
- **Allowed operation:** `SELECT`
- **Target roles:** `authenticated`
- **Policy definition:**
```sql
bucket_id = 'chat-files'
```
- Click **Review** → **Save policy**

---

## Step 4: Verify Setup

### 4.1 Check Tables Exist

Run this in SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'direct_messages',
    'conversations',
    'conversation_participants',
    'mentions',
    'user_presence'
  )
ORDER BY table_name;
```

✅ **Expected output:** All 5 tables listed

### 4.2 Check Functions Exist

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%conversation%'
   OR routine_name LIKE '%presence%'
ORDER BY routine_name;
```

✅ **Expected output:**
- `get_or_create_direct_conversation`
- `get_unread_direct_messages_count`
- `get_user_conversations`
- `mark_conversation_read`
- `update_user_presence`

### 4.3 Test a Function

```sql
-- This should return 0 (no conversations yet)
SELECT get_unread_direct_messages_count();
```

✅ **Expected output:** `0`

---

## Step 5: Test Realtime (Optional but Recommended)

### 5.1 Open Realtime Inspector

1. Supabase Dashboard → **Database** → **Realtime Inspector**
2. You should see:
   - `direct_messages` table
   - `conversation_participants` table
   - `user_presence` table

### 5.2 Test Realtime Subscription

In your browser console (when app is running):

```javascript
const { createClient } = window.supabase;
const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_ANON_KEY'
);

const subscription = supabase
  .channel('test')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'direct_messages'
  }, (payload) => {
    console.log('New message!', payload);
  })
  .subscribe();

console.log('Subscribed to direct_messages');
```

---

## ✅ Database Setup Complete!

You should now have:

1. ✅ All chat tables created
2. ✅ All RLS policies in place
3. ✅ Helper functions available
4. ✅ Realtime enabled
5. ✅ File storage bucket configured

---

## 🚀 Next Steps

Now you can start building the UI components:

1. Create TypeScript types
2. Build DirectMessages component
3. Build ConversationList component
4. Build ChatView component
5. Connect to Supabase Realtime

---

## 🐛 Troubleshooting

### Error: "relation already exists"

**Solution:** Tables already exist. This is OK. The migrations use `IF NOT EXISTS`.

### Error: "permission denied"

**Solution:** Make sure you're logged in as the project owner in Supabase Dashboard.

### Realtime not working

**Solution:**
1. Check that tables are enabled in **Database → Replication**
2. Verify your Supabase URL and anon key are correct
3. Check browser console for subscription errors

### File uploads failing

**Solution:**
1. Verify `chat-files` bucket exists
2. Check storage policies are created
3. Ensure file size is under 10MB

---

## 📞 Need Help?

If you get stuck:

1. Check Supabase logs: **Logs** → **Postgres Logs**
2. Check for migration errors in SQL Editor output
3. Verify RLS policies: **Authentication** → **Policies**
