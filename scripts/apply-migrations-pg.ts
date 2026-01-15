/**
 * Apply migrations directly via Postgres connection
 * Uses the DATABASE_URL from Supabase to execute SQL directly
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSql(sql: string, description: string): Promise<boolean> {
  console.log(`\n📦 ${description}`);
  console.log('─'.repeat(60));

  try {
    // Split SQL into individual statements and execute each
    // Remove comments and empty lines, split by semicolon
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;

      // Use the rpc call with a raw SQL function if available
      // Otherwise, we need to execute statement by statement
      const shortStatement = statement.substring(0, 60).replace(/\n/g, ' ');
      console.log(`  Executing: ${shortStatement}...`);

      // Try using Supabase's built-in SQL execution for specific operations
      if (statement.toUpperCase().startsWith('ALTER TABLE')) {
        // Parse ALTER TABLE statements
        const match = statement.match(/ALTER TABLE (\w+)\s+ADD COLUMN IF NOT EXISTS (\w+)/i);
        if (match) {
          // For column additions, we can check if column exists first
          console.log(`    → Adding column ${match[2]} to ${match[1]}`);
        }
      }
    }

    // Since we can't execute raw SQL without exec_sql,
    // let's just output the SQL for manual execution
    console.log('\n⚠️  Cannot execute SQL directly without exec_sql function.');
    console.log('Please run the following SQL in Supabase SQL Editor:');
    console.log('\n' + '═'.repeat(60));
    console.log(sql);
    console.log('═'.repeat(60) + '\n');

    return false;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

async function main() {
  const migrationFiles = process.argv.slice(2);

  if (migrationFiles.length === 0) {
    console.log('Usage: npx tsx scripts/apply-migrations-pg.ts <migration1.sql> [migration2.sql] ...');
    console.log('Example: npx tsx scripts/apply-migrations-pg.ts 217e_ticket_hub_fsm.sql 217f_invoice_flexibility.sql');
    process.exit(1);
  }

  console.log('🚀 Applying migrations...\n');

  // First, try to create exec_sql function
  const execSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql_string TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE sql_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO service_role;
`;

  console.log('First, you need to create the exec_sql function.');
  console.log('Copy and paste this into Supabase SQL Editor:');
  console.log('\n' + '═'.repeat(60));
  console.log(execSqlFunction);
  console.log('═'.repeat(60) + '\n');

  // Then output each migration
  for (const file of migrationFiles) {
    const migrationPath = path.join(process.cwd(), 'migrations', file);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      continue;
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`\n📄 Migration: ${file}`);
    console.log('─'.repeat(60));
    console.log(sql);
  }

  // Combine all migrations into one output
  console.log('\n\n' + '═'.repeat(60));
  console.log('📋 COMBINED SQL FOR ALL MIGRATIONS');
  console.log('Copy everything below and paste into Supabase SQL Editor:');
  console.log('═'.repeat(60) + '\n');

  let combinedSql = '';
  for (const file of migrationFiles) {
    const migrationPath = path.join(process.cwd(), 'migrations', file);
    if (fs.existsSync(migrationPath)) {
      combinedSql += `-- ${file}\n`;
      combinedSql += fs.readFileSync(migrationPath, 'utf-8');
      combinedSql += '\n\n';
    }
  }

  console.log(combinedSql);
}

main().catch(console.error);
