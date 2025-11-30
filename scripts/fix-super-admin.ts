import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

console.log('Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  console.log('Setting giacomo@highfortitude.com as super admin...');

  const { error, count } = await supabase
    .from('user_profiles')
    .update({ is_super_admin: true })
    .eq('email', 'giacomo@highfortitude.com');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('✅ Update successful!');

  // Verify
  const { data, error: verifyError } = await supabase
    .from('user_profiles')
    .select('email, full_name, is_super_admin')
    .eq('email', 'giacomo@highfortitude.com')
    .single();

  if (verifyError) {
    console.error('Verify error:', verifyError.message);
    return;
  }

  console.log('\nVerification:');
  console.log(`  Email: ${data.email}`);
  console.log(`  Name: ${data.full_name}`);
  console.log(`  is_super_admin: ${data.is_super_admin}`);

  if (data.is_super_admin) {
    console.log('\n🎉 SUCCESS! You are now a super admin.');
    console.log('   Please log out and log back in to see the changes.');
  } else {
    console.log('\n⚠️  WARNING: is_super_admin is still false!');
  }
}

fix();
