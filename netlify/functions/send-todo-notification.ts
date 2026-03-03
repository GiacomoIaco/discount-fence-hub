import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

type TodoNotificationType = 'assignment' | 'mention' | 'comment';

interface TodoNotificationRequest {
  type: TodoNotificationType;
  taskId: string;
  taskTitle: string;
  listId: string;
  listTitle: string;
  triggeredByUserId: string;
  triggeredByName: string;
  details?: {
    newAssigneeId?: string;
    commentPreview?: string;
    mentionedUserIds?: string[];
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
    console.log('Starting todo notification function...');

    const payload: TodoNotificationRequest = JSON.parse(event.body || '{}');
    const { type, taskId, taskTitle, listId, listTitle, triggeredByUserId, triggeredByName, details } = payload;

    console.log('Todo notification request:', { type, taskId, triggeredByUserId });

    if (!type || !taskId || !triggeredByUserId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get recipients based on notification type
    const recipients = await getRecipients(taskId, triggeredByUserId, type, details);

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
    const taskUrl = `${appUrl}/todos?list=${listId}&task=${taskId}`;

    const { subject, emailHtml, smsText } = generateNotificationContent(
      type, taskTitle, listTitle, triggeredByName, taskUrl, details
    );

    // Get notification preferences for all recipients
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .in('user_id', recipients.map(r => r.id))
      .eq('category', 'todos')
      .eq('notification_type', type);

    // Send notifications to all recipients (respecting preferences)
    const results = await Promise.allSettled(
      recipients.map(recipient => sendToRecipient(recipient, subject, emailHtml, smsText, preferences || []))
    );

    // Fire push notifications (fire-and-forget to self)
    for (const recipient of recipients) {
      try {
        const pushUrl = `${appUrl}/.netlify/functions/send-push-notification`;
        fetch(pushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: recipient.id,
            title: subject,
            body: smsText.replace(/^DFH: /, ''),
            url: taskUrl,
          }),
        }).catch(() => {}); // Fire and forget
      } catch {
        // Ignore push errors
      }
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Todo notifications sent: ${successCount} success, ${failCount} failed`);

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
    console.error('Todo notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send todo notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

async function getRecipients(
  taskId: string,
  excludeUserId: string,
  notificationType: TodoNotificationType,
  details?: TodoNotificationRequest['details']
): Promise<Recipient[]> {
  const recipientIds = new Set<string>();

  if (notificationType === 'assignment' && details?.newAssigneeId) {
    // Assignment: only notify the new assignee
    if (details.newAssigneeId !== excludeUserId) {
      recipientIds.add(details.newAssigneeId);
    }
  } else if (notificationType === 'mention' && details?.mentionedUserIds) {
    // Mention: notify all mentioned users
    for (const userId of details.mentionedUserIds) {
      if (userId !== excludeUserId) {
        recipientIds.add(userId);
      }
    }
  } else if (notificationType === 'comment') {
    // Comment: notify assignee + followers (exclude sender)
    const { data: task } = await supabase
      .from('todo_items')
      .select('assigned_to')
      .eq('id', taskId)
      .single();

    if (task?.assigned_to && task.assigned_to !== excludeUserId) {
      recipientIds.add(task.assigned_to);
    }

    const { data: followers } = await supabase
      .from('todo_item_followers')
      .select('user_id')
      .eq('item_id', taskId);

    followers?.forEach(f => {
      if (f.user_id !== excludeUserId) {
        recipientIds.add(f.user_id);
      }
    });
  }

  if (recipientIds.size === 0) return [];

  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, email, phone, full_name')
    .in('id', Array.from(recipientIds));

  return profiles || [];
}

function generateNotificationContent(
  type: TodoNotificationType,
  taskTitle: string,
  listTitle: string,
  triggeredByName: string,
  taskUrl: string,
  details?: TodoNotificationRequest['details']
): { subject: string; emailHtml: string; smsText: string } {
  const descriptions: Record<TodoNotificationType, { subject: string; action: string; hasContent: boolean }> = {
    assignment: {
      subject: `${triggeredByName} assigned you a task: ${taskTitle}`,
      action: `${triggeredByName} has assigned you to the task "${taskTitle}" in the "${listTitle}" list.`,
      hasContent: false,
    },
    mention: {
      subject: `${triggeredByName} mentioned you in: ${taskTitle}`,
      action: `${triggeredByName} mentioned you in a comment:`,
      hasContent: true,
    },
    comment: {
      subject: `${triggeredByName} commented on: ${taskTitle}`,
      action: `${triggeredByName} added a comment:`,
      hasContent: true,
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
        <h2 style="color: #1f2937; margin-top: 0;">${taskTitle}</h2>
        <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">Task in "${listTitle}"</p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">${desc.action}</p>
        ${contentBlock}
        <div style="margin: 30px 0; text-align: center;">
          <a href="${taskUrl}"
             style="background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
            View Task
          </a>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            You received this because you're associated with this task in Discount Fence Hub.
            <a href="${taskUrl.split('?')[0]}" style="color: #6b7280;">Manage notification preferences</a>
          </p>
        </div>
      </div>
    </div>
  `;

  const shortTitle = taskTitle.length > 30 ? taskTitle.substring(0, 27) + '...' : taskTitle;
  const shortComment = commentContent.length > 60 ? commentContent.substring(0, 57) + '...' : commentContent;

  const smsTemplates: Record<TodoNotificationType, string> = {
    assignment: `DFH: ${triggeredByName} assigned you "${shortTitle}". ${taskUrl}`,
    mention: `DFH: ${triggeredByName} mentioned you on "${shortTitle}": "${shortComment}" ${taskUrl}`,
    comment: `DFH: ${triggeredByName} on "${shortTitle}": "${shortComment}" ${taskUrl}`,
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
  preferences: UserNotificationPreference[]
): Promise<void> {
  const promises: Promise<void>[] = [];

  const userPref = preferences.find(p => p.user_id === recipient.id);
  const emailEnabled = userPref ? userPref.email_enabled : true;
  const smsEnabled = userPref ? userPref.sms_enabled : true;

  if (recipient.email && emailEnabled) {
    promises.push(sendEmail(recipient.email, subject, emailHtml));
  }

  if (recipient.phone && smsEnabled && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    promises.push(sendSms(recipient.phone, smsText));
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

    console.log(`Todo email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send todo email to ${to}:`, error);
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

    console.log(`Todo SMS sent to ${formattedPhone}`);
  } catch (error) {
    console.error(`Failed to send todo SMS to ${to}:`, error);
    throw error;
  }
}
