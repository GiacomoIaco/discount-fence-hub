import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const appUrl = process.env.URL || 'https://discount-fence-hub.netlify.app';

/**
 * Survey Scheduler - Runs every hour to check for campaigns due to be sent
 *
 * This function:
 * 1. Finds active recurring campaigns with next_send_at <= now
 * 2. Triggers send-survey for each
 * 3. Updates next_send_at based on recurrence settings
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Survey scheduler running at:', new Date().toISOString());

  try {
    // Find campaigns due to be sent
    const now = new Date().toISOString();

    const { data: dueCampaigns, error: campaignsError } = await supabase
      .from('survey_campaigns')
      .select(`
        *,
        survey:surveys(id, title),
        population:survey_populations(id, name, contact_count)
      `)
      .eq('status', 'active')
      .lte('next_send_at', now)
      .not('next_send_at', 'is', null);

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch campaigns' }),
      };
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      console.log('No campaigns due for sending');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No campaigns due', processed: 0 }),
      };
    }

    console.log(`Found ${dueCampaigns.length} campaigns to process`);

    const results = [];

    for (const campaign of dueCampaigns) {
      try {
        console.log(`Processing campaign: ${campaign.code} - ${campaign.name}`);

        // Call send-survey function
        const sendResponse = await fetch(`${appUrl}/.netlify/functions/send-survey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: campaign.id }),
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok) {
          console.error(`Failed to send campaign ${campaign.code}:`, sendResult);
          results.push({ campaignId: campaign.id, code: campaign.code, success: false, error: sendResult.error });
          continue;
        }

        console.log(`Campaign ${campaign.code} sent successfully:`, sendResult);

        // Calculate next send date
        let nextSendAt: string | null = null;

        if (campaign.schedule_type === 'recurring' && campaign.recurrence_interval && campaign.recurrence_unit) {
          const nextDate = new Date();

          switch (campaign.recurrence_unit) {
            case 'days':
              nextDate.setDate(nextDate.getDate() + campaign.recurrence_interval);
              break;
            case 'weeks':
              nextDate.setDate(nextDate.getDate() + (campaign.recurrence_interval * 7));
              break;
            case 'months':
              nextDate.setMonth(nextDate.getMonth() + campaign.recurrence_interval);
              break;
          }

          // Set the time if specified
          if (campaign.recurrence_time) {
            const [hours, minutes] = campaign.recurrence_time.split(':').map(Number);
            nextDate.setUTCHours(hours, minutes, 0, 0);
          }

          nextSendAt = nextDate.toISOString();
        }

        // Update campaign
        const updateData: any = {
          last_sent_at: now,
          total_distributions: (campaign.total_distributions || 0) + 1,
        };

        if (nextSendAt) {
          updateData.next_send_at = nextSendAt;
        } else {
          // One-time campaign, mark as completed
          updateData.status = 'completed';
          updateData.next_send_at = null;
        }

        await supabase
          .from('survey_campaigns')
          .update(updateData)
          .eq('id', campaign.id);

        results.push({
          campaignId: campaign.id,
          code: campaign.code,
          success: true,
          sent: sendResult.sent,
          nextSendAt,
        });

      } catch (err) {
        console.error(`Error processing campaign ${campaign.id}:`, err);
        results.push({ campaignId: campaign.id, code: campaign.code, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Scheduler complete: ${successCount}/${results.length} campaigns processed successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Scheduler run complete',
        processed: results.length,
        successful: successCount,
        results,
      }),
    };

  } catch (error) {
    console.error('Scheduler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

// Run every hour
export const config: Config = {
  schedule: '0 * * * *', // Every hour at minute 0
};

export { handler };
