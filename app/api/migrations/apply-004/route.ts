import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import { readFileSync } from "fs";
import { join } from "path";

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Read the migration file
    const migrationPath = join(process.cwd(), "migrations", "004_fix_dashboard_counts.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.info(`[MIGRATION 004] Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] ?? "";
      if (statement.length < 10) continue; // Skip very short statements

      console.info(`[MIGRATION 004] Executing statement ${i + 1}/${statements.length}`);

      const { error } = await supabase.rpc("exec_sql", {
        sql: statement + ";",
      });

      if (error) {
        console.error(`[MIGRATION 004] Error executing statement ${i + 1}:`, error);
        return NextResponse.json(
          {
            success: false,
            error: `Failed at statement ${i + 1}: ${error.message}`,
          },
          { status: 500 }
        );
      }
    }

    console.info("[MIGRATION 004] ✅ Migration completed successfully");

    return NextResponse.json({
      success: true,
      message: "Migration 004 applied successfully - Dashboard counts and table management fixed",
    });
  } catch (error) {
    console.error("[MIGRATION 004] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
