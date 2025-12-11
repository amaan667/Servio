/**
 * Bulk fix process.env usage in API routes
 * This script directly replaces process.env with env() calls
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.includes("node_modules") &&
      !entry.name.includes(".next")
    ) {
      files.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function fixFile(filePath: string): boolean {
  let content = readFileSync(filePath, "utf-8");
  const original = content;
  let changed = false;

  // Replace process.env.NODE_ENV patterns
  content = content.replace(
    /process\.env\.NODE_ENV\s*===\s*["']development["']/g,
    "isDevelopment()"
  );
  content = content.replace(/process\.env\.NODE_ENV\s*===\s*["']production["']/g, "isProduction()");
  content = content.replace(
    /process\.env\.NODE_ENV\s*!==\s*["']development["']/g,
    "!isDevelopment()"
  );
  content = content.replace(
    /process\.env\.NODE_ENV\s*!==\s*["']production["']/g,
    "!isProduction()"
  );

  // Replace other common process.env patterns
  const replacements: Array<[RegExp, string]> = [
    [/process\.env\.NEXT_PUBLIC_SUPABASE_URL/g, "env('NEXT_PUBLIC_SUPABASE_URL')"],
    [/process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/g, "env('NEXT_PUBLIC_SUPABASE_ANON_KEY')"],
    [/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g, "env('SUPABASE_SERVICE_ROLE_KEY')"],
    [/process\.env\.OPENAI_API_KEY/g, "env('OPENAI_API_KEY')"],
    [/process\.env\.STRIPE_SECRET_KEY/g, "env('STRIPE_SECRET_KEY')"],
    [/process\.env\.STRIPE_WEBHOOK_SECRET/g, "env('STRIPE_WEBHOOK_SECRET')"],
    [/process\.env\.REDIS_URL/g, "env('REDIS_URL')"],
    [/process\.env\.DATABASE_URL/g, "env('DATABASE_URL')"],
    [/process\.env\.NEXT_PUBLIC_APP_URL/g, "env('NEXT_PUBLIC_APP_URL')"],
    [/process\.env\.APP_URL/g, "env('APP_URL')"],
    [/process\.env\.SENTRY_DSN/g, "env('SENTRY_DSN')"],
    [/process\.env\.CRON_SECRET/g, "env('CRON_SECRET')"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }

  // Add import if needed
  const needsImport =
    content.includes("env(") ||
    content.includes("isDevelopment()") ||
    content.includes("isProduction()") ||
    content.includes("getNodeEnv()");
  const hasImport = content.includes("from '@/lib/env'") || content.includes('from "@/lib/env"');

  if (needsImport && !hasImport) {
    // Find last import
    const lines = content.split("\n");
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      const importLine =
        "import { env, isDevelopment, isProduction, getNodeEnv } from '@/lib/env';";
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join("\n");
      changed = true;
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  return false;
}

// Main
const apiDir = join(process.cwd(), "app/api");
const files = findRouteFiles(apiDir);

console.log(`\n🔧 Fixing process.env usage in ${files.length} route files...\n`);

let fixed = 0;
for (const file of files) {
  if (fixFile(file)) {
    fixed++;
    console.log(`✅ ${file.replace(process.cwd(), "")}`);
  }
}

console.log(`\n📊 Fixed ${fixed} files\n`);
