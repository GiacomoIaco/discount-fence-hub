import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Check all FSM team profiles
  console.log('ALL FSM TEAM PROFILES:');
  const { data: all, error: e1 } = await supabase.from('fsm_team_profiles').select('user_id, fsm_roles, is_active');
  if (e1) console.error('Error:', e1.message);
  console.table(all || []);

  // Check user_profiles with Sales role
  console.log('\nUSER_PROFILES (role contains sales):');
  const { data: sales, error: e2 } = await supabase.from('user_profiles').select('id, full_name, email, role').ilike('role', '%sales%');
  if (e2) console.error('Error:', e2.message);
  console.table(sales || []);

  // Check ALL user_profiles
  console.log('\nALL USER_PROFILES (first 15):');
  const { data: users, error: e3 } = await supabase.from('user_profiles').select('id, full_name, role').limit(15);
  if (e3) console.error('Error:', e3.message);
  console.table(users || []);
}

main().catch(console.error);
