/**
 * Automated Database Migration Runner
 * Runs pending Supabase migrations automatically on deployment
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { logger } from "@/lib/logger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable() {
  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW(),
        checksum TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON _migrations(name);
    `,
  });

  if (error) {
    logger.error("❌ Failed to create migrations table:", error);
    throw error;
  }

  logger.debug("✅ Migrations table ready");
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  const { data, error } = await supabase.from("_migrations").select("name").order("name");

  if (error) {
    logger.error("❌ Failed to get applied migrations:", error);
    return [];
  }

  return (data || []).map((row) => row.name);
}

/**
 * Get pending migrations from filesystem
 */
async function getPendingMigrations(applied: string[]): Promise<string[]> {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");

  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const allMigrations = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const pending = allMigrations.filter((file) => !applied.includes(file));

  return pending;
}

/**
 * Execute a single migration
 */
async function executeMigration(filename: string): Promise<boolean> {
  const migrationsDir = path.join(process.cwd(), "supabase/migrations");
  const filepath = path.join(migrationsDir, filename);

  try {
    const sql = fs.readFileSync(filepath, "utf-8");

    // Execute SQL
    const { error } = await supabase.rpc("exec_sql", { sql });

    if (error) {
      logger.error(`❌ Migration failed: ${filename}`, error);
      return false;
    }

    // Record migration as applied
    const { error: recordError } = await supabase.from("_migrations").insert({
      name: filename,
      checksum: generateChecksum(sql),
    });

    if (recordError) {
      logger.error(`❌ Failed to record migration: ${filename}`, recordError);
      return false;
    }

    logger.debug({ data: `✅ Migration successful: ${filename}` });
    return true;
  } catch (error) {
    logger.error(`❌ Migration error: ${filename}`, error);
    return false;
  }
}

/**
 * Generate checksum for migration file
 */
function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Main migration runner
 */
async function runMigrations() {
  try {
    // Step 1: Ensure migrations table exists
    await ensureMigrationsTable();

    // Step 2: Get applied migrations
    const applied = await getAppliedMigrations();

    // Step 3: Get pending migrations
    const pending = await getPendingMigrations(applied);

    if (pending.length === 0) {
      return;
    }

    logger.debug({ data: `Pending migrations: ${pending.join(", ")}` });

    // Step 4: Execute pending migrations
    let successCount = 0;
    let failCount = 0;

    for (const migration of pending) {
      const success = await executeMigration(migration);

      if (success) {
        successCount++;
      } else {
        failCount++;
        // Stop on first failure to prevent cascading issues
        logger.error("\n❌ Migration failed - stopping execution");
        break;
      }
    }

    // Step 5: Summary
    logger.debug("📊 Migration Summary:");
    logger.debug({ data: `  ✅ Successful: ${successCount}` });
    logger.debug({ data: `  ❌ Failed: ${failCount}` });

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error("\n❌ Migration runner failed:", error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();
