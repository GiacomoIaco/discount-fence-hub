#!/usr/bin/env node
/**
 * Verify AI Sales Coach tables were created successfully
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log('🔍 Verifying AI Sales Coach Tables...\n');

  const tables = [
    'recordings',
    'sales_processes',
    'knowledge_bases',
    'manager_reviews'
  ];

  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table "${table}" - Error: ${error.message}`);
      } else {
        console.log(`✅ Table "${table}" exists (${count || 0} rows)`);
      }
    } catch (err: any) {
      console.log(`❌ Table "${table}" - ${err.message}`);
    }
  }

  // Check for default data
  console.log('\n📦 Checking seed data...');

  const { data: process } = await supabase
    .from('sales_processes')
    .select('id, name')
    .eq('id', 'standard')
    .single();

  if (process) {
    console.log(`✅ Default sales process "${process.name}" exists`);
  } else {
    console.log('❌ Default sales process not found');
  }

  const { data: kb, count: kbCount } = await supabase
    .from('knowledge_bases')
    .select('*', { count: 'exact', head: true });

  if (kbCount && kbCount > 0) {
    console.log(`✅ Knowledge base exists (${kbCount} entries)`);
  } else {
    console.log('❌ Knowledge base not found');
  }

  console.log('\n✨ Verification complete!');
}

verifyTables();
