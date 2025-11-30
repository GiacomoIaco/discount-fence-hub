import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSuperAdmin() {
  console.log('Checking super admin status...\n');

  // Check if is_super_admin column exists
  const { data: columns, error: colError } = await supabase
    .from('user_profiles')
    .select('*')
    .limit(1);

  if (colError) {
    console.error('Error querying user_profiles:', colError.message);
    return;
  }

  // Check Giacomo's status
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, role, is_super_admin')
    .or('email.ilike.%giacomo%,email.ilike.%iacoangeli%');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Users found:');
  console.log('============');
  users?.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`Name: ${user.full_name}`);
    console.log(`Role: ${user.role}`);
    console.log(`is_super_admin: ${user.is_super_admin}`);
    console.log('---');
  });

  // If no super admin, set it
  const giacomo = users?.find(u => u.email === 'giacomo@discountfenceusa.com');
  if (giacomo && !giacomo.is_super_admin) {
    console.log('\n⚠️  Giacomo is NOT set as super admin. Fixing...');

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ is_super_admin: true })
      .eq('email', 'giacomo@discountfenceusa.com');

    if (updateError) {
      console.error('Failed to update:', updateError.message);
    } else {
      console.log('✅ Updated giacomo to super admin!');
    }
  } else if (giacomo?.is_super_admin) {
    console.log('\n✅ Giacomo is already a super admin');
  }
}

checkSuperAdmin();
