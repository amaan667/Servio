#!/usr/bin/env tsx
/**
 * Create a new SQL migration file in `supabase/migrations`.
 *
 * Usage:
 *   pnpm migrate:create add_new_table
 */

import { writeFile } from "fs/promises";
import { join } from "path";

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
  ].join("");
}

function toSnakeCase(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]+/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

async function main() {
  const rawName = process.argv.slice(2).join(" ") || "new_migration";
  const name = toSnakeCase(rawName) || "new_migration";
  const ts = formatTimestamp(new Date());

  const dir = join(process.cwd(), "supabase", "migrations");
  const filename = `${ts}_${name}.sql`;
  const fullPath = join(dir, filename);

  const header = `-- Migration: ${filename}\n-- Created: ${new Date().toISOString()}\n\n`;
  await writeFile(fullPath, header, { encoding: "utf8", flag: "wx" });

  console.info(`Created migration: ${fullPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
