import { createClient } from "@supabase/supabase-js";

const REQUIRED_MIGRATION = "20251210000100_add_stripe_webhook_events.sql";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    
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
    
    process.exit(1);
  }

  if (!migrations) {
    
    process.exit(2);
  }

  
}

async function assertTableExists() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, serviceKey);

  const { error } = await supabase.from("stripe_webhook_events").select("id").limit(1);

  if (error) {
    
    process.exit(3);
  }

  
}

async function main() {
  await assertMigrationApplied();
  await assertTableExists();

  
}

main().catch((error) => {
  
  process.exit(1);
