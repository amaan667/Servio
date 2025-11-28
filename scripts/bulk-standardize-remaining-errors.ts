/**
 * Bulk standardize ALL remaining error responses
 * This will systematically replace NextResponse.json({ error: ... }) with apiErrors helpers
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

function findRouteFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.includes("node_modules") && !entry.name.includes(".next")) {
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
  const hasStandardResponse = content.includes("from '@/lib/api/standard-response'") || 
                             content.includes('from "@/lib/api/standard-response"');

  // Replace 400 errors
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*400\s*\}\)/g,
    (match, message) => {
      changed = true;
      return `return apiErrors.badRequest('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace 401 errors
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*401\s*\}\)/g,
    (match, message) => {
      changed = true;
      return `return apiErrors.unauthorized('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace 403 errors
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*403\s*\}\)/g,
    (match, message) => {
      changed = true;
      return `return apiErrors.forbidden('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace 404 errors
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\)/g,
    (match, message) => {
      changed = true;
      return `return apiErrors.notFound('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace 500 errors - simple pattern first
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
    (match, message) => {
      changed = true;
      return `return apiErrors.internal('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace 500 errors with message field
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"],?\s*message:.*?\}\s*,\s*\{\s*status:\s*500\s*\}\)/gs,
    (match) => {
      changed = true;
      const messageMatch = match.match(/error:\s*['"]([^'"]+)['"]/);
      const message = messageMatch ? messageMatch[1] : "Internal Server Error";
      return `return apiErrors.internal('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Replace "Internal server error" and "Internal Server Error"
  content = content.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Internal\s+[Ss]erver\s+[Ee]rror['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
    () => {
      changed = true;
      return "return apiErrors.internal()";
    }
  );

  // Add import if needed
  if (changed && !hasStandardResponse) {
    const lines = content.split('\n');
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex >= 0) {
      const importLine = "import { success, apiErrors, isZodError, handleZodError } from '@/lib/api/standard-response';";
      lines.splice(lastImportIndex + 1, 0, importLine);
      content = lines.join('\n');
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

console.log(`\n🔧 Standardizing error responses in ${files.length} route files...\n`);

let fixed = 0;
for (const file of files) {
  if (standardizeFile(file)) {
    fixed++;
    console.log(`✅ ${file.replace(process.cwd(), "")}`);
  }
}

console.log(`\n📊 Fixed ${fixed} files\n`);

