import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function addClientHubToMenu() {
  // Check if already exists
  const { data: existing } = await supabase
    .from('menu_visibility')
    .select('*')
    .eq('menu_id', 'client-hub')
    .single();

  if (existing) {
    console.log('client-hub already exists:', existing);
    return;
  }

  // Insert new menu item
  const { data, error } = await supabase
    .from('menu_visibility')
    .insert({
      menu_id: 'client-hub',
      menu_name: 'Client Hub',
      visible_for_roles: ['admin', 'operations', 'sales-manager'],
      enabled_users: [],
      disabled_users: [],
      available_on: 'desktop',
      show_on_desktop: true,
      show_on_tablet: true,
      show_on_mobile: false,
      supported_on_desktop: true,
      supported_on_tablet: true,
      supported_on_mobile: false,
      category: 'operations',
      sort_order: 45,
      mobile_style: {
        bgColor: 'bg-blue-50 border border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        description: 'Manage clients & communities'
      }
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding client-hub:', error);
    return;
  }

  console.log('Added client-hub to menu:', data);
}

addClientHubToMenu();
