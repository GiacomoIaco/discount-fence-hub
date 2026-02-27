import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sendgridApiKey = process.env.SENDGRID_API_KEY;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SendQuoteRequest {
  quoteId: string;
  method: 'email' | 'sms' | 'both';
  email?: string;
  phone?: string;
  message?: string; // Optional custom message
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const payload: SendQuoteRequest = JSON.parse(event.body || '{}');
    const { quoteId, method, email, phone, message } = payload;

    if (!quoteId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing quoteId' }),
      };
    }

    console.log('Sending quote:', { quoteId, method, email, phone });

    // Get quote with client and line items
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select(`
        *,
        client:clients(id, name, primary_contact_name, primary_contact_email, primary_contact_phone),
        community:communities(id, name),
        sales_rep_profile:user_profiles!sales_rep_user_id(id, full_name, email, phone),
        line_items:quote_line_items(*)
      `)
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Quote not found' }),
      };
    }

    // Determine recipient email/phone
    const recipientEmail = email || quote.client?.primary_contact_email;
    const recipientPhone = phone || quote.client?.primary_contact_phone;
    const recipientName = quote.client?.primary_contact_name || quote.client?.name || 'Valued Customer';
    const clientName = quote.client?.name || 'Customer';

    // Validate we have the needed contact info
    if (method === 'email' && !recipientEmail) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No email address available' }),
      };
    }

    if (method === 'sms' && !recipientPhone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No phone number available' }),
      };
    }

    if (method === 'both' && !recipientEmail && !recipientPhone) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No contact information available' }),
      };
    }

    // Generate a secure token for quote viewing
    // We'll use the quote ID + a simple hash for now
    // In production, you might want a separate quote_tokens table
    const viewToken = Buffer.from(`${quoteId}:${Date.now()}`).toString('base64url');

    // Store the token for later verification
    await supabase
      .from('quotes')
      .update({
        view_token: viewToken,
        view_token_created_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const quoteUrl = `${appUrl}/client-quote/${viewToken}`;

    let emailSent = false;
    let smsSent = false;
    const errors: string[] = [];

    // Send email
    if ((method === 'email' || method === 'both') && recipientEmail && sendgridApiKey) {
      try {
        await sendEmail({
          to: recipientEmail,
          recipientName,
          quoteNumber: quote.quote_number,
          total: quote.total,
          validUntil: quote.valid_until,
          quoteUrl,
          salesRepName: quote.sales_rep_profile?.full_name || 'Your Sales Rep',
          salesRepPhone: quote.sales_rep_profile?.phone,
          salesRepEmail: quote.sales_rep_profile?.email,
          customMessage: message,
        });
        emailSent = true;
        console.log('Email sent successfully to:', recipientEmail);
      } catch (err) {
        console.error('Email send error:', err);
        errors.push(`Email failed: ${err}`);
      }
    }

    // Send SMS
    if ((method === 'sms' || method === 'both') && recipientPhone && twilioAccountSid) {
      try {
        const smsText = message
          ? `${message}\n\nView your quote: ${quoteUrl}`
          : `Discount Fence USA: Your quote #${quote.quote_number} for $${quote.total?.toLocaleString()} is ready! View and approve here: ${quoteUrl}`;

        await sendSms(recipientPhone, smsText);
        smsSent = true;
        console.log('SMS sent successfully to:', recipientPhone);
      } catch (err) {
        console.error('SMS send error:', err);
        errors.push(`SMS failed: ${err}`);
      }
    }

    // Update quote status
    if (emailSent || smsSent) {
      const sentMethods: string[] = [];
      if (emailSent) sentMethods.push('email');
      if (smsSent) sentMethods.push('sms');

      await supabase
        .from('quotes')
        .update({
          status: 'sent',
          status_changed_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          sent_method: sentMethods.join(','),
          sent_to_email: emailSent ? recipientEmail : quote.sent_to_email,
          sent_to_phone: smsSent ? recipientPhone : quote.sent_to_phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      // Record in status history
      await supabase
        .from('fsm_status_history')
        .insert({
          entity_type: 'quote',
          entity_id: quoteId,
          from_status: quote.status,
          to_status: 'sent',
          notes: `Sent via ${sentMethods.join(' and ')} to ${recipientEmail || recipientPhone}`,
        });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: emailSent || smsSent,
        emailSent,
        smsSent,
        quoteUrl,
        errors: errors.length > 0 ? errors : undefined,
      }),
    };
  } catch (error) {
    console.error('Send quote error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

interface EmailParams {
  to: string;
  recipientName: string;
  quoteNumber: string;
  total: number | null;
  validUntil: string | null;
  quoteUrl: string;
  salesRepName: string;
  salesRepPhone?: string | null;
  salesRepEmail?: string | null;
  customMessage?: string;
}

async function sendEmail(params: EmailParams): Promise<void> {
  if (!sendgridApiKey) {
    throw new Error('SendGrid not configured');
  }

  const {
    to,
    recipientName,
    quoteNumber,
    total,
    validUntil,
    quoteUrl,
    salesRepName,
    salesRepPhone,
    salesRepEmail,
    customMessage,
  } = params;

  const formattedTotal = total
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)
    : 'See quote for details';

  const formattedValidUntil = validUntil
    ? new Date(validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const html = `
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
      <td style="background-color: #1e40af; padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Discount Fence USA</h1>
        <p style="color: #93c5fd; margin: 8px 0 0; font-size: 14px;">Your Quote is Ready</p>
      </td>
    </tr>

    <!-- Content -->
    <tr>
      <td style="padding: 32px;">
        <p style="color: #374151; font-size: 16px; margin: 0 0 16px;">
          Hi ${recipientName},
        </p>

        ${customMessage ? `<p style="color: #374151; font-size: 16px; margin: 0 0 16px;">${customMessage}</p>` : ''}

        <p style="color: #374151; font-size: 16px; margin: 0 0 24px;">
          Thank you for choosing Discount Fence USA! We've prepared a detailed quote for your fence project.
        </p>

        <!-- Quote Summary Box -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color: #64748b; font-size: 14px; padding: 4px 0;">Quote Number</td>
              <td style="color: #1e293b; font-size: 14px; font-weight: 600; text-align: right; padding: 4px 0;">${quoteNumber}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 14px; padding: 4px 0;">Total Amount</td>
              <td style="color: #1e40af; font-size: 18px; font-weight: 700; text-align: right; padding: 4px 0;">${formattedTotal}</td>
            </tr>
            ${formattedValidUntil ? `
            <tr>
              <td style="color: #64748b; font-size: 14px; padding: 4px 0;">Valid Until</td>
              <td style="color: #1e293b; font-size: 14px; text-align: right; padding: 4px 0;">${formattedValidUntil}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${quoteUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            View & Approve Quote
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; margin: 24px 0;">
          Click the button above to view the complete quote details, line items, and terms. You can approve the quote directly online.
        </p>

        <!-- Sales Rep Contact -->
        <div style="background-color: #fefce8; border: 1px solid #fde047; border-radius: 8px; padding: 16px; margin: 24px 0;">
          <p style="color: #713f12; font-size: 14px; margin: 0 0 8px; font-weight: 600;">Questions? Contact your sales representative:</p>
          <p style="color: #78350f; font-size: 14px; margin: 0;">
            ${salesRepName}
            ${salesRepPhone ? `<br>📞 <a href="tel:${salesRepPhone}" style="color: #78350f;">${salesRepPhone}</a>` : ''}
            ${salesRepEmail ? `<br>✉️ <a href="mailto:${salesRepEmail}" style="color: #78350f;">${salesRepEmail}</a>` : ''}
          </p>
        </div>

        <p style="color: #9ca3af; font-size: 12px; margin: 24px 0 0; padding-top: 24px; border-top: 1px solid #e5e7eb;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${quoteUrl}" style="color: #1e40af; word-break: break-all;">${quoteUrl}</a>
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background-color: #f9fafb; padding: 24px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          Discount Fence USA<br>
          Austin, TX | (512) 443-3623
        </p>
        <p style="color: #9ca3af; font-size: 11px; margin: 16px 0 0;">
          This quote was sent to you because you requested an estimate from Discount Fence USA.
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
      from: { email: 'quotes@discountfenceusa.com', name: 'Discount Fence USA' },
      subject: `Your Quote #${quoteNumber} from Discount Fence USA`,
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
    throw new Error('Twilio not configured');
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
