import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

/**
 * Sync App Users to Survey Population
 *
 * Called to sync users from user_profiles table to a survey population.
 * Supports filtering by role.
 *
 * POST body:
 * {
 *   populationId: string,
 *   filters?: {
 *     roles?: string[],
 *     includeInactive?: boolean
 *   }
 * }
 */
const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { populationId, filters } = JSON.parse(event.body || '{}');

    if (!populationId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'populationId required' }) };
    }

    // Verify population exists and is app_users type
    const { data: population, error: popError } = await supabase
      .from('survey_populations')
      .select('*')
      .eq('id', populationId)
      .single();

    if (popError || !population) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Population not found' }) };
    }

    if (population.population_type !== 'app_users' && population.population_type !== 'mixed') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Population is not configured for app users' }),
      };
    }

    // Build user query
    let userQuery = supabase
      .from('user_profiles')
      .select('id, email, full_name, role, phone');

    // Apply role filter
    if (filters?.roles && filters.roles.length > 0) {
      userQuery = userQuery.in('role', filters.roles);
    }

    const { data: users, error: usersError } = await userQuery;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch users' }) };
    }

    if (!users || users.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No users matched filters', added: 0, skipped: 0 }),
      };
    }

    console.log(`Found ${users.length} users to sync`);

    let added = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      if (!user.email) {
        skipped++;
        continue;
      }

      // Check if contact already exists
      const { data: existing } = await supabase
        .from('survey_population_contacts')
        .select('id')
        .eq('population_id', populationId)
        .eq('contact_email', user.email)
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert new contact
      const { error: insertError } = await supabase
        .from('survey_population_contacts')
        .insert({
          population_id: populationId,
          contact_name: user.full_name,
          contact_email: user.email,
          contact_phone: user.phone,
          user_id: user.id,
          metadata: { role: user.role, source: 'app_users_sync' },
        });

      if (insertError) {
        console.error('Error inserting contact:', insertError);
        errors++;
      } else {
        added++;
      }
    }

    // Update population metadata
    await supabase
      .from('survey_populations')
      .update({
        last_synced_at: new Date().toISOString(),
        filters: filters || {},
      })
      .eq('id', populationId);

    console.log(`Sync complete: ${added} added, ${skipped} skipped, ${errors} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sync complete',
        added,
        skipped,
        errors,
        totalUsers: users.length,
      }),
    };

  } catch (error) {
    console.error('Sync error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

export { handler };
