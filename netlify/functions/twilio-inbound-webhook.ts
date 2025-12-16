import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const handler: Handler = async (event) => {
  // Twilio sends POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed',
    };
  }

  try {
    // Parse Twilio webhook payload (form-urlencoded)
    const params = new URLSearchParams(event.body || '');
    const twilioData: Record<string, string> = {};
    params.forEach((value, key) => {
      twilioData[key] = value;
    });

    console.log('Received Twilio inbound webhook:', JSON.stringify(twilioData));

    // Extract message details
    const {
      MessageSid: messageSid,
      From: fromPhone,
      To: toPhone,
      Body: body,
      NumMedia: numMedia,
      MediaUrl0: mediaUrl0,
      MediaContentType0: mediaType0,
    } = twilioData;

    // Check for opt-out keywords
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'quit'];
    const optInKeywords = ['start', 'yes', 'subscribe'];
    const bodyLower = body?.toLowerCase().trim();

    if (optOutKeywords.includes(bodyLower)) {
      await handleOptOut(fromPhone);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: generateTwiML('You have been unsubscribed. Reply START to re-subscribe.'),
      };
    }

    if (optInKeywords.includes(bodyLower)) {
      await handleOptIn(fromPhone);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: generateTwiML('Welcome back! You are now subscribed.'),
      };
    }

    // Find or create contact
    const contact = await findOrCreateContact(fromPhone);

    // Find or create conversation
    const conversation = await findOrCreateConversation(contact.id);

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
        file_size: 0,
        file_url: mediaUrl0,
      });
    }

    // Update conversation with last message info
    await supabase
      .from('mc_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body || '').substring(0, 100),
        unread_count: conversation.unread_count + 1,
      })
      .eq('id', conversation.id);

    console.log(`Processed inbound SMS from ${fromPhone}: ${messageSid}`);

    // Return empty TwiML (no auto-reply)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: generateTwiML(),
    };

  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent Twilio retries
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/xml' },
      body: generateTwiML(),
    };
  }
};

// Generate TwiML response
function generateTwiML(message?: string): string {
  if (message) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
}

// Find or create contact by phone
async function findOrCreateContact(phone: string) {
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
async function findOrCreateConversation(contactId: string) {
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
      unread_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return newConversation;
}

// Handle opt-out
async function handleOptOut(phone: string) {
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
async function handleOptIn(phone: string) {
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
