import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

const { Pool } = pg;

// Load environment variables
dotenv.config();

// Parse Supabase URL to get connection string
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY!;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project reference from Supabase URL');
  process.exit(1);
}

// Construct connection string
const connectionString = dbPassword
  ? `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Missing database connection info');
  console.error('   Set SUPABASE_DB_PASSWORD in .env or DATABASE_URL');
  process.exit(1);
}

async function applyMigration(migrationFile: string) {
  console.log(`🔄 Applying migration: ${migrationFile}\n`);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration...');
    console.log('━'.repeat(80));

    // Execute the entire SQL file
    const result = await pool.query(sql);

    console.log('━'.repeat(80));
    console.log('\n✅ Migration applied successfully!');
    console.log('');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please provide a migration file name');
  console.log('Usage: npx tsx scripts/apply-migration-pg.ts <migration-file>');
  console.log('Example: npx tsx scripts/apply-migration-pg.ts 027_add_measurable_goal_tracking.sql');
  process.exit(1);
}

applyMigration(migrationFile);
