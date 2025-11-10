import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey);

async function applyMigration(filename: string) {
  console.log(`🔄 Applying migration: ${filename}\n`);

  try {
    const migrationPath = path.join(process.cwd(), 'migrations', filename);
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing SQL...\n');

    // Execute SQL using the exec_sql function
    const { error } = await supabase.rpc('exec_sql', {
      sql_string: sql
    });

    if (error) {
      console.error('❌ Failed to apply migration:', error);
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

const filename = process.argv[2] || '025_strategic_goal_system_simplified.sql';
applyMigration(filename);
