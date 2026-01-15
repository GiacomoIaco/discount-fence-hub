import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTestData() {
  console.log('='.repeat(60));
  console.log('FSM TEST DATA VERIFICATION');
  console.log('='.repeat(60));

  // 1. Locations
  console.log('\n📍 LOCATIONS:');
  const { data: locations } = await supabase.from('locations').select('*');
  console.table(locations || []);

  // 2. QBO Classes
  console.log('\n🏢 QBO CLASSES (selectable):');
  const { data: qboClasses } = await supabase
    .from('qbo_classes')
    .select('id, name, labor_code, location_code, bu_type')
    .eq('is_selectable', true)
    .order('name');
  console.table(qboClasses || []);

  // 3. Territories
  console.log('\n🗺️  TERRITORIES:');
  const { data: territories } = await supabase
    .from('territories')
    .select('id, name, code, zip_codes, location_code')
    .eq('is_active', true)
    .order('name');
  if (territories) {
    const mapped = territories.map(t => ({
      id: t.id.substring(0, 8) + '...',
      name: t.name,
      code: t.code,
      zip_count: t.zip_codes?.length || 0,
      location: t.location_code,
    }));
    console.table(mapped);
  }

  // 4. Crews
  console.log('\n👷 CREWS:');
  const { data: crews } = await supabase
    .from('crews')
    .select('id, name, code, location_code, crew_size')
    .eq('is_active', true)
    .order('name');
  if (crews) {
    const mapped = crews.map(c => ({
      id: c.id.substring(0, 8) + '...',
      name: c.name,
      code: c.code,
      location: c.location_code,
      size: c.crew_size,
    }));
    console.table(mapped);
  }

  // 5. FSM Team Profiles (reps)
  console.log('\n👤 FSM TEAM PROFILES (reps):');
  const { data: reps } = await supabase
    .from('fsm_team_profiles')
    .select(`
      user_id,
      fsm_roles,
      is_active,
      user:user_profiles!user_id(full_name, email)
    `)
    .contains('fsm_roles', ['rep'])
    .eq('is_active', true);
  if (reps) {
    const mapped = reps.map(r => ({
      user_id: r.user_id.substring(0, 8) + '...',
      name: (r.user as any)?.full_name || 'N/A',
      email: (r.user as any)?.email || 'N/A',
      roles: r.fsm_roles?.join(', '),
    }));
    console.table(mapped);
  }

  // 6. Territory Coverage
  console.log('\n🎯 TERRITORY COVERAGE:');
  const { data: coverage } = await supabase
    .from('fsm_territory_coverage')
    .select(`
      user_id,
      territory_id,
      is_primary,
      coverage_days,
      territory:territories!territory_id(name, code),
      user:user_profiles!user_id(full_name)
    `)
    .eq('is_active', true);
  if (coverage && coverage.length > 0) {
    const mapped = coverage.map(c => ({
      rep: (c.user as any)?.full_name || 'N/A',
      territory: (c.territory as any)?.name || 'N/A',
      code: (c.territory as any)?.code || 'N/A',
      primary: c.is_primary ? '✓' : '',
      days: c.coverage_days?.join(', ') || 'All',
    }));
    console.table(mapped);
  } else {
    console.log('  ⚠️  No territory coverage found!');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log('='.repeat(60));
  console.log(`  Locations: ${locations?.length || 0}`);
  console.log(`  QBO Classes: ${qboClasses?.length || 0}`);
  console.log(`  Territories: ${territories?.length || 0}`);
  console.log(`  Crews: ${crews?.length || 0}`);
  console.log(`  Reps: ${reps?.length || 0}`);
  console.log(`  Territory Coverage: ${coverage?.length || 0}`);

  // Check what's missing
  console.log('\n⚠️  MISSING DATA:');
  if (!territories?.length) console.log('  - No territories! Need to create test territories.');
  if (!crews?.length) console.log('  - No crews! Need to create test crew.');
  if (!coverage?.length) console.log('  - No territory coverage! Reps not assigned to territories.');
  if (territories?.length && crews?.length && coverage?.length) {
    console.log('  ✅ All required test data exists!');
  }
}

checkTestData().catch(console.error);
