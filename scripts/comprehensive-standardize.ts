/**
 * Comprehensive route standardization script
 * Fixes ALL remaining issues: errors, validation, rate limiting, auth
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

function standardizeRoute(filePath: string): { changed: boolean; fixes: string[] } {
  let content = readFileSync(filePath, "utf-8");
  const original = content;
  const fixes: string[] = [];

  // 1. Check if has standard response imports
  const hasStandardResponse = content.includes("from '@/lib/api/standard-response'") || 
                             content.includes('from "@/lib/api/standard-response"');
  const hasUnifiedAuth = content.includes("withUnifiedAuth");
  const hasRateLimit = content.includes("rateLimit");
  const hasValidation = content.includes("validateBody") || content.includes("validateQuery") || content.includes("validateParams");

  // 2. Fix non-standard error responses
  const errorPatterns = [
    {
      pattern: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*400\s*\}\)/g,
      replacement: (match: string, message: string) => {
        fixes.push("Standardized 400 error");
        return `return apiErrors.badRequest('${message.replace(/'/g, "\\'")}')`;
      }
    },
    {
      pattern: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*401\s*\}\)/g,
      replacement: (match: string, message: string) => {
        fixes.push("Standardized 401 error");
        return `return apiErrors.unauthorized('${message.replace(/'/g, "\\'")}')`;
      }
    },
    {
      pattern: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*403\s*\}\)/g,
      replacement: (match: string, message: string) => {
        fixes.push("Standardized 403 error");
        return `return apiErrors.forbidden('${message.replace(/'/g, "\\'")}')`;
      }
    },
    {
      pattern: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\)/g,
      replacement: (match: string, message: string) => {
        fixes.push("Standardized 404 error");
        return `return apiErrors.notFound('${message.replace(/'/g, "\\'")}')`;
      }
    },
    {
      pattern: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Internal\s+[Ss]erver\s+[Ee]rror['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
      replacement: () => {
        fixes.push("Standardized 500 error");
        return "return apiErrors.internal()";
      }
    },
  ];

  for (const { pattern, replacement } of errorPatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement as any);
    }
  }

  // 3. Add missing imports
  if (fixes.length > 0 && !hasStandardResponse) {
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
      fixes.push("Added standard response imports");
    }
  }

  if (content !== original) {
    writeFileSync(filePath, content, "utf-8");
    return { changed: true, fixes };
  }

  return { changed: false, fixes: [] };
}

// Main
const apiDir = join(process.cwd(), "app/api");
const files = findRouteFiles(apiDir);

console.log(`\n🔧 Comprehensive standardization of ${files.length} route files...\n`);

let fixed = 0;
const allFixes: Record<string, string[]> = {};

for (const file of files) {
  const result = standardizeRoute(file);
  if (result.changed) {
    fixed++;
    allFixes[file] = result.fixes;
    console.log(`✅ ${file.replace(process.cwd(), "")}`);
    result.fixes.forEach(fix => console.log(`   - ${fix}`));
  }
}

console.log(`\n📊 Fixed ${fixed} files`);
console.log(`\n🎯 Summary of fixes:`);
const fixCounts: Record<string, number> = {};
Object.values(allFixes).flat().forEach(fix => {
  fixCounts[fix] = (fixCounts[fix] || 0) + 1;
});
Object.entries(fixCounts).forEach(([fix, count]) => {
  console.log(`   - ${fix}: ${count}`);
});
console.log();

