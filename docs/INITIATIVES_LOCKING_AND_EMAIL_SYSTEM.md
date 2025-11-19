# Initiatives Tab: Locking & Email Automation System

## Overview

This document describes the complete implementation of the 5-point locking and email automation system for the Initiatives tab.

## ✅ Completed: Database Infrastructure

### Migration 036: `initiative_week_locks`

**Table Structure:**
```sql
initiative_week_locks
├── week_start_date (DATE, UNIQUE) - Monday of each week
├── locked (BOOLEAN) - Is the week locked?
├── locked_at, locked_by, lock_reason
├── in_grace_period (BOOLEAN) - Friday 2pm to Monday 12pm
├── grace_period_ends_at (TIMESTAMPTZ)
├── unlocked_by, unlocked_at, unlock_reason - CEO override tracking
├── summary_email_sent, summary_email_sent_at
└── reminder_email_sent, reminder_email_sent_at
```

**Helper Functions:**
- `is_week_locked(date)` - Check if week is locked (accounts for grace period)
- `lock_week(date, user_id, reason)` - Lock a week (auto or manual)
- `unlock_week(date, user_id, reason)` - CEO override to unlock
- `end_grace_period(date)` - End grace period Monday 12pm
- `mark_summary_email_sent(date)` - Track email delivery
- `mark_reminder_email_sent(date)` - Track reminder email

**Lock Reasons:**
- `auto_friday_2pm` - Automatic lock at Friday 2pm (starts grace period)
- `auto_monday_12pm` - Grace period ends
- `manual` - Admin/CEO manual lock

## 📋 Implementation Plan

### Phase 1: UI Locking (Next Steps)

**File:** `src/features/leadership/components/InitiativeTimelineTab.tsx`

**Changes Needed:**

1. **Add Week Lock Query:**
```typescript
const { data: weekLock } = useQuery({
  queryKey: ['weekLock', selectedWeek],
  queryFn: async () => {
    const { data } = await supabase
      .from('initiative_week_locks')
      .select('*')
      .eq('week_start_date', selectedWeek.toISOString().split('T')[0])
      .single();
    return data;
  }
});

const isWeekLocked = weekLock?.locked && !weekLock?.in_grace_period;
const isInGracePeriod = weekLock?.in_grace_period;
```

2. **Disable Editing for Locked Weeks:**
```typescript
// In InitiativeTableRow
const canEdit = isCurrentWeek || (!isWeekLocked && isInGracePeriod);

// Update "This Week" column
<td className={`px-4 py-3 align-top ${isCurrentWeek ? 'bg-blue-50' : ''}`}>
  {canEdit ? (
    // Editable textarea
  ) : (
    // Readonly display with lock icon
    <div className="text-sm text-gray-500 italic flex items-center gap-2">
      <Lock className="w-4 h-4" />
      Week locked {isInGracePeriod && '(grace period)'}
    </div>
  )}
</td>
```

3. **Add Lock Indicator to Header:**
```typescript
// In table header
<th className={`... ${isWeekLocked ? 'bg-red-50' : isCurrentWeek ? 'bg-blue-50' : 'bg-gray-50'}`}>
  <div className="flex items-center gap-2">
    {isWeekLocked && <Lock className="w-4 h-4 text-red-600" />}
    {isInGracePeriod && <Clock className="w-4 h-4 text-orange-600" />}
    <span>Selected Week</span>
    <span className="...">
      {formatWeekHeader(selectedWeek, isCurrentWeek)}
      {isInGracePeriod && ' (Grace Period)'}
    </span>
  </div>
</th>
```

4. **Add CEO Override Button:**
```typescript
{isWeekLocked && profile?.role === 'admin' && (
  <button
    onClick={() => handleUnlockWeek()}
    className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
  >
    <Unlock className="w-4 h-4" />
    Unlock Week (CEO Override)
  </button>
)}

const handleUnlockWeek = async () => {
  const reason = window.prompt('Reason for unlocking this week:');
  if (!reason) return;

  const { error } = await supabase.rpc('unlock_week', {
    p_week_start_date: selectedWeek.toISOString().split('T')[0],
    p_unlocked_by: user.id,
    p_unlock_reason: reason
  });

  if (error) {
    toast.error('Failed to unlock week');
  } else {
    toast.success('Week unlocked');
    // Refresh data
  }
};
```

