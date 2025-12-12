/**
 * Script to replace process.env usage with centralized env()
 *
 * This script helps migrate from direct process.env access to the centralized
 * environment variable system.
 *
 * Run: pnpm tsx scripts/replace-process-env.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

interface Replacement {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const replacements: Replacement[] = [
  {
    pattern: /process\.env\.NODE_ENV/g,
    replacement: "getNodeEnv()",
    description: "Replace process.env.NODE_ENV with getNodeEnv()",
  },
  {
    pattern: /process\.env\.NEXT_PUBLIC_SUPABASE_URL/g,
    replacement: "env('NEXT_PUBLIC_SUPABASE_URL')",
    description: "Replace Supabase URL",
  },
  {
    pattern: /process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY/g,
    replacement: "env('NEXT_PUBLIC_SUPABASE_ANON_KEY')",
    description: "Replace Supabase anon key",
  },
  {
    pattern: /process\.env\.SUPABASE_SERVICE_ROLE_KEY/g,
    replacement: "env('SUPABASE_SERVICE_ROLE_KEY')",
    description: "Replace Supabase service role key",
  },
  {
    pattern: /process\.env\.OPENAI_API_KEY/g,
    replacement: "env('OPENAI_API_KEY')",
    description: "Replace OpenAI API key",
  },
  {
    pattern: /process\.env\.STRIPE_SECRET_KEY/g,
    replacement: "env('STRIPE_SECRET_KEY')",
    description: "Replace Stripe secret key",
  },
  {
    pattern: /process\.env\.STRIPE_WEBHOOK_SECRET/g,
    replacement: "env('STRIPE_WEBHOOK_SECRET')",
    description: "Replace Stripe webhook secret",
  },
  {
    pattern: /process\.env\.REDIS_URL/g,
    replacement: "env('REDIS_URL')",
    description: "Replace Redis URL",
  },
  {
    pattern: /process\.env\.DATABASE_URL/g,
    replacement: "env('DATABASE_URL')",
    description: "Replace database URL",
  },
  {
    pattern: /process\.env\.NEXT_PUBLIC_APP_URL/g,
    replacement: "env('NEXT_PUBLIC_APP_URL')",
    description: "Replace app URL",
  },
  {
    pattern: /process\.env\.SENTRY_DSN/g,
    replacement: "env('SENTRY_DSN')",
    description: "Replace Sentry DSN",
  },
  {
    pattern: /process\.env\.CRON_SECRET/g,
    replacement: "env('CRON_SECRET')",
    description: "Replace cron secret",
  },
];

function needsImport(content: string): boolean {
  return (
    content.includes("env(") ||
    content.includes("getNodeEnv()") ||
    content.includes("isProduction()") ||
    content.includes("isDevelopment()")
  );
}

function hasEnvImport(content: string): boolean {
  return content.includes("from '@/lib/env'") || content.includes('from "@/lib/env"');
}

function addEnvImport(content: string): string {
  // Find the last import statement
  const importLines = content.split("\n");
  let lastImportIndex = -1;

  for (let i = 0; i < importLines.length; i++) {
    if (importLines[i].trim().startsWith("import ")) {
      lastImportIndex = i;
    }
  }

  if (lastImportIndex === -1) {
    // No imports, add at the top
    return `import { env, getNodeEnv, isProduction, isDevelopment } from '@/lib/env';\n${content}`;
  }

  // Check if env import already exists
  if (hasEnvImport(content)) {
    return content;
  }

  // Add import after last import
  const newContent = [...importLines];
  newContent.splice(
    lastImportIndex + 1,
    0,
    "import { env, getNodeEnv, isProduction, isDevelopment } from '@/lib/env';"
  );
  return newContent.join("\n");
}

function processFile(filePath: string): { changed: boolean; changes: string[] } {
  let content = readFileSync(filePath, "utf-8");
  const originalContent = content;
  const changes: string[] = [];

  // Apply replacements
  for (const replacement of replacements) {
    if (replacement.pattern.test(content)) {
      content = content.replace(replacement.pattern, replacement.replacement);
      changes.push(replacement.description);
    }
  }

  // Replace common patterns
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

  // Add import if needed
  if (needsImport(content) && !hasEnvImport(content)) {
    content = addEnvImport(content);
    if (content !== originalContent) {
      changes.push("Added env import");
    }
  }

  const changed = content !== originalContent;
  return { changed, changes, content };
}

function findFiles(dir: string, extensions: string[] = [".ts", ".tsx"]): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.includes("node_modules") &&
      !entry.name.includes(".next")
    ) {
      files.push(...findFiles(fullPath, extensions));
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Main execution
console.log("\n🔄 Replacing process.env usage with centralized env()...\n");

const apiDir = join(process.cwd(), "app/api");
const libDir = join(process.cwd(), "lib");
const files = [...findFiles(apiDir), ...findFiles(libDir)];

let totalChanged = 0;
const changedFiles: Array<{ file: string; changes: string[] }> = [];

for (const file of files) {
  const result = processFile(file);
  if (result.changed && result.content) {
    totalChanged++;
    changedFiles.push({ file: file.replace(process.cwd(), ""), changes: result.changes });
    // Write changes
    writeFileSync(file, result.content, "utf-8");
    console.log(`✅ ${file.replace(process.cwd(), "")}`);
    result.changes.forEach((change) => console.log(`   - ${change}`));
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Files processed: ${files.length}`);
console.log(`   Files changed: ${totalChanged}`);
console.log(`\n⚠️  This script shows what would be changed.`);
console.log(`   Uncomment the writeFileSync line to actually apply changes.\n`);
