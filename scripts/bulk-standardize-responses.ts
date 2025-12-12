/**
 * Bulk standardize error responses across all routes
 * Replaces NextResponse.json({ error: ... }) with apiErrors.*
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
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

function standardizeFile(filePath: string): boolean {
  let content = readFileSync(filePath, "utf-8");
  const original = content;
  let changed = false;

  // Check if already has standard response imports
  const hasStandardResponse =
    content.includes("from '@/lib/api/standard-response'") ||
    content.includes('from "@/lib/api/standard-response"');

  // Replace common error response patterns
  const errorPatterns: Array<[RegExp, string]> = [
    // Rate limit errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Too many requests['"],?\s*message:.*?\}\s*,\s*\{\s*status:\s*429\s*\}\)/gs,
      "return apiErrors.rateLimit(Math.ceil((rateLimitResult.reset - Date.now()) / 1000));",
    ],
    // 400 errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*400\s*\}\)/g,
      "return apiErrors.badRequest('$1');",
    ],
    // 401 errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*401\s*\}\)/g,
      "return apiErrors.unauthorized('$1');",
    ],
    // 403 errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*403\s*\}\)/g,
      "return apiErrors.forbidden('$1');",
    ],
    // 404 errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\)/g,
      "return apiErrors.notFound('$1');",
    ],
    // 500 errors
    [
      /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"],?\s*message:.*?\}\s*,\s*\{\s*status:\s*500\s*\}\)/gs,
      "return apiErrors.internal('$1');",
    ],
  ];

  for (const [pattern, replacement] of errorPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }

  // Replace success responses
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*ok:\s*true,?\s*([^}]+)\s*\}\s*,\s*\{\s*status:\s*200?\s*\}\)/g,
    "return success({ $1 });"
  );

  // Add import if needed
  if (changed && !hasStandardResponse) {
    const lines = content.split("\n");
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      const importLine =
        "import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';";
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join("\n");
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

console.log(`\n🔧 Standardizing responses in ${files.length} route files...\n`);

let fixed = 0;
for (const file of files) {
  if (standardizeFile(file)) {
    fixed++;
    console.log(`✅ ${file.replace(process.cwd(), "")}`);
  }
}

console.log(`\n📊 Fixed ${fixed} files\n`);
