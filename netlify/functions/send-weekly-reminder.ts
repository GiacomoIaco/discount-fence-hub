/**
 * Netlify Scheduled Function: Thursday 5pm Reminder
 * Sends reminder email to all leadership users to submit updates by Friday 2pm
 */
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getMondayOfCurrentWeek, formatWeekRange } from './lib/weekly-email-utils';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Schedule for Thursday at 5pm EST (22:00 UTC, accounting for EST = UTC-5)
const handler = schedule('0 22 * * 4', async () => {
  console.log('Running weekly reminder function...');

  try {
    const currentWeek = getMondayOfCurrentWeek();
    console.log('Current week:', currentWeek);

    // Check email settings
    const { data: settingsData } = await supabase
      .from('project_settings')
      .select('setting_value')
      .eq('setting_key', 'email_schedule')
      .single();

    // If emails are disabled, skip
    if (!settingsData?.setting_value?.isEnabled) {
      console.log('Email notifications are disabled');
      return { statusCode: 200, body: 'Emails disabled' };
    }

    // Check if reminder already sent
    const { data: lock } = await supabase
      .from('initiative_week_locks')
      .select('reminder_email_sent')
      .eq('week_start_date', currentWeek)
      .single();

    if (lock?.reminder_email_sent) {
      console.log('Reminder already sent for this week');
      return { statusCode: 200, body: 'Reminder already sent' };
    }

    // Get all users with emails (reminder always goes to all users)
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('email, full_name')
      .not('email', 'is', null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      console.log('No users found to send reminder to');
      return { statusCode: 200, body: 'No users to send to' };
    }

    console.log(`Sending reminder to ${users.length} users`);

    // Generate email HTML
    const weekRange = formatWeekRange(currentWeek);
    const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          .deadline { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">⏰ Weekly Update Reminder</h1>
        </div>
        <div class="content">
          <p>Hi team,</p>
          <p>This is a friendly reminder to submit your initiative updates for this week (${weekRange}).</p>

          <div class="deadline">
            <strong>⚠️ Deadline: Friday at 2:00 PM EST</strong>
          </div>

          <p>After the deadline:</p>
          <ul>
            <li>The week will be locked automatically</li>
            <li>A summary email will be sent to the leadership team</li>
            <li>You'll have until Monday at 12 PM to make any final changes (grace period)</li>
          </ul>

          <div style="text-align: center;">
            <a href="${appUrl}/leadership?tab=initiatives" class="button">Submit Updates Now</a>
          </div>

          <p>Thank you for keeping the team informed!</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder from Discount Fence Hub Leadership Portal</p>
        </div>
      </body>
      </html>
    `;

    // Send email to each user via Resend
    const emailPromises = users.map(async (user) => {
      if (!user.email) return;

      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Leadership Updates <giacomo@discountfenceusa.com>',
            to: [user.email],
            subject: `Reminder: Submit Weekly Updates by Friday 2pm - ${weekRange}`,
            html: emailHtml,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error(`Resend error for ${user.email}:`, errorText);
        } else {
          console.log(`Reminder sent to: ${user.email}`);
        }
      } catch (error) {
        console.error(`Failed to send to ${user.email}:`, error);
      }
    });

    await Promise.allSettled(emailPromises);

    // Mark reminder as sent in database
    const { error: markError } = await supabase.rpc('mark_reminder_email_sent', {
      p_week_start_date: currentWeek,
    });

    if (markError) {
      console.error('Error marking reminder as sent:', markError);
    } else {
      console.log('Reminder marked as sent in database');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, emailsSent: users.length }),
    };
  } catch (error) {
    console.error('Error in weekly reminder function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send weekly reminder',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
});

export { handler };
