import { createClient } from "@supabase/supabase-js";
import { logger } from "../lib/logger/production-logger";

const REQUIRED_MIGRATION = "20251210000100_add_stripe_webhook_events.sql";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

async function assertMigrationApplied() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey);

  const { data: migrations, error: migrationsError } = await supabase
    .from("_migrations")
    .select("name, executed_at")
    .eq("name", REQUIRED_MIGRATION)
    .limit(1)
    .maybeSingle();

  if (migrationsError) {
    logger.error("Failed to query _migrations", migrationsError);
    process.exit(1);
  }

  if (!migrations) {
    logger.error(
      `Migration ${REQUIRED_MIGRATION} is NOT applied. Apply migrations before continuing.`
    );
    process.exit(2);
  }

  logger.info(`Migration present: ${REQUIRED_MIGRATION} @ ${migrations.executed_at ?? "unknown"}`);
}

async function assertTableExists() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey);

  const { error } = await supabase.from("stripe_webhook_events").select("id").limit(1);

  if (error) {
    logger.error("stripe_webhook_events table check failed", error);
    process.exit(3);
  }

  logger.info("stripe_webhook_events table is present and accessible.");
}

async function main() {
  await assertMigrationApplied();
  await assertTableExists();

  logger.info("stripe_webhook_events migration check passed.");
}

main().catch((error) => {
  logger.error("stripe_webhook_events migration check failed", error);
  process.exit(1);
});
