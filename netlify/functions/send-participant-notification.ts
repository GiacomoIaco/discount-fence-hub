/**
 * Send SMS notification to sales rep when added to a conversation
 *
 * This sends a simple notification SMS to let the sales rep know
 * they've been added to a client conversation.
 */

import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotifyParticipantRequest {
  /** The contact ID of the participant being added (employee) */
  participant_contact_id: string;
  /** The conversation ID they're being added to */
  conversation_id: string;
  /** Who added them (user_id) */
  added_by_user_id?: string;
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
    console.error('[notify-participant] Twilio not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Twilio not configured' }),
    };
  }

  try {
    const { participant_contact_id, conversation_id, added_by_user_id }: NotifyParticipantRequest =
      JSON.parse(event.body || '{}');

    console.log('[notify-participant] Request:', { participant_contact_id, conversation_id });

    if (!participant_contact_id || !conversation_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: participant_contact_id, conversation_id' }),
      };
    }

    // Get the participant's contact info (employee)
    const { data: participantContact, error: contactError } = await supabase
      .from('mc_contacts')
      .select('*, employee:user_profiles!employee_id(id, full_name, phone)')
      .eq('id', participant_contact_id)
      .single();

    if (contactError || !participantContact) {
      console.error('[notify-participant] Contact not found:', contactError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Participant contact not found' }),
      };
    }

    // Get the employee's phone number
    const employeePhone = (participantContact.employee as any)?.phone || participantContact.phone_primary;

    if (!employeePhone) {
      console.log('[notify-participant] No phone number for participant, skipping SMS');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, skipped: true, reason: 'No phone number' }),
      };
    }

    // Get conversation details (client name)
    const { data: conversation, error: convError } = await supabase
      .from('mc_conversations')
      .select(`
        *,
        contact:mc_contacts(display_name, company_name)
      `)
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('[notify-participant] Conversation not found:', convError);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Conversation not found' }),
      };
    }

    // Get who added them (if available)
    let addedByName = 'A team member';
    if (added_by_user_id) {
      const { data: addedBy } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', added_by_user_id)
        .single();

      if (addedBy?.full_name) {
        addedByName = addedBy.full_name;
      }
    }

    // Build the notification message
    const clientName = (conversation.contact as any)?.display_name ||
                       (conversation.contact as any)?.company_name ||
                       'a client';

    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const messageUrl = `${appUrl}/message-center?conversation=${conversation_id}`;

    const smsBody = `${addedByName} added you to a conversation with ${clientName}.\n\nView: ${messageUrl}`;

    // Format phone number
    let formattedPhone = employeePhone.replace(/[^\d+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.length === 10) {
        formattedPhone = '+1' + formattedPhone;
      } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
        formattedPhone = '+' + formattedPhone;
      }
    }

    console.log(`[notify-participant] Sending notification to ${formattedPhone.substring(0, 6)}...`);

    // Send SMS via Twilio
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
          From: twilioPhoneNumber!,
          Body: smsBody,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[notify-participant] Twilio error:', result);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: result.message || 'Failed to send SMS' }),
      };
    }

    console.log(`[notify-participant] SMS sent successfully: ${result.sid}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        twilio_sid: result.sid,
        recipient: formattedPhone.substring(0, 6) + '***',
      }),
    };

  } catch (error) {
    console.error('[notify-participant] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
