import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sendgridApiKey = process.env.SENDGRID_API_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type ChatNotificationType = 'direct_message' | 'group_message';

interface ChatNotificationRequest {
  type: ChatNotificationType;
  conversationId: string;
  conversationName?: string; // For group chats
  senderId: string;
  senderName: string;
  messageContent: string;
  isGroup: boolean;
}

interface Recipient {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
}

interface UserNotificationPreference {
  user_id: string;
  category: string;
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Starting chat notification function...');

    const payload: ChatNotificationRequest = JSON.parse(event.body || '{}');
    const { type, conversationId, conversationName, senderId, senderName, messageContent, isGroup } = payload;

    console.log('Chat notification request:', { type, conversationId, senderId, isGroup });

    if (!conversationId || !senderId || !messageContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get all participants except the sender
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', senderId);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch participants' }),
      };
    }

    if (!participants || participants.length === 0) {
      console.log('No recipients to notify');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No recipients to notify', sent: 0 }),
      };
    }

    const recipientIds = participants.map(p => p.user_id);

    // Fetch user profiles for all recipients
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, phone, full_name')
      .in('id', recipientIds);

    if (profilesError || !profiles) {
      console.error('Error fetching profiles:', profilesError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user profiles' }),
      };
    }

    console.log(`Found ${profiles.length} recipients to notify`);

    // Get notification preferences for all recipients
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', recipientIds)
      .eq('category', 'chat')
      .eq('notification_type', type);

    // Generate notification content
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const chatUrl = `${appUrl}/communication`;

    const { subject, emailHtml, smsText } = generateNotificationContent(
      senderName,
      messageContent,
      isGroup,
      conversationName,
      chatUrl
    );

    // Send notifications to all recipients
    const results = await Promise.allSettled(
      profiles.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText, preferences || []))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Chat notifications sent: ${successCount} success, ${failCount} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        recipients: profiles.length,
      }),
    };
  } catch (error) {
    console.error('Chat notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send chat notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

function generateNotificationContent(
  senderName: string,
  messageContent: string,
  isGroup: boolean,
  conversationName: string | undefined,
  chatUrl: string
): { subject: string; emailHtml: string; smsText: string } {
  // Truncate message for display
  const messagePreview = messageContent.length > 200
    ? messageContent.substring(0, 197) + '...'
    : messageContent;

  const subject = isGroup
    ? `New message in ${conversationName || 'group chat'}`
    : `New message from ${senderName}`;

  const headerText = isGroup
    ? `${senderName} in ${conversationName || 'group chat'}:`
    : `${senderName} sent you a message:`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Discount Fence Hub</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 8px;">${headerText}</p>
        <div style="background: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${messagePreview}</p>
        </div>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${chatUrl}"
             style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            Reply in Chat
          </a>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You received this because someone sent you a message in Discount Fence Hub.
          </p>
        </div>
      </div>
    </div>
  `;

  // SMS - include the message content, keep it concise
  const shortMessage = messageContent.length > 100
    ? messageContent.substring(0, 97) + '...'
    : messageContent;

  const smsText = isGroup
    ? `DFH: ${senderName} in ${conversationName || 'group'}: "${shortMessage}"`
    : `DFH: ${senderName}: "${shortMessage}"`;

  return { subject, emailHtml, smsText };
}

async function sendToRecipient(
  recipient: Recipient,
  subject: string,
  emailHtml: string,
  smsText: string,
  preferences: UserNotificationPreference[]
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Find user's preference
  const userPref = preferences.find(p => p.user_id === recipient.id);

  // Default to enabled if no preference exists
  const emailEnabled = userPref ? userPref.email_enabled : true;
  const smsEnabled = userPref ? userPref.sms_enabled : true;

  if (recipient.email && emailEnabled) {
    promises.push(sendEmail(recipient.email, subject, emailHtml));
  } else if (recipient.email && !emailEnabled) {
    console.log(`Email disabled by preference for ${recipient.email}`);
  }

  if (recipient.phone && smsEnabled && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    promises.push(sendSms(recipient.phone, smsText));
  } else if (recipient.phone && !smsEnabled) {
    console.log(`SMS disabled by preference for ${recipient.id}`);
  }

  await Promise.all(promises);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: 'notifications@discountfenceusa.com', name: 'Discount Fence Hub' },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SendGrid error for ${to}:`, errorText);
      throw new Error(`SendGrid API error: ${errorText}`);
    }

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}

async function sendSms(to: string, message: string): Promise<void> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    console.log('Twilio not configured, skipping SMS');
    return;
  }

  try {
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
      console.error(`Twilio error for ${formattedPhone}:`, errorText);
      throw new Error(`Twilio API error: ${errorText}`);
    }

    console.log(`SMS sent to ${formattedPhone}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw error;
  }
}
