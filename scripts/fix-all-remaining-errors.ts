/**
 * Fix ALL remaining non-standard error responses
 * This will comprehensively fix all 71 remaining errors across 26 files
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
    } else if (entry.name === "route.ts" || entry.name === "table-action-handlers.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

function standardizeErrors(
  content: string,
  filePath: string
): { content: string; fixes: string[] } {
  const fixes: string[] = [];
  let newContent = content;

  // Check if already has standard response imports
  const hasStandardResponse =
    content.includes("from '@/lib/api/standard-response'") ||
    content.includes('from "@/lib/api/standard-response"');

  // Pattern 1: Simple error with status 400
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*400\s*\}\)/g,
    (match, message) => {
      fixes.push(`400: ${message}`);
      return `return apiErrors.badRequest('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 2: Simple error with status 401
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*401\s*\}\)/g,
    (match, message) => {
      fixes.push(`401: ${message}`);
      return `return apiErrors.unauthorized('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 3: Simple error with status 403
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*403\s*\}\)/g,
    (match, message) => {
      fixes.push(`403: ${message}`);
      return `return apiErrors.forbidden('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 4: Simple error with status 404
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*404\s*\}\)/g,
    (match, message) => {
      fixes.push(`404: ${message}`);
      return `return apiErrors.notFound('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 5: Simple error with status 500
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
    (match, message) => {
      fixes.push(`500: ${message}`);
      return `return apiErrors.internal('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 6: Error with ok: false
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*ok:\s*false\s*,\s*error:\s*['"]([^'"]+)['"]\s*\}\s*,\s*\{\s*status:\s*(\d+)\s*\}\)/g,
    (match, message, status) => {
      const statusNum = parseInt(status, 10);
      fixes.push(`${statusNum}: ${message}`);
      if (statusNum === 400)
        return `return apiErrors.badRequest('${message.replace(/'/g, "\\'")}')`;
      if (statusNum === 401)
        return `return apiErrors.unauthorized('${message.replace(/'/g, "\\'")}')`;
      if (statusNum === 403) return `return apiErrors.forbidden('${message.replace(/'/g, "\\'")}')`;
      if (statusNum === 404) return `return apiErrors.notFound('${message.replace(/'/g, "\\'")}')`;
      return `return apiErrors.internal('${message.replace(/'/g, "\\'")}')`;
    }
  );

  // Pattern 7: Internal Server Error variations
  newContent = newContent.replace(
    /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Internal\s+[Ss]erver\s+[Ee]rror['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\)/g,
    () => {
      fixes.push("500: Internal server error");
      return "return apiErrors.internal()";
    }
  );

  // Add import if needed
  if (fixes.length > 0 && !hasStandardResponse) {
    const lines = newContent.split("\n");
    let lastImportIndex = -1;
    let foundNextServerImport = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        lastImportIndex = i;
        if (lines[i].includes("next/server")) {
          foundNextServerImport = true;
        }
      }
    }

    if (lastImportIndex >= 0) {
      // Add apiErrors import
      const importLine = "import { apiErrors } from '@/lib/api/standard-response';";

      // If NextResponse is imported from next/server, add after it
      if (foundNextServerImport) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("next/server")) {
            lines.splice(i + 1, 0, importLine);
            break;
          }
        }
      } else {
        lines.splice(lastImportIndex + 1, 0, importLine);
      }
      newContent = lines.join("\n");
    }
  }

  return { content: newContent, fixes };
}

// Main
const apiDir = join(process.cwd(), "app/api");
const files = findRouteFiles(apiDir);

console.log(`\n🔧 Fixing ALL remaining non-standard errors in ${files.length} files...\n`);

let fixed = 0;
const allFixes: Record<string, string[]> = {};

for (const file of files) {
  const content = readFileSync(file, "utf-8");
  const result = standardizeErrors(content, file);

  if (result.fixes.length > 0) {
    writeFileSync(file, result.content, "utf-8");
    fixed++;
    allFixes[file.replace(process.cwd(), "")] = result.fixes;
    console.log(`✅ ${file.replace(process.cwd(), "")} (${result.fixes.length} fixes)`);
  }
}

console.log(
  `\n📊 Fixed ${fixed} files with ${Object.values(allFixes).flat().length} error responses\n`
);
