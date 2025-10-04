import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  console.log('🔍 Checking Supabase Database Tables...\n');

  const tablesToCheck = [
    'sales_reps',
    'requests',
    'presentations',
    'roi_calculations',
    'activity_log',
    'photos'  // NEW table for photo gallery
  ];

  for (const tableName of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.log(`❌ Table "${tableName}" does NOT exist`);
        } else {
          console.log(`⚠️  Table "${tableName}": ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${tableName}" exists (${count || 0} rows)`);
      }
    } catch (err) {
      console.log(`❌ Error checking "${tableName}":`, err);
    }
  }

  console.log('\n📝 Note: If "photos" table is missing, run supabase-schema.sql in Supabase SQL Editor\n');
}

checkTables();
