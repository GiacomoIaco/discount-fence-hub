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

    // Send notifications to all recipients
    const results = await Promise.allSettled(
      recipients.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText))
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
  const templates: Record<NotificationType, { subject: string; message: string }> = {
    assignment: {
      subject: `You've been assigned: ${requestTitle}`,
      message: `${triggeredByName} has assigned you to the ${requestType} request "${requestTitle}" (${urgency} priority).`,
    },
    watcher_added: {
      subject: `You've been added to: ${requestTitle}`,
      message: `${triggeredByName} added you as a watcher on the ${requestType} request "${requestTitle}". You'll receive updates when changes are made.`,
    },
    comment: {
      subject: `New comment on: ${requestTitle}`,
      message: `${triggeredByName} commented on "${requestTitle}": "${details?.commentPreview || ''}"`,
    },
    status_change: {
      subject: `Status changed: ${requestTitle}`,
      message: `${triggeredByName} changed the status of "${requestTitle}" from "${details?.oldStatus || 'unknown'}" to "${details?.newStatus || 'unknown'}".`,
    },
    attachment: {
      subject: `New attachment on: ${requestTitle}`,
      message: `${triggeredByName} added a new file "${details?.attachmentName || 'attachment'}" to request "${requestTitle}".`,
    },
  };

  const template = templates[type];

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #2563eb; padding: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Discount Fence Hub</h1>
      </div>
      <div style="padding: 30px; background: #ffffff;">
        <h2 style="color: #1f2937; margin-top: 0;">${template.subject}</h2>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">${template.message}</p>
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

  // SMS - keep it short (160 char limit for single SMS)
  const shortTitle = requestTitle.length > 30 ? requestTitle.substring(0, 27) + '...' : requestTitle;
  const smsTemplates: Record<NotificationType, string> = {
    assignment: `DFH: You've been assigned to "${shortTitle}". View: ${requestUrl}`,
    watcher_added: `DFH: Added to request "${shortTitle}". View: ${requestUrl}`,
    comment: `DFH: New comment on "${shortTitle}". View: ${requestUrl}`,
    status_change: `DFH: "${shortTitle}" moved to ${details?.newStatus || 'new status'}. View: ${requestUrl}`,
    attachment: `DFH: New file on "${shortTitle}". View: ${requestUrl}`,
  };

  return {
    subject: template.subject,
    emailHtml,
    smsText: smsTemplates[type],
  };
}

async function sendToRecipient(
  recipient: Recipient,
  subject: string,
  emailHtml: string,
  smsText: string
): Promise<void> {
  const promises: Promise<void>[] = [];

  // Send email
  if (recipient.email) {
    promises.push(sendEmail(recipient.email, subject, emailHtml));
  }

  // Send SMS if phone number exists and Twilio is configured
  if (recipient.phone && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    promises.push(sendSms(recipient.phone, smsText));
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
