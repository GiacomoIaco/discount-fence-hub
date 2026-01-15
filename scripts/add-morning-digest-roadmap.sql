-- Run this in Supabase SQL Editor to add Morning Digest to roadmap

INSERT INTO roadmap_items (code, title, hub, status, importance, complexity, raw_idea, claude_analysis)
VALUES (
  'O-050',
  'Deploy Morning Digest Email System',
  'ops-hub',
  'idea',
  3,
  'M',
  'Complete setup and deployment of morning digest email notifications for schedule updates. Code is ready (migration 179 + Edge Function), needs deployment and configuration.',
  '## Morning Digest Deployment Checklist

### Prerequisites
- [x] Database migration created (179_notification_preferences.sql)
- [x] Edge Function code written (supabase/functions/morning-digest/index.ts)
- [ ] Apply migration to production database
- [ ] Deploy Edge Function to Supabase

### Step 1: Apply Database Migration
Run migration 179 to create:
- **notification_preferences** table - User email settings
- **notification_log** table - Sent notification tracking
- **users_for_morning_digest** view

### Step 2: Deploy Edge Function
```bash
supabase functions deploy morning-digest
```

### Step 3: Set Up Email Provider (Resend)
1. Create account at resend.com
2. Verify domain (discountfence.com or subdomain)
3. Get API key
4. Add secret: `supabase secrets set RESEND_API_KEY=re_xxxxx`

### Step 4: Set Up Cron Trigger
Create hourly cron job using pg_cron:
```sql
SELECT cron.schedule(
  ''morning-digest-hourly'',
  ''0 * * * *'',
  $$SELECT net.http_post(
    url := ''https://ywtciftyqfvxbccbnsgh.supabase.co/functions/v1/morning-digest'',
    headers := ''{"Authorization": "Bearer <service_role_key>"}''::jsonb
  )$$
);
```

### Step 5: Build Notification Settings UI
Add Settings > Notifications page for user preferences:
- Enable/disable morning digest
- Set preferred digest time (default 6am CST)
- Choose notification types
- Set quiet hours

### Step 6: Test End-to-End
1. Create test notification preference for your user
2. Schedule some entries for tomorrow
3. Manually trigger the function
4. Verify email received

### Environment Variables Needed
| Variable | Description |
|----------|-------------|
| RESEND_API_KEY | Email provider API key |
| PUBLIC_SITE_URL | App URL for links in emails |

### Future Enhancements
- SMS notifications via Twilio
- Push notifications (web/mobile)
- Slack/Teams integration
- Real-time schedule change alerts'
)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  claude_analysis = EXCLUDED.claude_analysis,
  updated_at = now();
