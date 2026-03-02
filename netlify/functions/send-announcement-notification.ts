import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AnnouncementNotificationRequest {
  announcementId: string;
  title: string;
  content: string;
  messageType: 'announcement' | 'survey' | 'recognition' | 'event';
  priority: 'normal' | 'high' | 'urgent';
  targetRoles?: string[];
  createdByUserId: string;
  createdByName: string;
}

interface Recipient {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  role: string;
}

interface UserNotificationPreference {
  user_id: string;
  category: string;
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  is_admin_forced: boolean;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Starting announcement notification function...');

    const payload: AnnouncementNotificationRequest = JSON.parse(event.body || '{}');
    const { announcementId, title, content, messageType, priority, targetRoles, createdByUserId, createdByName } = payload;

    console.log('Announcement notification request:', { announcementId, title, messageType, targetRoles });

    if (!announcementId || !title || !createdByUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get all users who should receive this announcement
    const recipients = await getRecipients(targetRoles, createdByUserId);

    if (recipients.length === 0) {
      console.log('No recipients to notify');
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'No recipients to notify', sent: 0 }),
      };
    }

    console.log(`Found ${recipients.length} recipients to notify`);

    // Generate notification content
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const announcementUrl = `${appUrl}/announcements`;

    const { subject, emailHtml, smsText } = generateNotificationContent(
      title,
      content,
      messageType,
      priority,
      createdByName,
      announcementUrl
    );

    // Get notification preferences for all recipients
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', recipients.map(r => r.id))
      .eq('category', 'announcements')
      .eq('notification_type', 'new_announcement');

    // Send notifications to all recipients (respecting their preferences)
    const results = await Promise.allSettled(
      recipients.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText, preferences || []))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Announcement notifications sent: ${successCount} success, ${failCount} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: successCount,
        failed: failCount,
        recipients: recipients.length,
      }),
    };
  } catch (error) {
    console.error('Announcement notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send announcement notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function getRecipients(
  targetRoles?: string[],
  excludeUserId?: string
): Promise<Recipient[]> {
  // Build query - get all users or filter by target roles
  let query = supabase
    .from('user_profiles')
    .select('id, email, phone, full_name, role');

  // Filter by target roles if specified
  if (targetRoles && targetRoles.length > 0) {
    query = query.in('role', targetRoles);
  }

  const { data: profiles, error } = await query;

  if (error) {
    console.error('Error fetching user profiles:', error);
    return [];
  }

  // Exclude the sender from notifications
  const recipients = profiles?.filter(p => p.id !== excludeUserId) || [];

  return recipients;
}

function generateNotificationContent(
  title: string,
  content: string,
  messageType: string,
  priority: string,
  createdByName: string,
  announcementUrl: string
): { subject: string; emailHtml: string; smsText: string } {
  // Map message types to friendly names and colors
  const typeLabels: Record<string, { label: string; color: string; emoji: string }> = {
    announcement: { label: 'Announcement', color: '#2563eb', emoji: '📢' },
    survey: { label: 'Survey', color: '#7c3aed', emoji: '📊' },
    recognition: { label: 'Recognition', color: '#f59e0b', emoji: '🏆' },
    event: { label: 'Event', color: '#10b981', emoji: '📅' },
  };

  const typeInfo = typeLabels[messageType] || typeLabels.announcement;
  const priorityBadge = priority === 'urgent' ? '🚨 URGENT: ' : priority === 'high' ? '⚠️ ' : '';

  // Clean content for preview (strip HTML if any, limit length)
  const contentPreview = content
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 200);

  const subject = `${priorityBadge}${typeInfo.emoji} ${title}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${typeInfo.color}; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Discount Fence Hub</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <div style="display: inline-block; background: ${typeInfo.color}15; color: ${typeInfo.color}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px;">
          ${typeInfo.emoji} ${typeInfo.label}${priority !== 'normal' ? ` • ${priority.toUpperCase()}` : ''}
        </div>
        <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 8px;">${title}</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">Posted by ${createdByName}</p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${contentPreview}${content.length > 200 ? '...' : ''}</p>
        </div>

        <div style="text-align: center;">
          <a href="${announcementUrl}"
             style="background: ${typeInfo.color}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            View ${typeInfo.label}
          </a>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You received this because you're subscribed to ${typeInfo.label.toLowerCase()} notifications in Discount Fence Hub.
            <br>Manage your preferences in Settings → Notification Preferences.
          </p>
        </div>
      </div>
    </div>
  `;

  // SMS - concise version
  const shortTitle = title.length > 30 ? title.substring(0, 27) + '...' : title;
  const smsText = `${priorityBadge}DFH ${typeInfo.emoji}: "${shortTitle}" from ${createdByName}. ${announcementUrl}`;

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

  // Find user's preference for announcement notifications
  const userPref = preferences.find(p => p.user_id === recipient.id);

  // Default to enabled if no preference exists (opt-out model)
  const emailEnabled = userPref ? userPref.email_enabled : true;
  const smsEnabled = userPref ? userPref.sms_enabled : true;

  // Send email if enabled and recipient has email
  if (recipient.email && emailEnabled) {
    promises.push(sendEmail(recipient.email, subject, emailHtml));
  } else if (recipient.email && !emailEnabled) {
    console.log(`Email disabled by preference for ${recipient.email}`);
  }

  // Send SMS if enabled, phone exists, and Twilio is configured
  if (recipient.phone && smsEnabled && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    promises.push(sendSms(recipient.phone, smsText));
  } else if (recipient.phone && !smsEnabled) {
    console.log(`SMS disabled by preference for ${recipient.id}`);
  }

  await Promise.all(promises);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Discount Fence Hub <notifications@discountfenceusa.com>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Resend error for ${to}:`, errorText);
      throw new Error(`Resend API error: ${errorText}`);
    }

    console.log(`Announcement email sent to ${to}`);
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
    // Format phone number - ensure it starts with +1 for US numbers
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
          Body: message.substring(0, 160), // Ensure SMS length limit
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Twilio error for ${formattedPhone}:`, errorText);
      throw new Error(`Twilio API error: ${errorText}`);
    }

    console.log(`Announcement SMS sent to ${formattedPhone}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw error;
  }
}
