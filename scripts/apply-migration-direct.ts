import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

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

    // Execute SQL using supabase-js RPC
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      console.error('❌ Failed to apply migration:', error.message);
      if (error.code === 'PGRST202' || error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('');
        console.log('⚠️  The exec_sql function does not exist in your database.');
        console.log('');
        console.log('To enable direct SQL execution, run migrations/000_enable_direct_migrations.sql');
        console.log('in Supabase SQL Editor first.');
      }
      console.log('');
      console.log('You can apply the migration manually via Supabase SQL Editor:');
      console.log('');
      console.log('━'.repeat(80));
      console.log(sql);
      console.log('━'.repeat(80));
      process.exit(1);
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
