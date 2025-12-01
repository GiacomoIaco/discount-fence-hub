import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMembers() {
  console.log('=== Debugging Function Members ===\n');

  // 1. Check all existing members
  const { data: allMembers, error: membersError } = await supabase
    .from('project_function_members')
    .select('*, user_profile:user_profiles(full_name, email), function:project_functions(name)');

  if (membersError) {
    console.log('❌ Error fetching members:', membersError.message);
  } else {
    console.log('Current members in database:', allMembers?.length || 0);
    allMembers?.forEach(m => {
      console.log(`  - ${m.user_profile?.full_name} in ${m.function?.name}`);
    });
  }

  // 2. Get a function to test with
  const { data: functions } = await supabase
    .from('project_functions')
    .select('id, name')
    .limit(1);

  if (!functions || functions.length === 0) {
    console.log('No functions found');
    return;
  }

  const testFunction = functions[0];
  console.log('\nTest function:', testFunction.name);

  // 3. Get a user who is NOT an owner and NOT a member
  const { data: owners } = await supabase
    .from('project_function_owners')
    .select('user_id')
    .eq('function_id', testFunction.id);

  const { data: existingMembers } = await supabase
    .from('project_function_members')
    .select('user_id')
    .eq('function_id', testFunction.id);

  const excludeIds = [
    ...(owners?.map(o => o.user_id) || []),
    ...(existingMembers?.map(m => m.user_id) || [])
  ];

  console.log('Excluded user IDs (owners + existing members):', excludeIds);

  const { data: availableUsers } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .not('id', 'in', `(${excludeIds.length > 0 ? excludeIds.join(',') : 'null'})`);

  console.log('\nAvailable users for testing:', availableUsers?.length || 0);
  availableUsers?.slice(0, 3).forEach(u => {
    console.log(`  - ${u.full_name} (${u.email})`);
  });

  if (!availableUsers || availableUsers.length === 0) {
    console.log('No available users to test with');
    return;
  }

  // 4. Try to insert a test member
  const testUser = availableUsers[0];
  console.log('\nTrying to add member:', testUser.full_name);

  // Get giacomo's ID for added_by
  const { data: giacomo } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', 'giacomo@highfortitude.com')
    .single();

  const { data: insertResult, error: insertError } = await supabase
    .from('project_function_members')
    .insert({
      function_id: testFunction.id,
      user_id: testUser.id,
      added_by: giacomo?.id,
    })
    .select()
    .single();

  if (insertError) {
    console.log('❌ Insert failed!');
    console.log('   Error code:', insertError.code);
    console.log('   Message:', insertError.message);
    console.log('   Details:', insertError.details);
    console.log('   Hint:', insertError.hint);
  } else {
    console.log('✅ Insert successful!', insertResult);

    // Clean up
    await supabase
      .from('project_function_members')
      .delete()
      .eq('id', insertResult.id);
    console.log('   (Cleaned up test data)');
  }
}

debugMembers();
