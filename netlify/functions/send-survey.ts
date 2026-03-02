import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SendSurveyRequest {
  campaignId?: string;
  surveyId: string;
  populationId: string;
  deliveryMethods: ('email' | 'sms')[];
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload: SendSurveyRequest = JSON.parse(event.body || '{}');
    const { campaignId, surveyId, populationId, deliveryMethods } = payload;

    if (!surveyId || !populationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing surveyId or populationId' }),
      };
    }

    console.log('Starting survey distribution:', { campaignId, surveyId, populationId });

    // Get survey details
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('*')
      .eq('id', surveyId)
      .single();

    if (surveyError || !survey) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Survey not found' }),
      };
    }

    // Get population contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('survey_population_contacts')
      .select('*')
      .eq('population_id', populationId)
      .eq('is_active', true)
      .is('unsubscribed_at', null);

    if (contactsError || !contacts?.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No active contacts found in population' }),
      };
    }

    console.log(`Found ${contacts.length} contacts to send to`);

    // Get campaign details if exists
    let distributionNumber = 1;
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('survey_campaigns')
        .select('total_distributions')
        .eq('id', campaignId)
        .single();
      distributionNumber = (campaign?.total_distributions || 0) + 1;
    }

    // Create distribution record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 day deadline

    const { data: distribution, error: distError } = await supabase
      .from('survey_distributions')
      .insert({
        campaign_id: campaignId || null,
        survey_id: surveyId,
        population_id: populationId,
        distribution_number: distributionNumber,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        total_sent: contacts.length,
      })
      .select()
      .single();

    if (distError || !distribution) {
      console.error('Failed to create distribution:', distError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create distribution' }),
      };
    }

    // Update campaign total_distributions
    if (campaignId) {
      await supabase
        .from('survey_campaigns')
        .update({
          total_distributions: distributionNumber,
          last_sent_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', campaignId);
    }

    // Create recipient records and send messages
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const brandConfig = survey.brand_config || {};
    const companyName = brandConfig.companyName || 'Discount Fence USA';
    const primaryColor = brandConfig.primaryColor || '#059669';

    let emailsSent = 0;
    let smsSent = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        // Create recipient record with unique token
        const { data: recipient, error: recipientError } = await supabase
          .from('survey_recipients')
          .insert({
            distribution_id: distribution.id,
            contact_id: contact.id,
            recipient_name: contact.contact_name,
            recipient_email: contact.contact_email,
            recipient_phone: contact.contact_phone,
            recipient_company: contact.contact_company,
            recipient_metadata: contact.metadata,
          })
          .select()
          .single();

        if (recipientError || !recipient) {
          console.error('Failed to create recipient:', recipientError);
          failed++;
          continue;
        }

        const surveyUrl = `${appUrl}/survey?token=${recipient.response_token}`;
        const unsubscribeUrl = `${appUrl}/.netlify/functions/survey-unsubscribe?token=${recipient.response_token}`;

        // Send email
        if (deliveryMethods.includes('email') && contact.contact_email && resendApiKey) {
          try {
            await sendEmail({
              to: contact.contact_email,
              subject: `We'd love your feedback - ${survey.title}`,
              html: generateEmailHtml({
                recipientName: contact.contact_name,
                surveyTitle: survey.title,
                surveyDescription: survey.description,
                surveyUrl,
                companyName,
                primaryColor,
                logoUrl: brandConfig.logo,
                unsubscribeUrl,
              }),
            });

            await supabase
              .from('survey_recipients')
              .update({
                email_status: 'sent',
                email_sent_at: new Date().toISOString(),
              })
              .eq('id', recipient.id);

            emailsSent++;
          } catch (err) {
            console.error(`Failed to send email to ${contact.contact_email}:`, err);
            await supabase
              .from('survey_recipients')
              .update({
                email_status: 'failed',
                email_error: String(err),
              })
              .eq('id', recipient.id);
          }
        }

        // Send SMS
        if (deliveryMethods.includes('sms') && contact.contact_phone && twilioAccountSid) {
          try {
            const shortTitle = survey.title.length > 25
              ? survey.title.substring(0, 22) + '...'
              : survey.title;
            const smsText = `${companyName}: We'd love your feedback! Please take our quick survey: "${shortTitle}" ${surveyUrl}`;

            await sendSms(contact.contact_phone, smsText);

            await supabase
              .from('survey_recipients')
              .update({
                sms_status: 'sent',
                sms_sent_at: new Date().toISOString(),
              })
              .eq('id', recipient.id);

            smsSent++;
          } catch (err) {
            console.error(`Failed to send SMS to ${contact.contact_phone}:`, err);
            await supabase
              .from('survey_recipients')
              .update({
                sms_status: 'failed',
                sms_error: String(err),
              })
              .eq('id', recipient.id);
          }
        }
      } catch (err) {
        console.error('Error processing contact:', err);
        failed++;
      }
    }

    // Update distribution stats
    await supabase
      .from('survey_distributions')
      .update({
        total_delivered: emailsSent + smsSent,
      })
      .eq('id', distribution.id);

    console.log(`Distribution complete: ${emailsSent} emails, ${smsSent} SMS, ${failed} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        distributionId: distribution.id,
        sent: contacts.length,
        emailsSent,
        smsSent,
        failed,
      }),
    };
  } catch (error) {
    console.error('Send survey error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

interface EmailParams {
  recipientName?: string | null;
  surveyTitle: string;
  surveyDescription?: string | null;
  surveyUrl: string;
  companyName: string;
  primaryColor: string;
  logoUrl?: string;
  unsubscribeUrl: string;
}

function generateEmailHtml(params: EmailParams): string {
  const { recipientName, surveyTitle, surveyDescription, surveyUrl, companyName, primaryColor, logoUrl, unsubscribeUrl } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background-color: ${primaryColor}; padding: 32px; text-align: center;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="height: 48px; margin-bottom: 16px;">` : ''}
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${companyName}</h1>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi${recipientName ? ` ${recipientName}` : ''},
        </p>

        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          We value your opinion and would love to hear from you! Please take a few minutes to complete our survey:
        </p>

        <h2 style="color: #111827; font-size: 20px; margin: 24px 0 8px;">${surveyTitle}</h2>

        ${surveyDescription ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">${surveyDescription}</p>` : ''}

        <div style="text-align: center; margin: 32px 0;">
          <a href="${surveyUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Take Survey
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0 0;">
          Your feedback helps us improve our services. This survey should only take 2-3 minutes to complete.
        </p>

        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${surveyUrl}" style="color: ${primaryColor};">${surveyUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          ${companyName}<br>
          You received this because you are a valued customer.
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
}

async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!resendApiKey) {
    console.log('Resend not configured, skipping email');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Discount Fence USA <surveys@discountfenceusa.com>',
      to: [params.to],
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${errorText}`);
  }
}

async function sendSms(to: string, message: string): Promise<void> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log('Twilio not configured, skipping SMS');
    return;
  }

  // Format phone number
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
