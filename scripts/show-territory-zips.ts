import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Get territories with ZIP codes
  const { data: territories } = await supabase
    .from('territories')
    .select('name, code, zip_codes')
    .eq('is_active', true)
    .order('name');

  console.log('TERRITORIES WITH ZIP CODES:\n');
  territories?.forEach(t => {
    console.log(`${t.name} (${t.code}): ${t.zip_codes?.join(', ')}`);
  });

  // Get territory coverage with names
  console.log('\n\nTERRITORY COVERAGE WITH NAMES:\n');
  const { data: cov } = await supabase
    .from('fsm_territory_coverage')
    .select(`
      is_primary,
      territory:territories!territory_id(name, code),
      user:user_profiles!user_id(full_name)
    `)
    .eq('is_active', true);

  cov?.forEach(c => {
    const t = c.territory as any;
    const u = c.user as any;
    console.log(`${u?.full_name}: ${t?.name} (${t?.code}) ${c.is_primary ? '[PRIMARY]' : ''}`);
  });
}

main().catch(console.error);
