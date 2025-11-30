import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking tables...\n');

  // Check project_function_owners
  const { data: owners, error: ownersError } = await supabase
    .from('project_function_owners')
    .select('*')
    .limit(5);

  if (ownersError) {
    console.log('❌ project_function_owners:', ownersError.message);
  } else {
    console.log('✅ project_function_owners exists, rows:', owners?.length);
  }

  // Check project_function_members
  const { data: members, error: membersError } = await supabase
    .from('project_function_members')
    .select('*')
    .limit(5);

  if (membersError) {
    console.log('❌ project_function_members:', membersError.message);
  } else {
    console.log('✅ project_function_members exists, rows:', members?.length);
  }

  // Try to insert a test owner
  console.log('\nTrying to add owner...');

  // Get first function
  const { data: functions } = await supabase
    .from('project_functions')
    .select('id, name')
    .limit(1);

  if (!functions || functions.length === 0) {
    console.log('No functions found');
    return;
  }

  console.log('Function:', functions[0].name);

  // Get a user that's not already an owner
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email')
    .neq('email', 'giacomo@highfortitude.com')
    .limit(1);

  if (!users || users.length === 0) {
    console.log('No other users found');
    return;
  }

  console.log('User to add:', users[0].email);

  // Check if already owner
  const { data: existingOwner } = await supabase
    .from('project_function_owners')
    .select('*')
    .eq('function_id', functions[0].id)
    .eq('user_id', users[0].id)
    .single();

  if (existingOwner) {
    console.log('User is already an owner');
    return;
  }

  // Get giacomo's user id
  const { data: giacomo } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'giacomo@highfortitude.com')
    .single();

  // Try to insert
  const { data: insertResult, error: insertError } = await supabase
    .from('project_function_owners')
    .insert({
      function_id: functions[0].id,
      user_id: users[0].id,
      added_by: giacomo?.id,
    })
    .select()
    .single();

  if (insertError) {
    console.log('❌ Insert failed:', insertError.message);
    console.log('   Code:', insertError.code);
    console.log('   Details:', insertError.details);
  } else {
    console.log('✅ Insert successful:', insertResult);

    // Clean up
    await supabase
      .from('project_function_owners')
      .delete()
      .eq('id', insertResult.id);
    console.log('   (Cleaned up test data)');
  }
}

checkTables();