### Phase 2: Netlify Scheduled Functions

**Location:** `netlify/functions/`

#### 1. Thursday 5pm Reminder

**File:** `send-weekly-reminder.ts`

```typescript
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Resend from 'resend';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

const handler = schedule('0 17 * * 4', async () => { // Thursday 5pm
  const currentWeek = getMondayOfCurrentWeek();

  // Check if reminder already sent
  const { data: lock } = await supabase
    .from('initiative_week_locks')
    .select('reminder_email_sent')
    .eq('week_start_date', currentWeek)
    .single();

  if (lock?.reminder_email_sent) return { statusCode: 200 };

  // Get all leadership users
  const { data: users } = await supabase
    .from('user_profiles')
    .select('email, full_name')
    .not('email', 'is', null);

  // Send reminder email
  await resend.emails.send({
    from: 'Leadership Updates <updates@yourdomain.com>',
    to: users.map(u => u.email),
    subject: 'Reminder: Submit Weekly Updates by Tomorrow 2pm',
    html: `
      <h2>Weekly Update Reminder</h2>
      <p>Hi team,</p>
      <p>This is a friendly reminder to submit your initiative updates for this week
         (${formatWeekRange(currentWeek)}) by <strong>Friday at 2pm EST</strong>.</p>
      <p>After the deadline, the week will be locked and the summary email will be sent
         to the entire leadership team.</p>
      <p><a href="${process.env.VITE_APP_URL}/leadership">Submit Updates Now</a></p>
    `
  });

  // Mark reminder as sent
  await supabase.rpc('mark_reminder_email_sent', {
    p_week_start_date: currentWeek
  });

  return { statusCode: 200 };
});

export { handler };
```

#### 2. Friday 2pm: Lock Week & Send Summary

**File:** `send-weekly-summary.ts`

```typescript
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import Resend from 'resend';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY);

const handler = schedule('0 14 * * 5', async () => { // Friday 2pm
  const currentWeek = getMondayOfCurrentWeek();

  // 1. Lock the week (with grace period)
  await supabase.rpc('lock_week', {
    p_week_start_date: currentWeek,
    p_locked_by: null,
    p_lock_reason: 'auto_friday_2pm'
  });

  // 2. Fetch all updates for this week
  const { data: updates } = await supabase
    .from('initiative_updates')
    .select(`
      *,
      initiative:project_initiatives(
        title,
        area:project_areas(
          name,
          function:project_functions(name)
        )
      ),
      author:user_profiles(full_name)
    `)
    .eq('week_start_date', currentWeek);

  // 3. Group by Function → Area → Initiative
  const groupedUpdates = groupUpdatesByHierarchy(updates);

  // 4. Generate HTML email
  const emailHtml = generateSummaryHTML(groupedUpdates, currentWeek);

  // 5. Send email
  const { data: settings } = await supabase
    .from('project_settings')
    .select('setting_value')
    .eq('setting_key', 'email_schedule')
    .single();

  const recipients = getRecipients(settings?.setting_value);

  await resend.emails.send({
    from: 'Leadership Weekly Summary <updates@yourdomain.com>',
    to: recipients,
    subject: `Leadership Weekly Summary - Week of ${formatWeekRange(currentWeek)}`,
    html: emailHtml
  });

  // 6. Mark email as sent
  await supabase.rpc('mark_summary_email_sent', {
    p_week_start_date: currentWeek
  });

  return { statusCode: 200 };
});

function generateSummaryHTML(grouped, weekDate) {
  let html = `
    <h1>Leadership Weekly Summary</h1>
    <h2>Week of ${formatWeekRange(weekDate)}</h2>
    <hr>
  `;

  for (const [functionName, areas] of Object.entries(grouped)) {
    html += `<h2>📊 ${functionName}</h2>`;

    for (const [areaName, initiatives] of Object.entries(areas)) {
      html += `<h3 style="margin-left: 20px;">▸ ${areaName}</h3>`;

      for (const [initiativeName, updates] of Object.entries(initiatives)) {
        const update = updates[0]; // Should only be one per week
        html += `
          <div style="margin-left: 40px; margin-bottom: 20px;">
            <h4>✓ ${initiativeName}</h4>
            <p style="margin-left: 20px; color: #444;">
              ${update.update_text}
            </p>
            <p style="margin-left: 20px; font-size: 12px; color: #888;">
              — ${update.author.full_name}
            </p>
          </div>
        `;
      }
    }
  }

  return html;
}

export { handler };
```

