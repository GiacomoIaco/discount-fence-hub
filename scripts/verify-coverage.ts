import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verify() {
  // Direct query for territory coverage
  console.log('FSM_TERRITORY_COVERAGE (all rows):');
  const { data: cov, error: e1 } = await supabase.from('fsm_territory_coverage').select('*');
  if (e1) console.error('Error:', e1.message);
  console.table(cov || []);

  // Check with contains for rep role
  console.log('\nFSM_TEAM_PROFILES with rep role (using contains):');
  const { data: reps1, error: e2 } = await supabase
    .from('fsm_team_profiles')
    .select('user_id, fsm_roles, is_active')
    .contains('fsm_roles', ['rep']);
  if (e2) console.error('Error:', e2.message);
  console.log(`Found ${reps1?.length || 0} profiles with rep role`);

  // Check with array any
  console.log('\nFSM_TEAM_PROFILES with rep (raw array check):');
  const { data: reps2, error: e3 } = await supabase
    .from('fsm_team_profiles')
    .select('user_id, fsm_roles');
  if (e3) console.error('Error:', e3.message);
  const repsFiltered = reps2?.filter(r => r.fsm_roles?.includes('rep'));
  console.log(`Found ${repsFiltered?.length || 0} profiles with rep in array`);
}

verify().catch(console.error);
