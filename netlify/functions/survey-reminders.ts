import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';

/**
 * Survey Reminders - Runs daily to send reminders to non-responders
 *
 * This function:
 * 1. Finds active distributions with reminders enabled
 * 2. Checks reminder_days against days since send
 * 3. Sends reminders to recipients who haven't responded
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Survey reminders running at:', new Date().toISOString());

  try {
    // Find active distributions (sent but not expired) from campaigns with reminders enabled
    const now = new Date();

    const { data: distributions, error: distError } = await supabase
      .from('survey_distributions')
      .select(`
        *,
        campaign:survey_campaigns(
          id,
          name,
          send_reminders,
          reminder_days,
          delivery_methods
        ),
        survey:surveys(title, description, brand_config)
      `)
      .not('sent_at', 'is', null)
      .or(`expires_at.is.null,expires_at.gte.${now.toISOString()}`);

    if (distError) {
      console.error('Error fetching distributions:', distError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch distributions' }) };
    }

    if (!distributions || distributions.length === 0) {
      console.log('No active distributions found');
      return { statusCode: 200, body: JSON.stringify({ message: 'No distributions to process', sent: 0 }) };
    }

    let totalReminders = 0;

    for (const dist of distributions) {
      const campaign = dist.campaign as any;
      const survey = dist.survey as any;

      // Skip if reminders not enabled
      if (!campaign?.send_reminders || !campaign?.reminder_days) {
        continue;
      }

      const sentAt = new Date(dist.sent_at);
      const daysSinceSend = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check each reminder day
      const reminderDays = campaign.reminder_days as number[];
      let reminderNumber: 1 | 2 | null = null;

      if (reminderDays[0] && daysSinceSend === reminderDays[0] && !dist.reminder_1_sent_at) {
        reminderNumber = 1;
      } else if (reminderDays[1] && daysSinceSend === reminderDays[1] && !dist.reminder_2_sent_at) {
        reminderNumber = 2;
      }

      if (!reminderNumber) {
        continue;
      }

      console.log(`Processing reminder ${reminderNumber} for distribution ${dist.id} (day ${daysSinceSend})`);

      // Find non-responders
      const { data: recipients, error: recipientsError } = await supabase
        .from('survey_recipients')
        .select('*')
        .eq('distribution_id', dist.id)
        .is('completed_at', null);

      if (recipientsError || !recipients || recipients.length === 0) {
        console.log(`No non-responders found for distribution ${dist.id}`);
        continue;
      }

      console.log(`Found ${recipients.length} non-responders`);

      const deliveryMethods = campaign.delivery_methods || ['email'];
      const brandConfig = survey?.brand_config || {};
      const companyName = brandConfig.companyName || 'Discount Fence USA';
      const primaryColor = brandConfig.primaryColor || '#059669';

      let remindersSent = 0;

      for (const recipient of recipients) {
        // Check if already unsubscribed
        if (recipient.contact_id) {
          const { data: contact } = await supabase
            .from('survey_population_contacts')
            .select('unsubscribed_at')
            .eq('id', recipient.contact_id)
            .single();

          if (contact?.unsubscribed_at) {
            continue;
          }
        }

        const surveyUrl = `${appUrl}/survey?token=${recipient.response_token}`;
        const unsubscribeUrl = `${appUrl}/.netlify/functions/survey-unsubscribe?token=${recipient.response_token}`;

        // Send email reminder
        if (deliveryMethods.includes('email') && recipient.recipient_email && sendgridApiKey) {
          try {
            await sendReminderEmail({
              to: recipient.recipient_email,
              recipientName: recipient.recipient_name,
              surveyTitle: survey?.title || 'Survey',
              surveyUrl,
              unsubscribeUrl,
              companyName,
              primaryColor,
              reminderNumber,
            });

            await supabase
              .from('survey_recipients')
              .update({ [`reminder_${reminderNumber}_sent_at`]: now.toISOString() })
              .eq('id', recipient.id);

            remindersSent++;
          } catch (err) {
            console.error(`Failed to send email reminder to ${recipient.recipient_email}:`, err);
          }
        }

        // Send SMS reminder
        if (deliveryMethods.includes('sms') && recipient.recipient_phone && twilioAccountSid) {
          try {
            const smsText = `Reminder: We'd still love your feedback! Complete our quick survey: ${surveyUrl}`;
            await sendSms(recipient.recipient_phone, smsText);
            remindersSent++;
          } catch (err) {
            console.error(`Failed to send SMS reminder to ${recipient.recipient_phone}:`, err);
          }
        }
      }

      // Update distribution with reminder sent timestamp
      await supabase
        .from('survey_distributions')
        .update({ [`reminder_${reminderNumber}_sent_at`]: now.toISOString() })
        .eq('id', dist.id);

      totalReminders += remindersSent;
      console.log(`Sent ${remindersSent} reminders for distribution ${dist.id}`);
    }

    console.log(`Reminders complete: ${totalReminders} total sent`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reminders sent',
        totalSent: totalReminders,
      }),
    };

  } catch (error) {
    console.error('Reminders error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

interface ReminderEmailParams {
  to: string;
  recipientName?: string | null;
  surveyTitle: string;
  surveyUrl: string;
  unsubscribeUrl: string;
  companyName: string;
  primaryColor: string;
  reminderNumber: 1 | 2;
}

async function sendReminderEmail(params: ReminderEmailParams): Promise<void> {
  const { to, recipientName, surveyTitle, surveyUrl, unsubscribeUrl, companyName, primaryColor, reminderNumber } = params;

  const subject = reminderNumber === 1
    ? `Reminder: We'd love your feedback - ${surveyTitle}`
    : `Last chance: Share your thoughts - ${surveyTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: ${primaryColor}; padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${companyName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi${recipientName ? ` ${recipientName}` : ''},
        </p>
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          ${reminderNumber === 1
            ? "We noticed you haven't had a chance to complete our survey yet. Your feedback is incredibly valuable to us!"
            : "This is a gentle reminder - we'd really appreciate hearing from you before the survey closes."
          }
        </p>
        <h2 style="color: #111827; font-size: 20px; margin: 24px 0 8px;">${surveyTitle}</h2>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Take Survey Now
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
          It only takes 2-3 minutes, and your input helps us serve you better.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          ${companyName}
        </p>
        <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0;">
          <a href="${unsubscribeUrl}" style="color: #9ca3af;">Unsubscribe from survey emails</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sendgridApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'surveys@discountfenceusa.com', name: 'Discount Fence USA' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SendGrid API error: ${errorText}`);
  }
}

async function sendSms(to: string, message: string): Promise<void> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    return;
  }

  let formattedPhone = to.replace(/[^\d+]/g, '');
  if (!formattedPhone.startsWith('+')) {
    if (formattedPhone.length === 10) {
      formattedPhone = '+1' + formattedPhone;
    } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
      formattedPhone = '+' + formattedPhone;
    }
  }

  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhoneNumber,
        Body: message.substring(0, 160),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio API error: ${errorText}`);
  }
}

// Run daily at 10 AM UTC
export const config: Config = {
  schedule: '0 10 * * *',
};

export { handler };
