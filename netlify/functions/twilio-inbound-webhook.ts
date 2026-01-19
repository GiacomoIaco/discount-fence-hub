import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize web-push for notifications
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:notifications@discountfence.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

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

    // Check if this contact is part of any group conversations first
    // If so, route the message to the most recently active group
    let conversation = await findGroupConversationForContact(contact.id);

    // If no group conversation, find or create a regular 1:1 conversation
    if (!conversation) {
      conversation = await findOrCreateConversation(contact.id);
    } else {
      console.log(`Routing inbound to group conversation: ${conversation.id}`);
    }

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
    // Get current unread count first to handle group conversations correctly
    const { data: currentConv } = await supabase
      .from('mc_conversations')
      .select('unread_count')
      .eq('id', conversation.id)
      .single();

    await supabase
      .from('mc_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: (body || '').substring(0, 100),
        unread_count: (currentConv?.unread_count || 0) + 1,
      })
      .eq('id', conversation.id);

    console.log(`Processed inbound SMS from ${fromPhone}: ${messageSid}`);

    // Auto-add salesperson to conversation (async, don't wait)
    autoAddSalespersonToConversation(contact, conversation.id).catch(err => {
      console.error('Failed to auto-add salesperson:', err);
    });

    // Send push notifications to relevant users (async, don't wait)
    sendPushNotifications(contact, body || 'New message', conversation.id).catch(err => {
      console.error('Failed to send push notifications:', err);
    });

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

// Find group conversation that this contact is a participant of
async function findGroupConversationForContact(contactId: string) {
  // Look for group conversations where this contact is a participant
  const { data: participations } = await supabase
    .from('mc_conversation_participants')
    .select(`
      conversation_id,
      conversation:mc_conversations(*)
    `)
    .eq('contact_id', contactId)
    .is('left_at', null);

  if (!participations || participations.length === 0) return null;

  // Filter to only group conversations that are active and sort by last_message_at
  const groupConversations = participations
    .filter(p => p.conversation && (p.conversation as any).is_group && (p.conversation as any).status === 'active')
    .map(p => p.conversation)
    .sort((a: any, b: any) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime; // Most recent first
    });

  // Return the most recently active group conversation
  return groupConversations.length > 0 ? groupConversations[0] : null;
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

// Find salesperson for a client (priority: projects > requests > quotes)
async function findSalespersonForClient(clientId: string): Promise<string | null> {
  if (!clientId) return null;

  // 1. Check most recent active project's assigned rep
  const { data: project } = await supabase
    .from('projects')
    .select('assigned_rep_user_id')
    .eq('client_id', clientId)
    .neq('assigned_rep_user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (project?.assigned_rep_user_id) {
    console.log(`[AutoAdd] Found salesperson from project: ${project.assigned_rep_user_id}`);
    return project.assigned_rep_user_id;
  }

  // 2. Check most recent service request's salesperson
  const { data: request } = await supabase
    .from('service_requests')
    .select('salesperson_id')
    .eq('client_id', clientId)
    .neq('salesperson_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (request?.salesperson_id) {
    console.log(`[AutoAdd] Found salesperson from request: ${request.salesperson_id}`);
    return request.salesperson_id;
  }

  // 3. Check most recent quote's salesperson
  const { data: quote } = await supabase
    .from('quotes')
    .select('salesperson_id')
    .eq('client_id', clientId)
    .neq('salesperson_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (quote?.salesperson_id) {
    console.log(`[AutoAdd] Found salesperson from quote: ${quote.salesperson_id}`);
    return quote.salesperson_id;
  }

  console.log(`[AutoAdd] No salesperson found for client ${clientId}`);
  return null;
}

