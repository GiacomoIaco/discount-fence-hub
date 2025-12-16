// supabase/functions/send-sms/index.ts
// Sends SMS via Twilio and updates message status

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendSMSRequest {
  message_id: string;
  to: string;
  body: string;
  media_urls?: string[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message_id, to, body, media_urls } = await req.json() as SendSMSRequest;

    // Validate input
    if (!message_id || !to || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message_id, to, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!;

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

      return new Response(
        JSON.stringify({ error: 'Contact has opted out of SMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase function URL for status callback
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-status`;

    // Prepare Twilio request body
    const twilioBody = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
      StatusCallback: statusCallbackUrl,
    });

    // Add media URLs if provided
    if (media_urls && media_urls.length > 0) {
      media_urls.forEach((url, index) => {
        twilioBody.append(`MediaUrl${index}`, url);
      });
    }

    // Send via Twilio API
    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      }
    );

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
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

      return new Response(
        JSON.stringify({ error: twilioResult.message || 'Failed to send SMS' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update message with Twilio SID and status
    await supabase
      .from('mc_messages')
      .update({
        status: mapTwilioStatus(twilioResult.status),
        from_phone: fromNumber,
        metadata: {
          twilio_sid: twilioResult.sid,
          twilio_status: twilioResult.status,
        },
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    console.log(`SMS sent successfully: ${twilioResult.sid}`);

    return new Response(
      JSON.stringify({
        success: true,
        twilio_sid: twilioResult.sid,
        status: twilioResult.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send SMS error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Map Twilio status to our status
function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    'queued': 'sending',
    'sending': 'sending',
    'sent': 'sent',
    'delivered': 'delivered',
    'undelivered': 'failed',
    'failed': 'failed',
  };
  return statusMap[twilioStatus] || 'sent';
}
