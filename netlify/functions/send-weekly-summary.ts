/**
 * Netlify Scheduled Function: Friday 2pm Summary
 * Locks the current week and sends summary email to leadership team
 */
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  getMondayOfCurrentWeek,
  formatWeekRange,
  getRecipients,
  groupUpdatesByHierarchy,
  generateSummaryHTML,
} from './lib/weekly-email-utils';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Schedule for Friday at 2pm EST (19:00 UTC, accounting for EST = UTC-5)
const handler = schedule('0 19 * * 5', async () => {
  console.log('Running weekly summary function...');

  try {
    const currentWeek = getMondayOfCurrentWeek();
    console.log('Current week:', currentWeek);

    // Check if summary already sent
    const { data: lock } = await supabase
      .from('initiative_week_locks')
      .select('summary_email_sent')
      .eq('week_start_date', currentWeek)
      .single();

    if (lock?.summary_email_sent) {
      console.log('Summary already sent for this week');
      return { statusCode: 200, body: 'Summary already sent' };
    }

    // 1. Lock the week (with grace period starting)
    console.log('Locking week with grace period...');
    const { error: lockError } = await supabase.rpc('lock_week', {
      p_week_start_date: currentWeek,
      p_locked_by: null,
      p_lock_reason: 'auto_friday_2pm',
    });

    if (lockError) {
      console.error('Error locking week:', lockError);
      throw new Error(`Failed to lock week: ${lockError.message}`);
    }

    console.log('Week locked successfully');

    // 2. Fetch all updates for this week with full hierarchy
    const { data: updates, error: updatesError } = await supabase
      .from('initiative_updates')
      .select(`
        *,
        initiative:project_initiatives(
          title,
          area:project_areas(
            name,
            function:project_functions(name)
          )
        ),
        author:user_profiles(full_name)
      `)
      .eq('week_start_date', currentWeek);

    if (updatesError) {
      console.error('Error fetching updates:', updatesError);
      throw new Error(`Failed to fetch updates: ${updatesError.message}`);
    }

    console.log(`Found ${updates?.length || 0} updates`);

    // 3. Group updates by hierarchy
    const groupedUpdates = groupUpdatesByHierarchy(updates || []);

    // 4. Generate HTML email
    const emailHtml = generateSummaryHTML(groupedUpdates, currentWeek);

    // 5. Get recipients from settings (for now using default)
    // TODO: Fetch from project_settings table
    const { data: settings } = await supabase
      .from('project_settings')
      .select('setting_value')
      .eq('setting_key', 'email_schedule')
      .single();

    const recipients = getRecipients(settings?.setting_value);
    console.log(`Sending summary to ${recipients.length} recipients`);

    // 6. Send email via SendGrid
    const weekRange = formatWeekRange(currentWeek);

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: recipients.map(email => ({ email })),
        }],
        from: { email: 'giacomo@discountfenceusa.com', name: 'Leadership Weekly Summary' },
        subject: `Leadership Weekly Summary - Week of ${weekRange}`,
        content: [{
          type: 'text/html',
          value: emailHtml,
        }],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('SendGrid error:', errorText);
      throw new Error(`SendGrid API error: ${errorText}`);
    }

    console.log('Summary email sent successfully');

    // 7. Mark email as sent
    const { error: markError } = await supabase.rpc('mark_summary_email_sent', {
      p_week_start_date: currentWeek,
    });

    if (markError) {
      console.error('Error marking summary as sent:', markError);
    } else {
      console.log('Summary marked as sent in database');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        weekLocked: currentWeek,
        updatesSent: updates?.length || 0,
        recipientsSent: recipients.length,
      }),
    };
  } catch (error) {
    console.error('Error in weekly summary function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to send weekly summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
});

export { handler };
