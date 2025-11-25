import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function runMigration(migrationFile: string) {
  console.log(`🔄 Running migration: ${migrationFile}\n`);

  const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`📝 Executing SQL (${sql.length} chars)...\n`);

  try {
    // Try using Supabase's pg_graphql or direct SQL endpoint
    // The endpoint is: POST /pg with { query: "SQL" }
    const response = await fetch(`${supabaseUrl}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Migration applied successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    }

    // If /pg doesn't work, try /sql endpoint
    const response2 = await fetch(`${supabaseUrl}/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (response2.ok) {
      const result = await response2.json();
      console.log('✅ Migration applied successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    }

    // Last resort - try the management API for SQL execution
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

    const response3 = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (response3.ok) {
      const result = await response3.json();
      console.log('✅ Migration applied successfully!');
      console.log('Result:', JSON.stringify(result, null, 2));
      return;
    }

    // None worked - print instructions
    console.log('━'.repeat(60));
    console.log('');
    console.log('⚠️  Could not execute SQL via API. Please apply manually.');
    console.log('');
    console.log('Copy the following SQL and paste it in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/' + supabaseUrl.replace('https://', '').split('.')[0] + '/sql');
    console.log('');
    console.log('━'.repeat(60));
    console.log(sql);
    console.log('━'.repeat(60));

  } catch (err) {
    console.error('❌ Error:', err);
    console.log('');
    console.log('Please apply the migration manually in Supabase SQL Editor.');
  }
}

const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-sql-migration.ts <migration-file>');
  process.exit(1);
}

runMigration(migrationFile);
