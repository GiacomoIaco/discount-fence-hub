// supabase/functions/twilio-status/index.ts
// Handles delivery status updates from Twilio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const data = Object.fromEntries(formData.entries());

    const {
      MessageSid: messageSid,
      MessageStatus: messageStatus,
      ErrorCode: errorCode,
      ErrorMessage: errorMessage,
    } = data as Record<string, string>;

    console.log(`Status update for ${messageSid}: ${messageStatus}`);

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // First, find the message by twilio_sid in metadata
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
      const updateData: any = {
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

    return new Response('OK', { headers: corsHeaders });

  } catch (error) {
    console.error('Status webhook error:', error);
    return new Response('OK', { headers: corsHeaders });
  }
});
