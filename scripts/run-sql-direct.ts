import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;

async function runSql(sql: string) {
  // Try the /query endpoint which some Supabase instances support
  const endpoints = [
    '/rest/v1/rpc/exec_sql',
    '/pg/query',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying ${endpoint}...`);
      const response = await fetch(`${supabaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(endpoint.includes('exec_sql') ? { sql_string: sql } : { query: sql })
      });

      if (response.ok) {
        console.log(`✅ Success via ${endpoint}`);
        return true;
      }
      console.log(`  Status: ${response.status}`);
    } catch (e) {
      console.log(`  Error: ${e}`);
    }
  }
  return false;
}

async function main() {
  const files = ['217e_ticket_hub_fsm.sql', '217f_invoice_flexibility.sql', '217g_analytics_views.sql', '217h_warranty_helper.sql'];

  console.log('Combining all migrations...\n');

  let allSql = '';
  for (const file of files) {
    const p = path.join(process.cwd(), 'migrations', file);
    if (fs.existsSync(p)) {
      allSql += `-- ${file}\n` + fs.readFileSync(p, 'utf-8') + '\n\n';
    }
  }

  console.log('Combined SQL:');
  console.log('='.repeat(60));
  console.log(allSql);
  console.log('='.repeat(60));

  const success = await runSql(allSql);
  if (!success) {
    console.log('\n❌ Could not execute SQL automatically.');
    console.log('\nPlease copy the SQL above and run in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/mravqfoypwyutjqtoxet/sql/new');
  }
}

main();
