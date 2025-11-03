#!/usr/bin/env tsx
/**
 * Create Database Migration
 * Generates a new migration file with timestamp
 */

import { writeFile } from "fs/promises";
import { join } from "path";

const args = process.argv.slice(2);
const description = args[0] || "migration";

if (!description) {
  console.error("Usage: pnpm create-migration <description>");
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "");
const filename = `${timestamp}_${description.replace(/\s+/g, "-").toLowerCase()}.sql`;
const filepath = join(process.cwd(), "supabase", "migrations", filename);

const template = `-- Migration: ${description}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

`;

async function createMigration() {
  await writeFile(filepath, template);
}

createMigration().catch(console.error);
