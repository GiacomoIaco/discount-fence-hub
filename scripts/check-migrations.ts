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

async function checkMigrations() {
  console.log('🔍 Checking migration status...\n');

  try {
    // Check if schema_migrations table exists
    const { data: migrations, error } = await supabase
      .from('schema_migrations')
      .select('version, name, applied_at, applied_by')
      .order('version', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        console.log('❌ schema_migrations table does NOT exist');
        console.log('');
        console.log('You need to run: migrations/001_migration_tracking.sql');
        console.log('This will create the tracking table.');
        return;
      }
      throw error;
    }

    console.log('✅ schema_migrations table exists!');
    console.log('');

    if (migrations && migrations.length > 0) {
      console.log(`📊 Found ${migrations.length} applied migrations:\n`);
      console.log('━'.repeat(80));
      console.log('Version | Name                                    | Applied At          | Applied By');
      console.log('━'.repeat(80));

      migrations.forEach(m => {
        const appliedAt = new Date(m.applied_at).toLocaleString();
        console.log(`${m.version.padEnd(7)} | ${m.name.padEnd(39)} | ${appliedAt.padEnd(19)} | ${m.applied_by}`);
      });
      console.log('━'.repeat(80));
    } else {
      console.log('⚠️  No migrations are marked as applied yet.');
      console.log('');
      console.log('You should run: migrations/MARK_ALL_APPLIED.sql');
      console.log('This will mark migrations 001-024 as already applied.');
    }

  } catch (error) {
    console.error('❌ Error checking migrations:', error);
    process.exit(1);
  }
}

checkMigrations();
