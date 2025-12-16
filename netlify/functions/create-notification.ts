import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CreateNotificationRequest {
  type: string;
  title: string;
  body: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  contact_id?: string;
  client_id?: string;
  project_id?: string;
  quote_id?: string;
  invoice_id?: string;
  job_id?: string;
  target_user_id?: string;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, unknown>;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const request: CreateNotificationRequest = JSON.parse(event.body || '{}');

    const {
      type,
      title,
      body,
      priority = 'normal',
      contact_id,
      client_id,
      project_id,
      quote_id,
      invoice_id,
      job_id,
      target_user_id,
      action_url,
      action_label,
      metadata = {}
    } = request;

    if (!type || !title || !body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: type, title, body' }),
      };
    }

    // Use the helper function if available, otherwise insert directly
    const { data, error } = await supabase.rpc('create_system_notification', {
      p_type: type,
      p_title: title,
      p_body: body,
      p_contact_id: contact_id || null,
      p_client_id: client_id || null,
      p_project_id: project_id || null,
      p_quote_id: quote_id || null,
      p_invoice_id: invoice_id || null,
      p_job_id: job_id || null,
      p_target_user_id: target_user_id || null,
      p_action_url: action_url || null,
      p_action_label: action_label || null,
      p_priority: priority,
      p_metadata: metadata
    });

    if (error) {
      // Fallback to direct insert if RPC fails
      const { data: directData, error: directError } = await supabase
        .from('mc_system_notifications')
        .insert({
          notification_type: type,
          title,
          body,
          priority,
          contact_id,
          client_id,
          project_id,
          quote_id,
          invoice_id,
          job_id,
          target_user_id,
          action_url,
          action_label,
          metadata
        })
        .select('id')
        .single();

      if (directError) {
        console.error('Create notification error:', directError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: directError.message }),
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, notification_id: directData.id }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, notification_id: data }),
    };
  } catch (error) {
    console.error('Create notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to create notification',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