// Auto-add salesperson to SMS conversation when inbound message arrives
async function autoAddSalespersonToConversation(
  contact: { id: string; client_id?: string; display_name: string },
  conversationId: string
): Promise<void> {
  // Skip if no client linked
  if (!contact.client_id) {
    console.log(`[AutoAdd] Contact ${contact.id} has no linked client, skipping`);
    return;
  }

  // Find the salesperson for this client
  const salespersonUserId = await findSalespersonForClient(contact.client_id);
  if (!salespersonUserId) {
    return;
  }

  // Get or create mc_contact for the salesperson (employee)
  let { data: salespersonContact } = await supabase
    .from('mc_contacts')
    .select('id')
    .eq('employee_id', salespersonUserId)
    .single();

  if (!salespersonContact) {
    // Create mc_contact for the employee
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('full_name, email, avatar_url')
      .eq('id', salespersonUserId)
      .single();

    const { data: newContact, error } = await supabase
      .from('mc_contacts')
      .insert({
        contact_type: 'employee',
        display_name: userProfile?.full_name || 'Unknown',
        email_primary: userProfile?.email,
        avatar_url: userProfile?.avatar_url,
        employee_id: salespersonUserId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[AutoAdd] Failed to create salesperson contact:', error);
      return;
    }
    salespersonContact = newContact;
  }

  // Check if salesperson is already a participant
  const { data: existingParticipant } = await supabase
    .from('mc_conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('contact_id', salespersonContact.id)
    .is('left_at', null)
    .single();

  if (existingParticipant) {
    console.log(`[AutoAdd] Salesperson already in conversation ${conversationId}`);
    return;
  }

  // Add salesperson as participant
  const { error: addError } = await supabase
    .from('mc_conversation_participants')
    .insert({
      conversation_id: conversationId,
      contact_id: salespersonContact.id,
      role: 'member',
      added_by: null, // System auto-add
    });

  if (addError) {
    console.error('[AutoAdd] Failed to add salesperson to conversation:', addError);
    return;
  }

  // Mark conversation as group
  await supabase
    .from('mc_conversations')
    .update({ is_group: true })
    .eq('id', conversationId);

  console.log(`[AutoAdd] Added salesperson ${salespersonUserId} to conversation ${conversationId}`);
}

// Send push notifications for new message
async function sendPushNotifications(
  contact: { display_name: string; id: string },
  messageBody: string,
  conversationId: string
) {
  // Skip if VAPID not configured
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.log('[Push] VAPID not configured, skipping push notifications');
    return;
  }

  // Get users who should be notified:
  // 1. Users with 'admin' or 'operations' role (Front Desk - see all)
  // 2. Users who are participants in this conversation

  // Get Front Desk users
  const { data: frontDeskUsers } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['admin', 'operations']);

  // Get conversation participants
  const { data: participants } = await supabase
    .from('mc_conversation_participants')
    .select('contact:mc_contacts(employee_id)')
    .eq('conversation_id', conversationId)
    .is('left_at', null);

  // Collect all user IDs to notify
  const userIds = new Set<string>();

  // Add front desk users
  frontDeskUsers?.forEach(u => userIds.add(u.id));

  // Add participants (employees only)
  participants?.forEach(p => {
    const employeeId = (p.contact as any)?.employee_id;
    if (employeeId) userIds.add(employeeId);
  });

  if (userIds.size === 0) {
    console.log('[Push] No users to notify');
    return;
  }

  console.log(`[Push] Sending to ${userIds.size} users`);

  // Get push subscriptions for these users
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', Array.from(userIds))
    .eq('is_active', true)
    .lt('error_count', 3);

  if (!subscriptions || subscriptions.length === 0) {
    console.log('[Push] No active subscriptions found');
    return;
  }

  console.log(`[Push] Found ${subscriptions.length} subscription(s)`);

  // Build notification payload
  const payload = JSON.stringify({
    title: `Message from ${contact.display_name}`,
    body: messageBody.substring(0, 100),
    icon: '/Logo-DF-Transparent.png',
    badge: '/favicon-96x96.png',
    url: `/message-center?conversation=${conversationId}`,
    tag: `msg-${conversationId}`,
  });

  // Send to all subscriptions
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );

        // Update last_used_at
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id);

        return { success: true };
      } catch (error: any) {
        console.error(`[Push] Failed: ${error.message}`);

        // Handle expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .update({ is_active: false, last_error: 'Subscription expired' })
            .eq('id', sub.id);
        } else {
          // Increment error count
          const { data: current } = await supabase
            .from('push_subscriptions')
            .select('error_count')
            .eq('id', sub.id)
            .single();

          await supabase
            .from('push_subscriptions')
            .update({
              error_count: (current?.error_count || 0) + 1,
              last_error: error.message,
            })
            .eq('id', sub.id);
        }

        return { success: false, error: error.message };
      }
    })
  );

  const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
  console.log(`[Push] Sent: ${sent}/${subscriptions.length}`);
}
