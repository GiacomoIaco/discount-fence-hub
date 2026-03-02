import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type NotificationType = 'assignment' | 'comment' | 'status_change' | 'due_date_reminder';

interface NotificationRequest {
  type: NotificationType;
  initiativeId: string;
  initiativeTitle: string;
  triggeredByUserId: string;
  triggeredByName: string;
  details?: {
    oldStatus?: string;
    newStatus?: string;
    commentPreview?: string;
    newAssigneeId?: string;
    daysUntilDue?: number;
  };
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
    console.log('Starting initiative notification function...');

    const payload: NotificationRequest = JSON.parse(event.body || '{}');
    const { type, initiativeId, initiativeTitle, triggeredByUserId, triggeredByName, details } = payload;

    console.log('Initiative notification request:', { type, initiativeId, triggeredByUserId });

    if (!type || !initiativeId || !triggeredByUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get recipients based on notification type
    const recipients = await getRecipients(initiativeId, triggeredByUserId, type, details?.newAssigneeId);

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
    const initiativeUrl = `${appUrl}?section=my-todos`;

    const { subject, emailHtml, smsText } = generateNotificationContent(
      type,
      initiativeTitle,
      triggeredByName,
      initiativeUrl,
      details
    );

    // Get notification preferences for all recipients
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', recipients.map(r => r.id))
      .eq('category', 'tasks')
      .eq('notification_type', type);

    // Send notifications to all recipients
    const results = await Promise.allSettled(
      recipients.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText, type, preferences || []))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Initiative notifications sent: ${successCount} success, ${failCount} failed`);

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
    console.error('Initiative notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function getRecipients(
  initiativeId: string,
  excludeUserId: string,
  notificationType: NotificationType,
  newAssigneeId?: string
): Promise<Recipient[]> {
  const recipientIds = new Set<string>();

  // Get initiative details
  const { data: initiative, error: initiativeError } = await supabase
    .from('project_initiatives')
    .select('assigned_to, created_by, assigned_by')
    .eq('id', initiativeId)
    .single();

  if (initiativeError) {
    console.error('Error fetching initiative:', initiativeError);
    return [];
  }

  // For assignment notifications, notify the new assignee
  if (notificationType === 'assignment' && newAssigneeId && newAssigneeId !== excludeUserId) {
    recipientIds.add(newAssigneeId);
  }

  // Add assigned user (they should know about changes to their tasks)
  if (initiative?.assigned_to && initiative.assigned_to !== excludeUserId) {
    recipientIds.add(initiative.assigned_to);
  }

  // Add creator (they should know about changes to tasks they created)
  if (initiative?.created_by && initiative.created_by !== excludeUserId) {
    recipientIds.add(initiative.created_by);
  }

  // Add assigner (they should know about changes to tasks they assigned)
  if (initiative?.assigned_by && initiative.assigned_by !== excludeUserId) {
    recipientIds.add(initiative.assigned_by);
  }

  if (recipientIds.size === 0) {
    return [];
  }

  // Fetch user profiles for all recipients
  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id, email, phone, full_name')
    .in('id', Array.from(recipientIds));

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return [];
  }

  return profiles || [];
}

function generateNotificationContent(
  type: NotificationType,
  initiativeTitle: string,
  triggeredByName: string,
  initiativeUrl: string,
  details?: NotificationRequest['details']
): { subject: string; emailHtml: string; smsText: string } {
  const descriptions: Record<NotificationType, { subject: string; action: string; hasContent: boolean }> = {
    assignment: {
      subject: `${triggeredByName} assigned you a task: ${initiativeTitle}`,
      action: `${triggeredByName} has assigned you to the task "${initiativeTitle}".`,
      hasContent: false,
    },
    comment: {
      subject: `${triggeredByName} commented on: ${initiativeTitle}`,
      action: `${triggeredByName} added a comment:`,
      hasContent: true,
    },
    status_change: {
      subject: `${triggeredByName} updated: ${initiativeTitle}`,
      action: `${triggeredByName} changed the status from "${details?.oldStatus || 'unknown'}" to "${details?.newStatus || 'unknown'}".`,
      hasContent: false,
    },
    due_date_reminder: {
      subject: `Task due soon: ${initiativeTitle}`,
      action: `Your task "${initiativeTitle}" is due in ${details?.daysUntilDue || 0} day(s).`,
      hasContent: false,
    },
  };

  const desc = descriptions[type];
  const commentContent = details?.commentPreview || '';

  const contentBlock = desc.hasContent && commentContent ? `
        <div style="background: #f3f4f6; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${commentContent}</p>
        </div>` : '';

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Discount Fence Hub</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <h2 style="color: #1f2937; margin-top: 0;">📋 ${initiativeTitle}</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Task Update</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">${desc.action}</p>
        ${contentBlock}
        <div style="margin: 30px 0; text-align: center;">
          <a href="${initiativeUrl}"
             style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            View Task
          </a>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You received this because you're associated with this task in Discount Fence Hub.
          </p>
        </div>
      </div>
    </div>
  `;

  // SMS - short version
  const shortTitle = initiativeTitle.length > 25 ? initiativeTitle.substring(0, 22) + '...' : initiativeTitle;
  const shortComment = commentContent.length > 50 ? commentContent.substring(0, 47) + '...' : commentContent;

  const smsTemplates: Record<NotificationType, string> = {
    assignment: `DFH: ${triggeredByName} assigned you "${shortTitle}". ${initiativeUrl}`,
    comment: `DFH: ${triggeredByName} on "${shortTitle}": "${shortComment}" ${initiativeUrl}`,
    status_change: `DFH: ${triggeredByName} moved "${shortTitle}" to ${details?.newStatus || 'new status'}. ${initiativeUrl}`,
    due_date_reminder: `DFH: Task "${shortTitle}" is due in ${details?.daysUntilDue || 0} day(s). ${initiativeUrl}`,
  };

  return {
    subject: desc.subject,
    emailHtml,
    smsText: smsTemplates[type],
  };
}

async function sendToRecipient(
  recipient: Recipient,
  subject: string,
  emailHtml: string,
  smsText: string,
  notificationType: NotificationType,
  preferences: UserNotificationPreference[]
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Find user's preference for this notification type
  const userPref = preferences.find(p => p.user_id === recipient.id);

  // Default to enabled if no preference exists
  const emailEnabled = userPref ? userPref.email_enabled : true;
  const smsEnabled = userPref ? userPref.sms_enabled : true;

  // Send email if enabled
  if (recipient.email && emailEnabled) {
    promises.push(sendEmail(recipient.email, subject, emailHtml));
  }

  // Send SMS if enabled and configured
  if (recipient.phone && smsEnabled && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    promises.push(sendSms(recipient.phone, smsText));
  }

  await Promise.all(promises);
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!resendApiKey) {
    console.log('Resend not configured, skipping email');
    return;
  }

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
