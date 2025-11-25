import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sendgridApiKey = process.env.SENDGRID_API_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type NotificationType = 'assignment' | 'watcher_added' | 'comment' | 'status_change' | 'attachment';

interface NotificationRequest {
  type: NotificationType;
  requestId: string;
  requestTitle: string;
  requestType: string;
  urgency?: string;
  triggeredByUserId: string;
  triggeredByName: string;
  details?: {
    oldStatus?: string;
    newStatus?: string;
    commentPreview?: string;
    attachmentName?: string;
    newAssigneeId?: string;
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
    console.log('Starting request notification function...');

    const payload: NotificationRequest = JSON.parse(event.body || '{}');
    const { type, requestId, requestTitle, requestType, urgency, triggeredByUserId, triggeredByName, details } = payload;

    console.log('Notification request:', { type, requestId, triggeredByUserId });

    if (!type || !requestId || !triggeredByUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get recipients based on notification type
    const recipients = await getRecipients(requestId, triggeredByUserId, type, details?.newAssigneeId);

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
    const requestUrl = `${appUrl}/requests?id=${requestId}`;

    const { subject, emailHtml, smsText } = generateNotificationContent(
      type,
      requestTitle,
      requestType,
      urgency || 'medium',
      triggeredByName,
      requestUrl,
      details
    );

    // Get notification preferences for all recipients
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', recipients.map(r => r.id))
      .eq('category', 'requests')
      .eq('notification_type', type);

    // Send notifications to all recipients (respecting their preferences)
    const results = await Promise.allSettled(
      recipients.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText, type, preferences || []))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Notifications sent: ${successCount} success, ${failCount} failed`);

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
    console.error('Notification error:', error);
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
  requestId: string,
  excludeUserId: string,
  notificationType: NotificationType,
  newAssigneeId?: string
): Promise<Recipient[]> {
  const recipientIds = new Set<string>();

  // For watcher_added, only notify the new watcher (passed as newAssigneeId)
  if (notificationType === 'watcher_added' && newAssigneeId) {
    if (newAssigneeId !== excludeUserId) {
      recipientIds.add(newAssigneeId);
    }
  } else {
    // Get request details (assignee, submitter)
    const { data: request, error: requestError } = await supabase
      .from('requests')
      .select('assigned_to, submitter_id')
      .eq('id', requestId)
      .single();

    if (requestError) {
      console.error('Error fetching request:', requestError);
    }

    // For assignment notifications, notify the new assignee
    if (notificationType === 'assignment' && newAssigneeId && newAssigneeId !== excludeUserId) {
      recipientIds.add(newAssigneeId);
    }

    // Add current assignee (for all other notification types)
    if (request?.assigned_to && request.assigned_to !== excludeUserId) {
      recipientIds.add(request.assigned_to);
    }

    // Add submitter (they should always be notified of changes to their request)
    if (request?.submitter_id && request.submitter_id !== excludeUserId) {
      recipientIds.add(request.submitter_id);
    }

    // Get watchers with their notification preferences
    const { data: watchers, error: watchersError } = await supabase
      .from('request_watchers')
      .select('user_id, notify_on_comments, notify_on_status_change, notify_on_assignment')
      .eq('request_id', requestId);

    if (watchersError) {
      console.error('Error fetching watchers:', watchersError);
    }

    // Add watchers based on their preferences
    watchers?.forEach(watcher => {
      if (watcher.user_id === excludeUserId) return;

      const shouldNotify =
        (notificationType === 'comment' && watcher.notify_on_comments) ||
        (notificationType === 'attachment' && watcher.notify_on_comments) ||
        (notificationType === 'status_change' && watcher.notify_on_status_change) ||
        (notificationType === 'assignment' && watcher.notify_on_assignment);

      if (shouldNotify) {
        recipientIds.add(watcher.user_id);
      }
    });
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
  requestTitle: string,
  requestType: string,
  urgency: string,
  triggeredByName: string,
  requestUrl: string,
  details?: NotificationRequest['details']
): { subject: string; emailHtml: string; smsText: string } {
  // Build detailed descriptions
  const descriptions: Record<NotificationType, { subject: string; action: string; hasContent: boolean }> = {
    assignment: {
      subject: `${triggeredByName} assigned you to: ${requestTitle}`,
      action: `${triggeredByName} has assigned you to the ${requestType} request "${requestTitle}" (${urgency} priority).`,
      hasContent: false,
    },
    watcher_added: {
      subject: `${triggeredByName} added you to: ${requestTitle}`,
      action: `${triggeredByName} added you as a watcher on the ${requestType} request "${requestTitle}". You'll receive updates when changes are made.`,
      hasContent: false,
    },
    comment: {
      subject: `${triggeredByName} commented on: ${requestTitle}`,
      action: `${triggeredByName} added a comment:`,
      hasContent: true,
    },
    status_change: {
      subject: `${triggeredByName} updated: ${requestTitle}`,
      action: `${triggeredByName} changed the status from "${details?.oldStatus || 'unknown'}" to "${details?.newStatus || 'unknown'}".`,
      hasContent: false,
    },
    attachment: {
      subject: `${triggeredByName} added file to: ${requestTitle}`,
      action: `${triggeredByName} added a new file: "${details?.attachmentName || 'attachment'}"`,
      hasContent: false,
    },
  };

  const desc = descriptions[type];
  const commentContent = details?.commentPreview || '';

  // Build email with highlighted content box for comments
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
        <h2 style="color: #1f2937; margin-top: 0;">${requestTitle}</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">${requestType} Request • ${urgency} priority</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">${desc.action}</p>
        ${contentBlock}
        <div style="margin: 30px 0; text-align: center;">
          <a href="${requestUrl}"
             style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            View Request
          </a>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You received this because you're associated with this request in Discount Fence Hub.
          </p>
        </div>
      </div>
    </div>
  `;

  // SMS - include sender name and content where applicable
  const shortTitle = requestTitle.length > 25 ? requestTitle.substring(0, 22) + '...' : requestTitle;
  const shortComment = commentContent.length > 60 ? commentContent.substring(0, 57) + '...' : commentContent;

  const smsTemplates: Record<NotificationType, string> = {
    assignment: `DFH: ${triggeredByName} assigned you to "${shortTitle}". ${requestUrl}`,
    watcher_added: `DFH: ${triggeredByName} added you to "${shortTitle}". ${requestUrl}`,
    comment: `DFH: ${triggeredByName} on "${shortTitle}": "${shortComment}" ${requestUrl}`,
    status_change: `DFH: ${triggeredByName} moved "${shortTitle}" to ${details?.newStatus || 'new status'}. ${requestUrl}`,
    attachment: `DFH: ${triggeredByName} added file to "${shortTitle}". ${requestUrl}`,
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

    console.log(`SMS sent to ${formattedPhone}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    throw error;
  }
}
