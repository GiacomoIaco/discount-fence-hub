// Setup exec_sql function for running migrations
// This function allows us to execute arbitrary SQL via RPC
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function setupExecSql() {
  console.log('Setting up exec_sql function...\n');

  // First, let's try to create a simple table to test if we can run SQL
  const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/territories`, {
    method: 'GET',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    }
  });

  if (testResponse.ok) {
    console.log('✅ territories table already exists! Migration may have already been applied.');
    const data = await testResponse.json();
    console.log(`   Current row count: ${data.length}`);
    return;
  }

  if (testResponse.status === 404) {
    console.log('⚠️  territories table does not exist yet.');
    console.log('\nPlease apply the migration manually:');
    console.log('\n1. Go to: https://supabase.com/dashboard/project/mravqfoypwyutjqtoxet/sql/new');
    console.log('2. Copy the contents of: migrations/144_fsm_core_tables.sql');
    console.log('3. Paste and run the SQL');
  } else {
    const error = await testResponse.text();
    console.log(`Response: ${testResponse.status} - ${error}`);
  }
}

setupExecSql().catch(err => {
  console.error('Error:', err);
});