#### 3. Monday 12pm: End Grace Period

**File:** `end-grace-period.ts`

```typescript
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const handler = schedule('0 12 * * 1', async () => { // Monday 12pm
  const lastWeek = getMondayOfLastWeek();

  // End grace period for last week
  await supabase.rpc('end_grace_period', {
    p_week_start_date: lastWeek
  });

  // Optional: Send notification to anyone with pending updates
  // (Implementation depends on whether you want this)

  return { statusCode: 200 };
});

export { handler };
```

### Phase 3: Email Configuration

**Environment Variables Needed:**
```env
RESEND_API_KEY=re_...
VITE_APP_URL=https://yourapp.netlify.app
```

**Email Settings UI** (Already Built):
- Navigate to Settings → Email Settings
- Configure schedule (default: Friday 2pm EST)
- Configure recipients:
  - All leadership users
  - Per function (separate emails)
  - Custom email list

## 🎯 The 5-Point System in Action

### 1. **Hard Deadline: Friday 2pm**
- Netlify function runs automatically
- Calls `lock_week()` with reason `auto_friday_2pm`
- Week becomes read-only (except during grace period)

### 2. **Grace Period: Until Monday 12pm**
- Week record has `in_grace_period = true`
- UI still allows editing (with warning badge)
- `is_week_locked()` returns false during grace period

### 3. **CEO Override: Unlock Any Week**
- Admin/CEO sees "Unlock Week" button on locked weeks
- Calls `unlock_week()` function
- Records reason in audit trail
- Week becomes editable again

### 4. **Lock Indicators in UI**
- 🔒 Red lock icon on locked weeks
- 🕒 Orange clock icon during grace period
- Red header background for locked weeks
- Warning message: "Week locked - contact admin to unlock"

### 5. **Email Notification Flow**

**Thursday 5pm:**
- ✉️ Reminder email to all leadership
- "Submit your updates by Friday 2pm"

**Friday 2pm:**
- 🔒 Week auto-locks (with grace period)
- ✉️ Summary email sent to configured recipients
- Marks `summary_email_sent = true`

**Monday 12pm:**
- 🔒 Grace period ends
- Week becomes permanently read-only (unless CEO overrides)
- Marks `lock_reason = 'auto_monday_12pm'`

## 📊 Monitoring & Audit Trail

All actions are tracked in `initiative_week_locks`:

```sql
SELECT
  week_start_date,
  locked,
  in_grace_period,
  lock_reason,
  summary_email_sent_at,
  unlocked_by,
  unlock_reason
FROM initiative_week_locks
ORDER BY week_start_date DESC;
```

**Key Metrics:**
- Email delivery success rate
- Weeks requiring CEO override
- Grace period usage patterns
- Compliance: % of updates submitted before deadline

## 🚀 Next Steps to Complete

1. **Update UI** (1-2 hours):
   - Add lock status query
   - Disable editing for locked weeks
   - Add lock indicators to headers
   - Implement CEO override button

2. **Test Netlify Functions Locally** (30 mins):
   ```bash
   netlify dev
   netlify functions:invoke send-weekly-reminder
   ```

3. **Deploy and Configure** (30 mins):
   - Add RESEND_API_KEY to Netlify environment
   - Verify scheduled functions are registered
   - Test with staging data

4. **User Training** (1 hour):
   - Explain grace period to team
   - Show CEO override process
   - Demonstrate email settings configuration

## 🎓 Benefits

✅ **Accountability**: Clear deadlines enforce discipline
✅ **Flexibility**: Grace period accommodates Monday morning reviews
✅ **Audit Trail**: Complete history of locks/unlocks
✅ **Automation**: Zero manual work after setup
✅ **Visibility**: Weekly emails keep everyone aligned
✅ **Control**: CEO can override when needed

---

**Status**: Database ✅ | UI ⏳ | Email Functions ⏳ | Testing ⏳
