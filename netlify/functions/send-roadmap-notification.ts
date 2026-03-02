import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY;
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface RoadmapNotificationRequest {
  roadmapItemId: string;
  roadmapItemCode: string;
  roadmapItemTitle: string;
  createdById: string;
  triggeredByName: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('Starting roadmap notification function...');

    const payload: RoadmapNotificationRequest = JSON.parse(event.body || '{}');
    const { roadmapItemId, roadmapItemCode, roadmapItemTitle, createdById, triggeredByName } = payload;

    console.log('Roadmap notification request:', { roadmapItemCode, createdById });

    if (!roadmapItemId || !createdById) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get the creator's profile (phone and email)
    const { data: creator, error: creatorError } = await supabase
      .from('user_profiles')
      .select('id, email, phone, full_name')
      .eq('id', createdById)
      .single();

    if (creatorError || !creator) {
      console.log('Could not find creator profile:', creatorError);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Creator not found', sent: 0 }),
      };
    }

    console.log(`Notifying creator: ${creator.full_name || creator.email}`);

    // Check notification preferences (category: 'roadmap', type: 'idea_completed')
    const { data: preferences } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', createdById)
      .eq('category', 'roadmap')
      .eq('notification_type', 'idea_completed');

    const userPref = preferences?.[0];
    // Default to enabled if no preference exists
    const emailEnabled = userPref ? userPref.email_enabled : true;
    const smsEnabled = userPref ? userPref.sms_enabled : true;

    // Generate notification content
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';
    const roadmapUrl = `${appUrl}/?section=roadmap`;

    // Truncate title for SMS
    const shortTitle = roadmapItemTitle.length > 30
      ? roadmapItemTitle.substring(0, 27) + '...'
      : roadmapItemTitle;

    const smsText = `🎉 DFH: Your idea "${shortTitle}" [${roadmapItemCode}] has been implemented! ${roadmapUrl}`;

    const emailSubject = `Your Roadmap Idea Has Been Implemented! 🎉`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Great News! 🎉</h2>
        <p>Hi ${creator.full_name || 'there'},</p>
        <p>Your roadmap idea has been implemented:</p>
        <div style="background: #f3f4f6; border-left: 4px solid #7c3aed; padding: 16px; margin: 16px 0;">
          <strong style="color: #7c3aed;">[${roadmapItemCode}]</strong>
          <p style="font-size: 18px; margin: 8px 0 0 0;">${roadmapItemTitle}</p>
        </div>
        <p>Thank you for contributing to making our app better!</p>
        <p style="margin-top: 24px;">
          <a href="${roadmapUrl}" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">
            View Roadmap
          </a>
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
          — The Discount Fence Hub Team
        </p>
      </div>
    `;

    const promises: Promise<void>[] = [];

    // Send SMS if enabled and phone exists
    if (creator.phone && smsEnabled) {
      promises.push(sendSms(creator.phone, smsText));
    }

    // Send email if enabled
    if (creator.email && emailEnabled && resendApiKey) {
      promises.push(sendEmail(creator.email, emailSubject, emailHtml));
    }

    // Wait for all notifications to complete
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failCount = results.filter(r => r.status === 'rejected').length;

    console.log(`Notifications sent: ${successCount} success, ${failCount} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Notified ${creator.full_name || creator.email}`,
        sent: successCount,
        failed: failCount,
      }),
    };
  } catch (error) {
    console.error('Roadmap notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

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
