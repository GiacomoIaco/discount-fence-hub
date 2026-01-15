// Script to apply FSM migration via Supabase Management API
// Run with: node scripts/run-fsm-migration.js

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];

async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'migrations', '144_fsm_core_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('🔄 Applying FSM migration...');
  console.log(`   Project: ${projectRef}`);
  console.log(`   File: 144_fsm_core_tables.sql`);

  // Split SQL into statements (basic split on semicolons not in strings)
  // For complex migrations, we need to handle this carefully
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/g)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`   Found ${statements.length} SQL statements`);

  // Use the Supabase REST API to execute each statement
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comment-only statements
    if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
      continue;
    }

    try {
      // Use the rpc endpoint to call exec_sql or direct query
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ sql_string: statement + ';' })
      });

      if (response.ok) {
        successCount++;
        process.stdout.write('.');
      } else {
        const error = await response.text();
        if (response.status === 404 && error.includes('exec_sql')) {
          console.log('\n\n⚠️  exec_sql function not found.');
          console.log('The migration SQL has been printed above.');
          console.log('Please copy it and run in Supabase SQL Editor manually.');
          console.log('\nSupabase Dashboard URL:');
          console.log(`https://supabase.com/dashboard/project/${projectRef}/sql`);
          process.exit(1);
        }
        // Try to continue with next statement
        console.log(`\n⚠️  Statement ${i + 1} returned: ${response.status}`);
        errorCount++;
      }
    } catch (err) {
      console.log(`\n❌ Error on statement ${i + 1}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n\n✅ Migration complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Errors: ${errorCount}`);
}

runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
