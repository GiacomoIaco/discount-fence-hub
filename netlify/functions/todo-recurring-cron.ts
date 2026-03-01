import { createClient } from '@supabase/supabase-js';
import type { Handler, HandlerEvent } from '@netlify/functions';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const handler: Handler = async (event: HandlerEvent) => {
  console.log('[todo-recurring-cron] Starting recurring task check...');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Find recurring tasks that are overdue and not done (missed tasks)
  const { data: overdueTasks, error: fetchError } = await supabase
    .from('todo_items')
    .select('id, title, recurrence_rule, due_date')
    .not('recurrence_rule', 'is', null)
    .lt('due_date', new Date().toISOString().split('T')[0])
    .neq('status', 'done');

  if (fetchError) {
    console.error('[todo-recurring-cron] Error fetching overdue recurring tasks:', fetchError);
    return { statusCode: 500, body: JSON.stringify({ error: fetchError.message }) };
  }

  console.log(`[todo-recurring-cron] Found ${overdueTasks?.length || 0} overdue recurring tasks`);

  let created = 0;
  for (const task of overdueTasks || []) {
    try {
      const { data: newId, error } = await supabase.rpc('create_next_recurring_todo', { p_item_id: task.id });
      if (error) {
        console.warn(`[todo-recurring-cron] Failed to create next for ${task.id}:`, error.message);
      } else if (newId) {
        created++;
        console.log(`[todo-recurring-cron] Created next instance ${newId} for "${task.title}"`);
      }
    } catch (err) {
      console.warn(`[todo-recurring-cron] Error processing ${task.id}:`, err);
    }
  }

  console.log(`[todo-recurring-cron] Done. Created ${created} new recurring instances.`);

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: overdueTasks?.length || 0, created }),
  };
};

export { handler };
