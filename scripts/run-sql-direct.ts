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

async function runSql(sqlFile: string) {
  console.log(`🔄 Running SQL: ${sqlFile}\n`);

  try {
    // Read the migration file
    const sqlPath = path.join(process.cwd(), 'migrations', sqlFile);

    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ SQL file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📄 SQL Content:');
    console.log('━'.repeat(80));
    console.log(sql.substring(0, 500) + '...\n');
    console.log('━'.repeat(80));
    console.log('');

    // Create Supabase client
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Split SQL into individual statements and execute them
    // This is a simple approach - splits on semicolon followed by newline
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty lines
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      try {
        // Add semicolon back if needed
        const finalStatement = statement.endsWith(';') ? statement : statement + ';';

        console.log(`[${i + 1}/${statements.length}] Executing statement...`);

        const { data, error } = await supabase.rpc('exec_sql' as any, {
          sql_string: finalStatement
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error in statement ${i + 1}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n━'.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('');

    if (errorCount === 0) {
      console.log('🎉 All SQL statements executed successfully!');
    } else {
      console.log('⚠️  Some statements failed. Check errors above.');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get SQL file from command line args
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('❌ Please provide a SQL file name');
  console.log('Usage: npx tsx scripts/run-sql-direct.ts <sql-file>');
  console.log('Example: npx tsx scripts/run-sql-direct.ts 027_add_measurable_goal_tracking.sql');
  process.exit(1);
}

runSql(sqlFile);
