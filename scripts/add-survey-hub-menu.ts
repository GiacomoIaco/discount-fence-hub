import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function addMenuItem() {
  // First check if it exists
  const { data: existing } = await supabase
    .from('menu_visibility')
    .select('*')
    .eq('menu_id', 'survey-hub')
    .single();

  if (existing) {
    console.log('survey-hub already exists:', existing);
    return;
  }

  // Insert into menu_visibility table
  const { data, error } = await supabase
    .from('menu_visibility')
    .insert({
      menu_id: 'survey-hub',
      menu_name: 'Survey Hub',
      visible_for_roles: ['admin', 'operations', 'sales-manager'],
      show_on_mobile: false,
      show_on_tablet: true,
      show_on_desktop: true
    })
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Added survey-hub:', data);
  }
}

addMenuItem().catch(console.error);
