// supabase/functions/twilio-webhook/index.ts
// Handles incoming SMS from Twilio

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Twilio webhook payload (form-urlencoded)
    const formData = await req.formData();
    const twilioData = Object.fromEntries(formData.entries());

    console.log('Received Twilio webhook:', JSON.stringify(twilioData));

    // Extract message details
    const {
      MessageSid: messageSid,
      From: fromPhone,
      To: toPhone,
      Body: body,
      NumMedia: numMedia,
      MediaUrl0: mediaUrl0,
      MediaContentType0: mediaType0,
    } = twilioData as Record<string, string>;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for opt-out keywords
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit'];
    const optInKeywords = ['start', 'yes', 'subscribe'];
    const bodyLower = body?.toLowerCase().trim();

    if (optOutKeywords.includes(bodyLower)) {
      await handleOptOut(supabase, fromPhone);
      return new Response(generateTwiML('You have been unsubscribed. Reply START to re-subscribe.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    if (optInKeywords.includes(bodyLower)) {
      await handleOptIn(supabase, fromPhone);
      return new Response(generateTwiML('Welcome back! You are now subscribed.'), {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Find or create contact
    const contact = await findOrCreateContact(supabase, fromPhone);

    // Find or create conversation
    const conversation = await findOrCreateConversation(supabase, contact.id, fromPhone, toPhone);

    // Insert message
    const { data: message, error: messageError } = await supabase
      .from('mc_messages')
      .insert({
        conversation_id: conversation.id,
        channel: 'sms',
        direction: 'inbound',
        body: body || '',
        from_phone: fromPhone,
        to_phone: toPhone,
        from_contact_id: contact.id,
        status: 'received',
        sent_at: new Date().toISOString(),
        metadata: {
          twilio_sid: messageSid,
          num_media: numMedia,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.error('Failed to insert message:', messageError);
      throw messageError;
    }

    // Handle media attachments
    if (parseInt(numMedia || '0') > 0 && mediaUrl0) {
      await supabase.from('mc_attachments').insert({
        message_id: message.id,
        file_name: `attachment_${messageSid}`,
        file_type: mediaType0 || 'application/octet-stream',
        file_size: 0, // Twilio doesn't provide size
        file_url: mediaUrl0,
      });
    }

    console.log(`Processed inbound SMS from ${fromPhone}: ${messageSid}`);

    // Return empty TwiML (no auto-reply)
    return new Response(generateTwiML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Twilio retries
    return new Response(generateTwiML(), {
      headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
    });
  }
});

// Generate TwiML response
function generateTwiML(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

// Find or create contact by phone
async function findOrCreateContact(supabase: any, phone: string) {
  // Normalize phone
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  // Try to find existing contact
  const { data: existing } = await supabase
    .from('mc_contacts')
    .select('*')
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`)
    .limit(1)
    .single();

  if (existing) return existing;

  // Try to match with Client Hub
  const { data: clientContact } = await supabase
    .from('client_contacts')
    .select('*, client:clients(*)')
    .or(`phone.ilike.%${last10}%,mobile.ilike.%${last10}%`)
    .limit(1)
    .single();

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('mc_contacts')
    .insert({
      contact_type: 'client',
      display_name: clientContact
        ? `${clientContact.first_name || ''} ${clientContact.last_name || ''}`.trim() || phone
        : phone,
      first_name: clientContact?.first_name,
      last_name: clientContact?.last_name,
      company_name: clientContact?.client?.company_name,
      phone_primary: phone,
      client_id: clientContact?.client_id,
    })
    .select()
    .single();

  if (error) throw error;
  return newContact;
}

// Find or create conversation
async function findOrCreateConversation(
  supabase: any,
  contactId: string,
  fromPhone: string,
  toPhone: string
) {
  // Look for existing conversation with this contact
  const { data: existing } = await supabase
    .from('mc_conversations')
    .select('*')
    .eq('contact_id', contactId)
    .eq('conversation_type', 'client')
    .eq('status', 'active')
    .limit(1)
    .single();

  if (existing) return existing;

  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from('mc_conversations')
    .insert({
      conversation_type: 'client',
      contact_id: contactId,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw error;
  return newConversation;
}

// Handle opt-out
async function handleOptOut(supabase: any, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  await supabase
    .from('mc_contacts')
    .update({
      sms_opted_out: true,
      sms_opted_out_at: new Date().toISOString(),
    })
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`);

  console.log(`Contact opted out: ${phone}`);
}

// Handle opt-in
async function handleOptIn(supabase: any, phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const last10 = normalized.slice(-10);

  await supabase
    .from('mc_contacts')
    .update({
      sms_opted_out: false,
      sms_opted_out_at: null,
    })
    .or(`phone_primary.ilike.%${last10}%,phone_secondary.ilike.%${last10}%`);

  console.log(`Contact opted in: ${phone}`);
}
