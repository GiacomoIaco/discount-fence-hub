import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import type { Config } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Survey Analytics Snapshot - Runs daily to compute and store analytics
 *
 * This function:
 * 1. Finds distributions with new responses since last snapshot
 * 2. Computes NPS, response rates, and other metrics
 * 3. Stores snapshot for trend analysis
 */
const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  console.log('Survey analytics snapshot running at:', new Date().toISOString());

  try {
    const today = new Date().toISOString().split('T')[0];

    // Find distributions that need analytics snapshots
    const { data: distributions, error: distError } = await supabase
      .from('survey_distributions')
      .select(`
        id,
        campaign_id,
        survey_id,
        total_sent,
        total_completed,
        sent_at
      `)
      .not('sent_at', 'is', null)
      .gt('total_sent', 0);

    if (distError) {
      console.error('Error fetching distributions:', distError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch distributions' }) };
    }

    if (!distributions || distributions.length === 0) {
      console.log('No distributions to process');
      return { statusCode: 200, body: JSON.stringify({ message: 'No distributions', processed: 0 }) };
    }

    let snapshotsCreated = 0;

    for (const dist of distributions) {
      try {
        // Check if we already have a snapshot for today
        const { data: existingSnapshot } = await supabase
          .from('survey_analytics_snapshots')
          .select('id')
          .eq('distribution_id', dist.id)
          .eq('snapshot_date', today)
          .single();

        if (existingSnapshot) {
          continue; // Already have today's snapshot
        }

        // Get all responses for this distribution
        const { data: responses, error: responsesError } = await supabase
          .from('survey_responses')
          .select('nps_score, csat_score, time_to_complete, completed_at')
          .eq('distribution_id', dist.id)
          .not('completed_at', 'is', null);

        if (responsesError) {
          console.error(`Error fetching responses for distribution ${dist.id}:`, responsesError);
          continue;
        }

        if (!responses || responses.length === 0) {
          continue; // No responses yet
        }

        // Calculate metrics
        const totalResponses = responses.length;
        const responseRate = dist.total_sent > 0
          ? Math.round((totalResponses / dist.total_sent) * 10000) / 100
          : 0;

        // NPS calculation
        const npsResponses = responses.filter(r => r.nps_score !== null);
        let npsScore: number | null = null;
        let npsPromoters = 0;
        let npsPassives = 0;
        let npsDetractors = 0;

        if (npsResponses.length > 0) {
          npsPromoters = npsResponses.filter(r => r.nps_score! >= 9).length;
          npsPassives = npsResponses.filter(r => r.nps_score! >= 7 && r.nps_score! <= 8).length;
          npsDetractors = npsResponses.filter(r => r.nps_score! <= 6).length;
          npsScore = Math.round(((npsPromoters - npsDetractors) / npsResponses.length) * 100);
        }

        // CSAT calculation
        const csatResponses = responses.filter(r => r.csat_score !== null);
        let csatScore: number | null = null;
        const csatDistribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

        if (csatResponses.length > 0) {
          csatResponses.forEach(r => {
            csatDistribution[String(r.csat_score!)]++;
          });
          csatScore = Math.round((csatResponses.reduce((sum, r) => sum + r.csat_score!, 0) / csatResponses.length) * 100) / 100;
        }

        // Average completion time
        const timesWithValues = responses.filter(r => r.time_to_complete);
        const avgCompletionTime = timesWithValues.length > 0
          ? Math.round(timesWithValues.reduce((sum, r) => sum + r.time_to_complete!, 0) / timesWithValues.length)
          : null;

        // Get previous distribution for trend comparison (same campaign)
        let prevDistributionId: string | null = null;
        let npsChange: number | null = null;
        let responseRateChange: number | null = null;

        if (dist.campaign_id) {
          const { data: prevDist } = await supabase
            .from('survey_distributions')
            .select('id')
            .eq('campaign_id', dist.campaign_id)
            .lt('sent_at', dist.sent_at)
            .order('sent_at', { ascending: false })
            .limit(1)
            .single();

          if (prevDist) {
            prevDistributionId = prevDist.id;

            // Get previous snapshot for comparison
            const { data: prevSnapshot } = await supabase
              .from('survey_analytics_snapshots')
              .select('nps_score, response_rate')
              .eq('distribution_id', prevDist.id)
              .order('snapshot_date', { ascending: false })
              .limit(1)
              .single();

            if (prevSnapshot) {
              if (prevSnapshot.nps_score !== null && npsScore !== null) {
                npsChange = npsScore - prevSnapshot.nps_score;
              }
              if (prevSnapshot.response_rate !== null) {
                responseRateChange = Math.round((responseRate - Number(prevSnapshot.response_rate)) * 100) / 100;
              }
            }
          }
        }

        // Insert snapshot
        const { error: insertError } = await supabase
          .from('survey_analytics_snapshots')
          .insert({
            distribution_id: dist.id,
            survey_id: dist.survey_id,
            campaign_id: dist.campaign_id,
            snapshot_date: today,
            total_recipients: dist.total_sent,
            total_responses: totalResponses,
            response_rate: responseRate,
            avg_completion_time: avgCompletionTime,
            nps_score: npsScore,
            nps_promoters: npsPromoters,
            nps_passives: npsPassives,
            nps_detractors: npsDetractors,
            csat_score: csatScore,
            csat_distribution: csatDistribution,
            prev_distribution_id: prevDistributionId,
            nps_change: npsChange,
            response_rate_change: responseRateChange,
          });

        if (insertError) {
          console.error(`Error inserting snapshot for distribution ${dist.id}:`, insertError);
          continue;
        }

        // Also update the distribution with computed metrics
        await supabase
          .from('survey_distributions')
          .update({
            total_completed: totalResponses,
            response_rate: responseRate,
            avg_completion_time: avgCompletionTime,
            nps_score: npsScore,
          })
          .eq('id', dist.id);

        snapshotsCreated++;

      } catch (err) {
        console.error(`Error processing distribution ${dist.id}:`, err);
      }
    }

    console.log(`Analytics snapshot complete: ${snapshotsCreated} snapshots created`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Analytics snapshots created',
        snapshotsCreated,
        distributionsProcessed: distributions.length,
      }),
    };

  } catch (error) {
    console.error('Analytics snapshot error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

// Run daily at 2 AM UTC (after most responses come in)
export const config: Config = {
  schedule: '0 2 * * *',
};

export { handler };
