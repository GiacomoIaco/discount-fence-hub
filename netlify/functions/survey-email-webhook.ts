import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * SendGrid Event Webhook Handler
 *
 * Receives email events from SendGrid and updates recipient status:
 * - delivered: Email successfully delivered
 * - open: Email opened by recipient
 * - bounce: Email bounced
 * - dropped: Email dropped by SendGrid
 *
 * Configure in SendGrid: Settings > Mail Settings > Event Webhook
 * URL: https://discount-fence-hub.netlify.app/.netlify/functions/survey-email-webhook
 * Events: Delivered, Opens, Bounced, Dropped
 */
const handler: Handler = async (event: HandlerEvent) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const events = JSON.parse(event.body || '[]');

    if (!Array.isArray(events)) {
      return { statusCode: 400, body: 'Invalid payload' };
    }

    console.log(`Processing ${events.length} email events`);

    let processed = 0;

    for (const e of events) {
      const email = e.email;
      const eventType = e.event;
      const timestamp = e.timestamp ? new Date(e.timestamp * 1000).toISOString() : new Date().toISOString();

      if (!email || !eventType) {
        continue;
      }

      // Find recipients with this email
      const { data: recipients, error } = await supabase
        .from('survey_recipients')
        .select('id, email_status')
        .eq('recipient_email', email)
        .order('created_at', { ascending: false })
        .limit(5); // Only update recent recipients

      if (error || !recipients || recipients.length === 0) {
        continue;
      }

      for (const recipient of recipients) {
        const updates: Record<string, any> = {};

        switch (eventType) {
          case 'delivered':
            updates.email_status = 'delivered';
            updates.email_delivered_at = timestamp;
            break;

          case 'open':
            // Only update if not already opened
            if (recipient.email_status !== 'opened') {
              updates.email_status = 'opened';
              updates.email_opened_at = timestamp;
            }
            break;

          case 'bounce':
          case 'dropped':
            updates.email_status = 'bounced';
            updates.email_error = e.reason || e.type || eventType;
            break;

          case 'spamreport':
            updates.email_status = 'failed';
            updates.email_error = 'Marked as spam';
            break;

          default:
            continue; // Unknown event type
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('survey_recipients')
            .update(updates)
            .eq('id', recipient.id);

          processed++;
        }
      }
    }

    console.log(`Processed ${processed} email status updates`);

    return {
      statusCode: 200,
      body: JSON.stringify({ processed }),
    };

  } catch (error) {
    console.error('Email webhook error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

export { handler };
