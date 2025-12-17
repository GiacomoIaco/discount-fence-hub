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
  to?: string;
  body: string;
  // For MMS group messaging
  is_group?: boolean;
  recipients?: string[];
  conversation_id?: string;
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
    console.log('[send-mc-sms] Received request body:', event.body);

    const { message_id, to, body, is_group, recipients, conversation_id }: SendMCSmsRequest = JSON.parse(event.body || '{}');

    console.log('[send-mc-sms] Parsed:', {
      message_id,
      to: to?.substring(0, 6) + '...',
      is_group,
      recipients_count: recipients?.length,
      bodyLength: body?.length
    });

    // Validate required fields
    if (!message_id || !body) {
      console.error('[send-mc-sms] Missing fields:', { message_id: !!message_id, body: !!body });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: message_id, body' }),
      };
    }

    // For group MMS, need recipients array
    if (is_group && (!recipients || recipients.length === 0)) {
      console.error('[send-mc-sms] Group message but no recipients');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Group message requires recipients array' }),
      };
    }

    // For single SMS, need to phone
    if (!is_group && !to) {
      console.error('[send-mc-sms] Single message but no to phone');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Single message requires to phone' }),
      };
    }

    // Log Twilio configuration status
    console.log('[send-mc-sms] Twilio config:', {
      hasSid: !!twilioAccountSid,
      hasToken: !!twilioAuthToken,
      hasPhone: !!twilioPhoneNumber,
      fromPhone: twilioPhoneNumber?.substring(0, 6) + '...',
    });

    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const statusCallbackUrl = `${appUrl}/.netlify/functions/twilio-status-webhook`;

    // Helper to format phone number
    function formatPhone(phone: string): string {
      let formatted = phone.replace(/[^\d+]/g, '');
      if (!formatted.startsWith('+')) {
        if (formatted.length === 10) {
          formatted = '+1' + formatted;
        } else if (formatted.length === 11 && formatted.startsWith('1')) {
          formatted = '+' + formatted;
        }
      }
      return formatted;
    }

    // Helper to send single Twilio message
    async function sendTwilioMessage(toPhone: string, messageBody: string): Promise<{ success: boolean; sid?: string; error?: string }> {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: toPhone,
            From: twilioPhoneNumber!,
            Body: messageBody,
            StatusCallback: statusCallbackUrl,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.message || 'Failed to send' };
      }

      return { success: true, sid: result.sid };
    }

    // ========================================================================
    // GROUP MMS MESSAGING
    // ========================================================================
    if (is_group && recipients && recipients.length > 0) {
      console.log(`[send-mc-sms] Sending GROUP MMS to ${recipients.length} recipients for message ${message_id}`);

      // Check for opted-out contacts (we'll skip them but still send to others)
      const formattedRecipients = recipients.map(formatPhone);

      // Send to each recipient individually (Twilio limitation)
      const results: { phone: string; success: boolean; sid?: string; error?: string }[] = [];

      for (const phone of formattedRecipients) {
        try {
          const result = await sendTwilioMessage(phone, body);
          results.push({ phone, ...result });
          console.log(`[send-mc-sms] Sent to ${phone.substring(0, 6)}...: ${result.success ? 'OK' : result.error}`);
        } catch (err) {
          results.push({ phone, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;

      console.log(`[send-mc-sms] Group MMS results: ${successCount} sent, ${failedCount} failed`);

      // Update message status based on results
      if (successCount === 0) {
        await supabase
          .from('mc_messages')
          .update({
            status: 'failed',
            error_message: `Failed to send to all ${failedCount} recipients`,
            metadata: {
              is_group_message: true,
              conversation_id,
              send_results: results
            },
            status_updated_at: new Date().toISOString(),
          })
          .eq('id', message_id);

        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Failed to send to all recipients', results }),
        };
      }

      // Partial or full success
      await supabase
        .from('mc_messages')
        .update({
          status: failedCount > 0 ? 'sent' : 'delivered', // 'sent' if partial, 'delivered' if all success
          from_phone: twilioPhoneNumber,
          metadata: {
            is_group_message: true,
            conversation_id,
            recipient_count: recipients.length,
            success_count: successCount,
            failed_count: failedCount,
            twilio_sids: results.filter(r => r.sid).map(r => r.sid),
            send_results: results
          },
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      console.log(`Group MMS sent successfully: ${successCount}/${recipients.length}`);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          is_group: true,
          recipient_count: recipients.length,
          success_count: successCount,
          failed_count: failedCount,
          results
        }),
      };
    }

    // ========================================================================
    // SINGLE SMS MESSAGING
    // ========================================================================
    console.log(`[send-mc-sms] Sending single SMS to ${to} for message ${message_id}`);

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

    const formattedPhone = formatPhone(to!);
    const result = await sendTwilioMessage(formattedPhone, body);

    if (!result.success) {
      console.error('[send-mc-sms] Twilio error:', result.error);

      // Update message as failed
      await supabase
        .from('mc_messages')
        .update({
          status: 'failed',
          error_message: result.error || 'Failed to send SMS',
          status_updated_at: new Date().toISOString(),
        })
        .eq('id', message_id);

      return {
        statusCode: 400,
        body: JSON.stringify({ error: result.error || 'Failed to send SMS' }),
      };
    }

    // Update message with success status
    await supabase
      .from('mc_messages')
      .update({
        status: 'sent',
        from_phone: twilioPhoneNumber,
        metadata: {
          twilio_sid: result.sid,
        },
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    console.log(`SMS sent successfully: ${result.sid}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        twilio_sid: result.sid,
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
