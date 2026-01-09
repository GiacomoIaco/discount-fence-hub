import { Handler } from '@netlify/functions';

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const sendGridApiKey = process.env.SENDGRID_API_KEY;

interface ApprovalNotificationRequest {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  approvedBy: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { email, name, phone, role, approvedBy }: ApprovalNotificationRequest = JSON.parse(
      event.body || '{}'
    );

    if (!email || !name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const results: { email?: boolean; sms?: boolean } = {};

    // 1. Send Email via SendGrid
    if (sendGridApiKey) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Your Account Has Been Approved!</h2>
            <p>Hi ${name},</p>
            <p>Great news! ${approvedBy} has approved your access to <strong>Discount Fence Hub</strong>.</p>
            <p>You've been assigned the role of <strong>${role}</strong>.</p>
            <div style="margin: 30px 0;">
              <a href="${appUrl}"
                 style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
                Open Discount Fence Hub
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">You can now log in with the email and password you created during signup.</p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-top: 24px;">
              <h3 style="margin: 0 0 8px 0; color: #0369a1; font-size: 14px;">📱 Install the App</h3>
              <p style="margin: 0; font-size: 13px; color: #0c4a6e;">
                <strong>iPhone:</strong> Tap Share → Add to Home Screen<br>
                <strong>Android:</strong> Tap Menu (⋮) → Install App
              </p>
            </div>
          </div>
        `;

        const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sendGridApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: { email: 'giacomo@discountfenceusa.com', name: 'Discount Fence Hub' },
            subject: 'Your Account Has Been Approved!',
            content: [{ type: 'text/html', value: emailHtml }],
          }),
        });

        results.email = sendGridResponse.ok;
        if (!sendGridResponse.ok) {
          console.error('SendGrid error:', await sendGridResponse.text());
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        results.email = false;
      }
    }

    // 2. Send SMS via Twilio (if phone provided)
    if (phone && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      try {
        // Format phone number
        let formattedPhone = phone.replace(/[^\d+]/g, '');
        if (!formattedPhone.startsWith('+')) {
          if (formattedPhone.length === 10) {
            formattedPhone = '+1' + formattedPhone;
          } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
            formattedPhone = '+' + formattedPhone;
          }
        }

        const smsBody = `${name}, your Discount Fence Hub account has been approved! You can now log in at ${appUrl}`;

        const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
        const twilioResponse = await fetch(
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
              Body: smsBody,
            }),
          }
        );

        results.sms = twilioResponse.ok;
        if (!twilioResponse.ok) {
          console.error('Twilio error:', await twilioResponse.text());
        }
      } catch (smsError) {
        console.error('Error sending SMS:', smsError);
        results.sms = false;
      }
    }

    console.log('Approval notification results:', { email, phone: phone?.substring(0, 6) + '...', results });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        results,
      }),
    };
  } catch (error) {
    console.error('Error sending approval notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
