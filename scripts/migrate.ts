#!/usr/bin/env tsx
/**
 * Database Migration Runner
 * Manages Supabase database migrations
 */

import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { logger } from "@/lib/logger";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface Migration {
  filename: string;
  timestamp: string;
  description: string;
  sql: string;
}

async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = join(process.cwd(), "supabase", "migrations");
  const files = await readdir(migrationsDir);

  const migrations: Migration[] = [];

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;

    const sql = await readFile(join(migrationsDir, file), "utf-8");
    const match = file.match(/^(\d{14})_(.+)\.sql$/);

    if (match) {
      migrations.push({
        filename: file,
        timestamp: match[1],
        description: match[2],
        sql,
      });
    }
  }

  return migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function ensureMigrationsTable(supabase: ReturnType<typeof createClient>) {
  // Try to create migrations table if it doesn't exist
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      timestamp VARCHAR(14) NOT NULL,
      description TEXT,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  // Use raw SQL execution if rpc is not available
  try {
    const { error } = await (supabase as any).rpc("exec_sql", { sql: createTableSQL });
    if (error) {
      logger.error("Failed to create migrations table", { error });
      throw error;
    }
  } catch (err) {
    // If exec_sql doesn't exist, the table might already exist or we need to create it manually
    logger.warn("Could not execute exec_sql, table may need to be created manually");
  }
}

async function getExecutedMigrations(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  try {
    const { data, error } = await (supabase as any).from("migrations").select("filename");

    if (error) {
      logger.error("Failed to fetch executed migrations", { error });
      return [];
    }

    return (data as Array<{ filename: string }>)?.map((m) => m.filename) || [];
  } catch {
    return [];
  }
}

async function markMigrationExecuted(
  supabase: ReturnType<typeof createClient>,
  migration: Migration
) {
  const { error } = await (supabase as any).from("migrations").insert({
    filename: migration.filename,
    timestamp: migration.timestamp,
    description: migration.description,
  });

  if (error) {
    logger.error("Failed to mark migration as executed", { error, migration: migration.filename });
    throw error;
  }
}

async function runMigration(supabase: ReturnType<typeof createClient>, migration: Migration) {
  logger.info("Running migration", {
    filename: migration.filename,
    description: migration.description,
  });

  try {
    const { error } = await (supabase as any).rpc("exec_sql", { sql: migration.sql });

    if (error) {
      logger.error("Migration failed", { filename: migration.filename, error });
      throw error;
    }
  } catch (err) {
    logger.error("Migration execution error", { filename: migration.filename, error: err });
    throw err;
  }

  await markMigrationExecuted(supabase, migration);
  logger.info("Migration completed", { filename: migration.filename });
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as any;

  try {
    await ensureMigrationsTable(supabase);

    const migrations = await loadMigrations();
    const executed = await getExecutedMigrations(supabase);

    const pending = migrations.filter((m) => !executed.includes(m.filename));

    if (pending.length === 0) {
      return;
    }


    for (const migration of pending) {
      await runMigration(supabase, migration);
    }

  } catch (error) {
    logger.error("Migration process failed", { error });
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
