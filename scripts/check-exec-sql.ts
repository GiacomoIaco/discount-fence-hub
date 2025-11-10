import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function checkExecSql() {
  console.log('🔍 Checking if exec_sql function exists...\n');

  try {
    // Try to call exec_sql with a simple SELECT query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_string: 'SELECT 1 as test'
    });

    if (error) {
      if (error.code === 'PGRST202' || error.message.includes('function') || error.message.includes('not found')) {
        console.log('❌ exec_sql function does NOT exist');
        console.log('');
        console.log('You need to run: migrations/000_enable_direct_migrations.sql');
        console.log('This will create the function for direct migrations.');
        return;
      }
      throw error;
    }

    console.log('✅ exec_sql function exists and is working!');
    console.log('');
    console.log('🎉 Direct migration system is fully set up!');
    console.log('');
    console.log('I can now apply migrations directly using:');
    console.log('  npm run migrate:direct <filename>.sql');

  } catch (error) {
    console.error('❌ Error checking exec_sql:', error);
    process.exit(1);
  }
}

checkExecSql();
