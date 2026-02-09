/**
 * CI Check: Verify that every table in the Database interface has RLS enabled
 * in version-controlled migration files.
 *
 * Fails with exit code 1 if any table is missing RLS.
 * Run: pnpm tsx scripts/check-rls-coverage.ts
 */

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const DATABASE_TYPES_FILE = path.join(ROOT, "types", "database.ts");

function getTablesFromDatabaseInterface(): string[] {
  const content = fs.readFileSync(DATABASE_TYPES_FILE, "utf-8");
  // Extract the Tables: { ... } block from the Database interface
  const tablesBlockMatch = content.match(
    /Tables:\s*\{([\s\S]*?)\};\s*Views:/
  );
  if (!tablesBlockMatch) {
    console.error("Could not find Tables block in Database interface");
    process.exit(1);
  }
  const tablesBlock = tablesBlockMatch[1];
  // Match table names: lines like `      table_name: {`
  const tableRegex = /^\s{4,}(\w+):\s*\{/gm;
  const tables: string[] = [];
  let match;
  while ((match = tableRegex.exec(tablesBlock)) !== null) {
    // Skip nested keys like Row, Insert, Update
    if (["Row", "Insert", "Update"].includes(match[1])) continue;
    tables.push(match[1]);
  }
  return [...new Set(tables)];
}

function getTablesWithRLSInMigrations(): Set<string> {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const rlsTables = new Set<string>();
  const rlsPattern =
    /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;

  for (const file of migrationFiles) {
    const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    let match;
    while ((match = rlsPattern.exec(content)) !== null) {
      rlsTables.add(match[1]);
    }
  }

  return rlsTables;
}

function main() {
  console.log("🔒 Checking RLS coverage for all database tables...\n");

  const interfaceTables = getTablesFromDatabaseInterface();
  const rlsTables = getTablesWithRLSInMigrations();

  console.log(
    `Tables in Database interface: ${interfaceTables.length}`
  );
  console.log(
    `Tables with RLS in migrations: ${rlsTables.size}`
  );
  console.log();

  const missing: string[] = [];
  const covered: string[] = [];

  for (const table of interfaceTables) {
    if (rlsTables.has(table)) {
      covered.push(table);
    } else {
      missing.push(table);
    }
  }

  // Also report tables with RLS that aren't in the interface (migration-only tables)
  const extraRLS = [...rlsTables].filter(
    (t) => !interfaceTables.includes(t)
  );

  for (const table of covered) {
    console.log(`  ✅ ${table}`);
  }

  for (const table of missing) {
    console.log(`  ❌ ${table} — MISSING RLS in migrations`);
  }

  if (extraRLS.length > 0) {
    console.log(`\nAdditional tables with RLS (not in Database interface):`);
    for (const table of extraRLS) {
      console.log(`  ✅ ${table} (migration-only)`);
    }
  }

  console.log();
  console.log(
    `Coverage: ${covered.length}/${interfaceTables.length} tables have RLS`
  );

  if (missing.length > 0) {
    console.error(
      `\n❌ FAILED: ${missing.length} table(s) missing RLS. Add migrations before merging.`
    );
    process.exit(1);
  }

  console.log("\n✅ PASSED: All tables have RLS enabled in migrations.");
  process.exit(0);
}

main();
