/**
 * Automated Database Migration Runner (DATABASE_URL)
 *
 * Runs SQL migrations from `supabase/migrations/*.sql` directly against Postgres.
 * This removes any reliance on Supabase Dashboard manual migration steps or custom RPCs.
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import crypto from "crypto";
import { Client } from "pg";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const MIGRATIONS_LOCK_KEY = "servio_migrations_lock_v1";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to run migrations");
  }
  return url;
}

function checksumSql(sql: string): string {
  return crypto.createHash("sha256").update(sql, "utf8").digest("hex");
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((f) => f.endsWith(".sql")).sort();
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  const res = await client.query<{ name: string }>(
    "SELECT name FROM _migrations ORDER BY name ASC;"
  );
  return new Set(res.rows.map((r) => r.name));
}

async function acquireMigrationLock(client: Client): Promise<void> {
  // Prevent concurrent deploys from racing migrations.
  await client.query("SELECT pg_advisory_lock(hashtext($1));", [MIGRATIONS_LOCK_KEY]);
}

async function releaseMigrationLock(client: Client): Promise<void> {
  await client.query("SELECT pg_advisory_unlock(hashtext($1));", [MIGRATIONS_LOCK_KEY]);
}

async function runSingleMigration(client: Client, filename: string): Promise<void> {
  const filepath = join(MIGRATIONS_DIR, filename);
  const sql = await readFile(filepath, "utf8");
  const checksum = checksumSql(sql);

  await client.query("BEGIN;");
  try {
    await client.query(sql);
    await client.query("INSERT INTO _migrations(name, checksum) VALUES($1, $2);", [
      filename,
      checksum,
    ]);
    await client.query("COMMIT;");

  } catch (error) {
    await client.query("ROLLBACK;");
    throw error;
  }
}

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await acquireMigrationLock(client);
    try {
      await ensureMigrationsTable(client);

      const all = await listMigrationFiles();
      const applied = await getAppliedMigrations(client);
      const pending = all.filter((f) => !applied.has(f));

      if (pending.length === 0) {

        return;
      }

      for (const filename of pending) {
        await runSingleMigration(client, filename);
      }

    } finally {
      await releaseMigrationLock(client);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {

  process.exit(1);
});
