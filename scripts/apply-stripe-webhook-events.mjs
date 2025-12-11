// NOTE: Utility script for manual use if needed.
// Prod/pilot migration for stripe_webhook_events has already been applied manually.
// Not used in normal deploy flows.

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_MIGRATION = "20251210000100_add_stripe_webhook_events.sql";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSupabase() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey);
}

async function ensureMigrationsTable(supabase) {
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
    console.error("Failed to ensure _migrations table", error);
    process.exit(2);
  }
}

async function migrationApplied(supabase) {
  const { data, error } = await supabase
    .from("_migrations")
    .select("name")
    .eq("name", REQUIRED_MIGRATION)
    .limit(1);
  if (error) {
    console.error("Failed to query _migrations", error);
    process.exit(3);
  }
  return (data ?? []).length > 0;
}

async function applyMigration(supabase) {
  const migrationsDir = path.join(__dirname, "../supabase/migrations");
  const filepath = path.join(migrationsDir, REQUIRED_MIGRATION);
  const sql = readFileSync(filepath, "utf-8");

  const { error } = await supabase.rpc("exec_sql", { sql });
  if (error) {
    console.error(`Migration failed: ${REQUIRED_MIGRATION}`, error);
    process.exit(4);
  }

  const { error: recordError } = await supabase.from("_migrations").insert({
    name: REQUIRED_MIGRATION,
    checksum: null,
  });
  if (recordError) {
    console.error("Failed to record migration", recordError);
    process.exit(5);
  }
}

async function verifyTable(supabase) {
  const { error } = await supabase.from("stripe_webhook_events").select("id").limit(1);
  if (error) {
    console.error("stripe_webhook_events table verification failed", error);
    process.exit(6);
  }
}

async function main() {
  const supabase = getSupabase();
  await ensureMigrationsTable(supabase);

  const already = await migrationApplied(supabase);
  if (already) {
    console.log(`Migration already applied: ${REQUIRED_MIGRATION}`);
    await verifyTable(supabase);
    console.log("stripe_webhook_events table verified.");
    return;
  }

  console.log(`Applying migration: ${REQUIRED_MIGRATION}`);
  await applyMigration(supabase);
  await verifyTable(supabase);
  console.log("Migration applied and table verified.");
}

main().catch((err) => {
  console.error("Migration script failed", err);
  process.exit(1);
});
