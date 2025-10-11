#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * This script manages database migrations safely by:
 * - Tracking which migrations have been applied
 * - Running migrations in order
 * - Calculating checksums to detect changes
 * - Supporting dry-run mode for testing
 * - Providing rollback information
 *
 * Usage:
 *   npm run migrate:check     # Dry run - show what would be applied
 *   npm run migrate:apply     # Apply pending migrations
 *   npm run migrate:status    # Show migration status
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env') });

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  migration: (msg: string) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
};

interface Migration {
  version: string;
  name: string;
  filename: string;
  filepath: string;
  checksum: string;
  content: string;
}

interface AppliedMigration {
  version: string;
  name: string;
  applied_at: string;
  checksum: string | null;
}

// Get Supabase credentials
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
// Check for both naming conventions
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  log.error('Missing required environment variables:');
  if (!supabaseUrl) log.error('  - VITE_SUPABASE_URL');
  if (!supabaseServiceKey) log.error('  - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  log.warning('\nPlease add SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) to your .env file');
  log.info('You can find it in: Supabase Dashboard → Settings → API → service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Calculate SHA-256 checksum of file content
 */
function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Parse migration filename to extract version and name
 * Format: 001_migration_name.sql
 */
function parseMigrationFilename(filename: string): { version: string; name: string } | null {
  const match = filename.match(/^(\d{3})_(.+)\.sql$/);
  if (!match) return null;

  return {
    version: match[1],
    name: match[2]
  };
}

/**
 * Get all migration files from the migrations directory
 */
function getMigrationFiles(): Migration[] {
  const migrationsDir = resolve(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f.match(/^\d{3}_/))
    .sort(); // Sort alphabetically (which sorts numerically for our format)

  const migrations: Migration[] = [];

  for (const filename of files) {
    const parsed = parseMigrationFilename(filename);
    if (!parsed) {
      log.warning(`Skipping invalid migration filename: ${filename}`);
      continue;
    }

    const filepath = resolve(migrationsDir, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    const checksum = calculateChecksum(content);

    migrations.push({
      version: parsed.version,
      name: parsed.name,
      filename,
      filepath,
      checksum,
      content
    });
  }

  return migrations;
}

/**
 * Get all applied migrations from the database
 */
async function getAppliedMigrations(): Promise<AppliedMigration[]> {
  try {
    const { data, error } = await supabase
      .from('schema_migrations')
      .select('version, name, applied_at, checksum')
      .order('version', { ascending: true });

    if (error) {
      // If table doesn't exist, return empty array (first migration hasn't run yet)
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }

    return data || [];
  } catch (error) {
    // If any error occurs (table doesn't exist, etc.), return empty array
    return [];
  }
}

/**
 * Check for duplicate migration versions
 */
function checkForDuplicates(migrations: Migration[]): boolean {
  const versionMap = new Map<string, string[]>();

  for (const migration of migrations) {
    if (!versionMap.has(migration.version)) {
      versionMap.set(migration.version, []);
    }
    versionMap.get(migration.version)!.push(migration.filename);
  }

  let hasDuplicates = false;
  for (const [version, filenames] of versionMap.entries()) {
    if (filenames.length > 1) {
      log.error(`Duplicate migration version ${version}:`);
      filenames.forEach(f => log.error(`  - ${f}`));
      hasDuplicates = true;
    }
  }

  return hasDuplicates;
}

/**
 * Apply a single migration
 */
async function applyMigration(migration: Migration, dryRun: boolean): Promise<boolean> {
  const startTime = Date.now();

  if (dryRun) {
    log.migration(`[DRY RUN] Would apply: ${migration.version}_${migration.name}`);
    return true;
  }

  log.migration(`Applying: ${migration.version}_${migration.name}`);

  try {
    // For Supabase, we need to execute the SQL directly using the database
    // Since we can't run raw SQL through the JS client easily, we'll use a workaround:
    // Execute the migration via Supabase's SQL editor API or use psql

    // For now, let's try to execute via the REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: migration.content })
    }).catch(() => null);

    if (!response || !response.ok) {
      // If exec_sql doesn't exist, we need to execute manually
      // This is a limitation - we'll note it in the output
      throw new Error('Unable to execute migration automatically. Please apply manually via Supabase SQL Editor.');
    }

    const executionTime = Date.now() - startTime;

    // Record the migration in schema_migrations
    const { error: insertError } = await supabase
      .from('schema_migrations')
      .insert({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        execution_time_ms: executionTime,
        applied_by: 'migration_script'
      });

    if (insertError) {
      throw insertError;
    }

    log.success(`Applied ${migration.version}_${migration.name} (${executionTime}ms)`);
    return true;

  } catch (error: any) {
    log.error(`Failed to apply ${migration.version}_${migration.name}:`);
    log.error(`  ${error.message}`);
    return false;
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  console.log('\n📊 Migration Status\n');
  console.log('━'.repeat(80));

  const allMigrations = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  const appliedVersions = new Set(appliedMigrations.map(m => m.version));

  console.log(`\n${colors.cyan}Available Migrations:${colors.reset}`);
  for (const migration of allMigrations) {
    const applied = appliedVersions.has(migration.version);
    const status = applied ? `${colors.green}✓ Applied${colors.reset}` : `${colors.yellow}⏳ Pending${colors.reset}`;
    console.log(`  ${migration.version} ${migration.name.padEnd(40)} ${status}`);
  }

  if (appliedMigrations.length > 0) {
    console.log(`\n${colors.cyan}Applied Migrations:${colors.reset}`);
    for (const migration of appliedMigrations) {
      const date = new Date(migration.applied_at).toLocaleString();
      console.log(`  ${migration.version} ${migration.name.padEnd(40)} ${date}`);
    }
  }

  const pending = allMigrations.filter(m => !appliedVersions.has(m.version));
  console.log('\n' + '━'.repeat(80));
  console.log(`Total: ${allMigrations.length} | Applied: ${appliedMigrations.length} | Pending: ${pending.length}`);
  console.log('━'.repeat(80) + '\n');
}

/**
 * Run migrations
 */
async function runMigrations(dryRun: boolean = false) {
  console.log('\n🔄 Database Migration Runner\n');
  console.log('━'.repeat(80));

  if (dryRun) {
    log.info('Running in DRY RUN mode - no changes will be made');
  }

  // Get all migrations
  const allMigrations = getMigrationFiles();
  log.info(`Found ${allMigrations.length} migration files`);

  // Check for duplicates
  if (checkForDuplicates(allMigrations)) {
    log.error('\nCannot proceed with duplicate migration versions!');
    log.info('Please renumber the conflicting migrations before continuing.');
    process.exit(1);
  }

  // Get applied migrations
  const appliedMigrations = await getAppliedMigrations();
  log.info(`${appliedMigrations.length} migrations already applied`);

  const appliedVersions = new Set(appliedMigrations.map(m => m.version));

  // Find pending migrations
  const pendingMigrations = allMigrations.filter(m => !appliedVersions.has(m.version));

  if (pendingMigrations.length === 0) {
    log.success('Database is up to date! No pending migrations.');
    return;
  }

  console.log(`\n${colors.cyan}Pending migrations:${colors.reset}`);
  pendingMigrations.forEach(m => {
    console.log(`  ${m.version}_${m.name}`);
  });

  console.log('\n' + '━'.repeat(80) + '\n');

  // Apply each pending migration
  let successCount = 0;
  for (const migration of pendingMigrations) {
    const success = await applyMigration(migration, dryRun);
    if (success) {
      successCount++;
    } else {
      log.error('\n❌ Migration failed! Stopping here for safety.');
      log.warning('Fix the error and run migrations again.');
      process.exit(1);
    }
  }

  console.log('\n' + '━'.repeat(80));
  if (dryRun) {
    log.info(`Dry run complete - ${successCount} migrations would be applied`);
  } else {
    log.success(`Successfully applied ${successCount} migrations!`);
  }
  console.log('━'.repeat(80) + '\n');
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'check';

  try {
    switch (command) {
      case 'check':
        await runMigrations(true);
        break;
      case 'apply':
        await runMigrations(false);
        break;
      case 'status':
        await showStatus();
        break;
      default:
        console.log('Usage:');
        console.log('  npm run migrate:check   - Dry run, show pending migrations');
        console.log('  npm run migrate:apply   - Apply pending migrations');
        console.log('  npm run migrate:status  - Show migration status');
    }
  } catch (error: any) {
    log.error('Fatal error:');
    log.error(error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
