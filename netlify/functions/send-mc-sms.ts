import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SendMCSmsRequest {
  message_id: string;
  to: string;
  body: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check Twilio config
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.error('Twilio not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Twilio not configured' }),
    };
  }

  try {
    const { message_id, to, body }: SendMCSmsRequest = JSON.parse(event.body || '{}');

    if (!message_id || !to || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: message_id, to, body' }),
      };
    }

    console.log(`Sending MC SMS to ${to} for message ${message_id}`);

    // Check if contact is opted out
    const { data: message } = await supabase
      .from('mc_messages')
      .select(`
        *,
        conversation:mc_conversations(
          contact:mc_contacts(sms_opted_out)
        )
      `)
      .eq('id', message_id)
      .single();

    if (message?.conversation?.contact?.sms_opted_out) {
      // Update message as failed
      await supabase
        .from('mc_messages')
        .update({
          status: 'failed',
          error_message: 'Contact has opted out of SMS',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Contact has opted out of SMS' }),
      };
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

    // Send via Twilio
    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const statusCallbackUrl = `${appUrl}/.netlify/functions/twilio-status-webhook`;

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
          Body: body,
          StatusCallback: statusCallbackUrl,
        }),
      }
    );

    const twilioResult = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', twilioResult);

      // Update message as failed
      await supabase
        .from('mc_messages')
        .update({
          status: 'failed',
          error_message: twilioResult.message || 'Failed to send SMS',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      return {
        statusCode: 400,
        body: JSON.stringify({ error: twilioResult.message || 'Failed to send SMS' }),
      };
    }

    // Update message with success status
    await supabase
      .from('mc_messages')
      .update({
        status: 'sent',
        from_phone: twilioPhoneNumber,
        metadata: {
          twilio_sid: twilioResult.sid,
          twilio_status: twilioResult.status,
        },
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    console.log(`SMS sent successfully: ${twilioResult.sid}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        twilio_sid: twilioResult.sid,
        status: twilioResult.status,
      }),
    };

  } catch (error) {
    console.error('Send MC SMS error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
