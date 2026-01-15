// Script to apply FSM migration via Supabase Management API
// This uses the database URL directly with pg client
// Run with: node scripts/run-fsm-migration-v2.cjs

const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];

async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'migrations', '144_fsm_core_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('🔄 Applying FSM migration via Supabase Management API...');
  console.log(`   Project: ${projectRef}`);
  console.log(`   File: 144_fsm_core_tables.sql\n`);

  // Try to use the Supabase sql endpoint (requires access token)
  // Since we don't have that, let's output the SQL for manual copy

  console.log('━'.repeat(80));
  console.log('Copy the SQL below and paste into Supabase SQL Editor:');
  console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('━'.repeat(80));
  console.log('\n');
  console.log(sql);
  console.log('\n');
  console.log('━'.repeat(80));
  console.log('End of SQL - copy everything above and run in Supabase SQL Editor');
  console.log('━'.repeat(80));
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
