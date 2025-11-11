import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function applyMigration(migrationFile: string) {
  console.log(`🔄 Applying migration: ${migrationFile}\n`);

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL:');
    console.log('━'.repeat(80));
    console.log(sql);
    console.log('━'.repeat(80));
    console.log('');

    // Execute SQL using Supabase REST API
    // We'll use the /rest/v1/rpc endpoint to call a custom function
    // or directly execute via the PostgREST query endpoint

    // For now, we'll use fetch to execute SQL via Supabase's query endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql_string: sql })
    });

    if (!response.ok) {
      const error = await response.text();

      // If exec_sql doesn't exist, provide instructions
      if (response.status === 404) {
        console.log('⚠️  The exec_sql function does not exist in your database.');
        console.log('');
        console.log('To enable direct SQL execution, you need to create this function:');
        console.log('');
        console.log('━'.repeat(80));
        console.log(`-- Run this in Supabase SQL Editor first:
CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;`);
        console.log('━'.repeat(80));
        console.log('');
        console.log('After creating this function, run this script again.');
        console.log('');
        console.log('OR you can apply the migration manually via Supabase SQL Editor:');
        console.log('');
        console.log('━'.repeat(80));
        console.log(sql);
        console.log('━'.repeat(80));
        process.exit(1);
      }

      console.error('❌ Failed to apply migration:', error);
      process.exit(1);
    }

    // exec_sql returns VOID, so response might be empty
    // Check if response has content before parsing
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      if (text && text.trim()) {
        try {
          const result = JSON.parse(text);
          // Response parsed successfully
        } catch (e) {
          // Ignore JSON parse errors for empty responses
        }
      }
    }

    console.log('✅ Migration applied successfully!');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please provide a migration file name');
  console.log('Usage: npm run migrate:direct <migration-file>');
  console.log('Example: npm run migrate:direct 024_fix_project_activity_rls.sql');
  process.exit(1);
}

applyMigration(migrationFile);
