import { createClient } from '@supabase/supabase-js';
import type { Handler, HandlerEvent } from '@netlify/functions';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[todo-auto-archive] Starting auto-archive check...');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: archivedCount, error } = await supabase.rpc('archive_stale_todo_items', {
      days_threshold: 30,
    });

    if (error) {
      console.error('[todo-auto-archive] Error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    console.log(`[todo-auto-archive] Archived ${archivedCount} stale completed tasks.`);

    return {
      statusCode: 200,
      body: JSON.stringify({ archived: archivedCount }),
    };
  } catch (err) {
    console.error('[todo-auto-archive] Unexpected error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error' }) };
  }
};

export { handler };
