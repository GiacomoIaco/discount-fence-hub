/**
 * Netlify Scheduled Function: Monday 12pm Grace Period End
 * Ends the grace period for the previous week, making it permanently read-only
 */
import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { getMondayOfLastWeek } from './lib/weekly-email-utils';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Schedule for Monday at 12pm EST (17:00 UTC, accounting for EST = UTC-5)
const handler = schedule('0 17 * * 1', async () => {
  console.log('Running end grace period function...');

  try {
    const lastWeek = getMondayOfLastWeek();
    console.log('Last week:', lastWeek);

    // Check if grace period is active for last week
    const { data: lock } = await supabase
      .from('initiative_week_locks')
      .select('in_grace_period, grace_period_ends_at')
      .eq('week_start_date', lastWeek)
      .single();

    if (!lock) {
      console.log('No lock record found for last week - nothing to do');
      return { statusCode: 200, body: 'No lock record found' };
    }

    if (!lock.in_grace_period) {
      console.log('Grace period already ended for last week');
      return { statusCode: 200, body: 'Grace period already ended' };
    }

    // End grace period for last week
    console.log('Ending grace period for last week...');
    const { error: endError } = await supabase.rpc('end_grace_period', {
      p_week_start_date: lastWeek,
    });

    if (endError) {
      console.error('Error ending grace period:', endError);
      throw new Error(`Failed to end grace period: ${endError.message}`);
    }

    console.log('Grace period ended successfully');

    // Optional: Send notification to users about late updates
    // For now, we'll just log it
    const { data: lateUpdates, error: updatesError } = await supabase
      .from('initiative_updates')
      .select('id, created_at, author:user_profiles(full_name)')
      .eq('week_start_date', lastWeek)
      .gte('created_at', lock.grace_period_ends_at || '');

    if (!updatesError && lateUpdates && lateUpdates.length > 0) {
      console.log(`${lateUpdates.length} updates were submitted during grace period`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        weekLocked: lastWeek,
        gracePeriodEnded: true,
        lateUpdateCount: lateUpdates?.length || 0,
      }),
    };
  } catch (error) {
    console.error('Error in end grace period function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to end grace period',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
});

export { handler };
