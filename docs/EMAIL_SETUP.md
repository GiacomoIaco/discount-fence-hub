# Email Setup

The user invitation system and all notification emails are sent via **Resend**.

## Current Status

- **Working:** All email sending via Resend API
- **Provider:** [Resend](https://resend.com)
- **Env Variable:** `RESEND_API_KEY`

## Setup Instructions

### Resend

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up (free tier: 3,000 emails/month)

2. **Verify Domain**
   - Dashboard -> Domains -> Add Domain
   - Add the DNS records for `discountfenceusa.com`

3. **Get API Key**
   - Dashboard -> API Keys -> Create API Key

4. **Add to Netlify Environment Variables**
   ```bash
   # In Netlify Dashboard -> Site Settings -> Environment Variables
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

## Sending Pattern

All functions use the Resend REST API directly (no SDK needed):

```typescript
const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: 'Discount Fence Hub <giacomo@discountfenceusa.com>',
    to: [recipientEmail],
    subject: 'Your Subject',
    html: emailHtml,
  }),
});
```

## From Addresses

| Function | From Address |
|----------|-------------|
| General / Approval | `Discount Fence Hub <giacomo@discountfenceusa.com>` |
| Quotes | `Discount Fence USA <quotes@discountfenceusa.com>` |
| Surveys | `Discount Fence USA <surveys@discountfenceusa.com>` |
| Notifications | `Discount Fence Hub <notifications@discountfenceusa.com>` |
| Weekly Summary | `Leadership Weekly Summary <giacomo@discountfenceusa.com>` |
| Weekly Reminder | `Leadership Updates <giacomo@discountfenceusa.com>` |

## Testing

After setup:

1. Go to Team Management in the app
2. Click "Invite User"
3. Enter email and select role
4. Check that the email is received
5. Click the invitation link
6. Verify signup works with the token

Or use the test function:
```bash
curl -X POST https://discount-fence-hub.netlify.app/.netlify/functions/test-email \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

## Environment Variables Needed

Add to Netlify:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Already configured
VITE_SUPABASE_URL=xxxxx
VITE_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

## Related Files

- `netlify/functions/send-quote.ts` - Quote emails
- `netlify/functions/send-approval-notification.ts` - Account approval emails
- `netlify/functions/send-survey.ts` - Survey distribution emails
- `netlify/functions/survey-reminders.ts` - Survey reminder emails
- `netlify/functions/send-roadmap-notification.ts` - Roadmap notification emails
- `netlify/functions/send-announcement-notification.ts` - Announcement emails
- `netlify/functions/send-initiative-notification.ts` - Initiative/task emails
- `netlify/functions/send-request-notification.ts` - Request notification emails
- `netlify/functions/send-chat-notification.ts` - Chat notification emails
- `netlify/functions/send-weekly-summary.ts` - Weekly summary emails
- `netlify/functions/send-weekly-reminder.ts` - Weekly reminder emails
- `netlify/functions/test-email.ts` - Test email function
- `netlify/edge-functions/weekly-summary-email.ts` - Edge function weekly summary
- `scripts/test-sendgrid.ts` - Local test script (now uses Resend)
