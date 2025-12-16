import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed',
    };
  }

  try {
    // Parse Twilio webhook payload (form-urlencoded)
    const params = new URLSearchParams(event.body || '');
    const data: Record<string, string> = {};
    params.forEach((value, key) => {
      data[key] = value;
    });

    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
    } = data;

    console.log(`Status update for ${messageSid}: ${messageStatus}`);

    // Map Twilio status to our status
    const statusMap: Record<string, string> = {
      'queued': 'sending',
      'sending': 'sending',
      'sent': 'sent',
      'delivered': 'delivered',
      'undelivered': 'failed',
      'failed': 'failed',
      'read': 'read',
    };

    const ourStatus = statusMap[messageStatus] || 'sent';

    // Find the message by twilio_sid in metadata
    // Using a raw query to search JSON field
    const { data: messages } = await supabase
      .from('mc_messages')
      .select('id, metadata')
      .not('metadata', 'is', null);

    // Find the message with matching twilio_sid
    const matchingMessage = messages?.find(
      (m: any) => m.metadata?.twilio_sid === messageSid
    );

    if (matchingMessage) {
      // Update the message
      const updateData: Record<string, any> = {
        status: ourStatus,
        status_updated_at: new Date().toISOString(),
        metadata: {
          ...matchingMessage.metadata,
          twilio_status: messageStatus,
          twilio_error_code: errorCode || null,
        },
      };

      if (messageStatus === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await supabase
        .from('mc_messages')
        .update(updateData)
        .eq('id', matchingMessage.id);

      if (error) {
        console.error('Failed to update message status:', error);
      } else {
        console.log(`Updated message ${matchingMessage.id} to status: ${ourStatus}`);
      }
    } else {
      console.log(`No message found with twilio_sid: ${messageSid}`);
    }

    return {
      statusCode: 200,
      body: 'OK',
    };

  } catch (error) {
    console.error('Status webhook error:', error);
    // Return 200 to prevent Twilio retries
    return {
      statusCode: 200,
      body: 'OK',
    };
  }
};
