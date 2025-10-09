# Email Invitation Setup

The user invitation system is currently configured to create invitations in the database, but **email sending is not yet active**. Follow these steps to enable email delivery.

## Current Status

✅ **Working:**
- Invitation creation in database
- Token generation and validation
- Invitation link generation
- Toast notification with manual copy-paste link

❌ **Not Configured:**
- Actual email sending to invited users

## Setup Instructions

### Option 1: SendGrid (Recommended)

1. **Create SendGrid Account**
   - Go to https://sendgrid.com
   - Sign up for free tier (100 emails/day)

2. **Get API Key**
   - Navigate to Settings → API Keys
   - Create new API key with "Mail Send" permission
   - Copy the API key

3. **Add to Netlify Environment Variables**
   ```bash
   # In Netlify Dashboard → Site Settings → Environment Variables
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

4. **Install SendGrid Package**
   ```bash
   npm install @sendgrid/mail
   ```

5. **Update Netlify Function**
   Edit `netlify/functions/send-invitation-email.ts` and uncomment the SendGrid code (around line 93-105):
   ```typescript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   await sgMail.send({
     to: email,
     from: 'noreply@discountfenceusa.com', // Must be verified in SendGrid
     subject: 'You\'ve been invited to Discount Fence Hub',
     html: `
       <h2>You've been invited to join Discount Fence Hub</h2>
       <p>${invitedByName} has invited you to join as a ${role}.</p>
       <p>Click the link below to accept your invitation and create your account:</p>
       <a href="${invitationLink}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
       <p>This invitation will expire in 7 days.</p>
     `,
   });
   ```

6. **Verify Sender Email**
   - In SendGrid, go to Settings → Sender Authentication
   - Verify your domain or single sender email

### Option 2: Resend (Alternative)

1. **Create Resend Account**
   - Go to https://resend.com
   - Sign up (free tier: 3,000 emails/month)

2. **Get API Key**
   - Dashboard → API Keys → Create API Key

3. **Add to Netlify**
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

4. **Install Resend**
   ```bash
   npm install resend
   ```

5. **Update Function**
   ```typescript
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);

   await resend.emails.send({
     from: 'Discount Fence Hub <noreply@discountfenceusa.com>',
     to: email,
     subject: 'You\'ve been invited to Discount Fence Hub',
     html: `...same HTML as SendGrid...`
   });
   ```

### Option 3: AWS SES

1. **Setup AWS SES**
   - Create AWS account
   - Enable SES in your region
   - Verify domain/email

2. **Get Credentials**
   ```bash
   AWS_ACCESS_KEY_ID=xxxxx
   AWS_SECRET_ACCESS_KEY=xxxxx
   AWS_REGION=us-east-1
   ```

3. **Install AWS SDK**
   ```bash
   npm install @aws-sdk/client-ses
   ```

## Testing

After setup:

1. Go to Team Management in the app
2. Click "Invite User"
3. Enter email and select role
4. Check that the email is received
5. Click the invitation link
6. Verify signup works with the token

## Current Workaround

Until email is configured, admins must:
1. Copy the invitation link from the toast message
2. Manually send it to the invited user via text/Slack/etc.
3. User clicks the link to sign up with their invitation token

## Environment Variables Needed

Add to Netlify (whichever service you choose):

```bash
# For SendGrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# OR For Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx

# OR For AWS SES
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx
AWS_REGION=us-east-1

# Already configured
VITE_SUPABASE_URL=xxxxx
VITE_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

## Related Files

- `netlify/functions/send-invitation-email.ts` - Invitation email function
- `src/components/TeamManagement.tsx` - Invitation UI (lines 97-152)
- `src/components/auth/Signup.tsx` - Token validation on signup
- `migrations/007_user_management_enhancements.sql` - Database functions
