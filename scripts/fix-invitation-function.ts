#!/usr/bin/env tsx
/**
 * Fix the get_invitation_by_token function
 * This script creates/updates the database function to properly handle invited_by_email
 */

import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing Supabase credentials");
    console.error("Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });


  const migrationPath = join(
    process.cwd(),
    "supabase",
    "migrations",
    "20251029000000_create_get_invitation_function.sql"
  );

  const sql = await readFile(migrationPath, "utf-8");


  try {
    // Try to execute using rpc if available
    const { error } = await (supabase as any).rpc("exec_sql", { sql });

    if (error) {
      console.error("❌ Failed to execute via rpc:", error);
      process.exit(1);
    }

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
