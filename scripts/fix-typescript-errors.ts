/**
 * Script to fix common TypeScript errors in API routes
 * - Adds missing NextRequest imports
 * - Fixes function signatures
 * - Replaces createClient with createAdminClient where needed
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import path from "path";

const API_ROUTES_DIR = path.join(process.cwd(), "app/api");

async function fixFile(filePath: string): Promise<boolean> {
  let content = readFileSync(filePath, "utf-8");
  let modified = false;

  // Pattern 1: Add NextRequest import if missing and function uses req
  if (
    content.includes("req.url") ||
    content.includes("req.clone()") ||
    content.includes("rateLimit(req")
  ) {
    if (!content.includes("import") || !content.includes("NextRequest")) {
      // Find the first import line
      const importMatch = content.match(/^import .* from/m);
      if (importMatch) {
        const importIndex = content.indexOf(importMatch[0]);
        const nextLineIndex = content.indexOf("\n", importIndex);
        if (!content.substring(0, nextLineIndex).includes("NextRequest")) {
          // Add NextRequest to existing import or add new import
          if (content.includes('from "next/server"')) {
            content = content.replace(
              /from ["']next\/server["']/,
              'from "next/server";\nimport type { NextRequest } from "next/server"'
            );
            modified = true;
          } else {
            // Add new import
            const firstImport = content.match(/^import .*/m);
            if (firstImport) {
              content =
                'import { NextRequest } from "next/server";\n' + content;
              modified = true;
            }
          }
        }
      }
    }
  }

  // Pattern 2: Fix function signature - add req parameter if missing
  const functionPatterns = [
    /export async function (GET|POST|PUT|DELETE)\(\)/g,
    /export async function (GET|POST|PUT|DELETE)\(_request: NextRequest\)/g,
  ];

  for (const pattern of functionPatterns) {
    if (pattern.test(content)) {
      // Check if function uses req but doesn't have it as parameter
      const functionMatch = content.match(
        /export async function (GET|POST|PUT|DELETE)\([^)]*\)/g
      );
      if (functionMatch) {
        for (const match of functionMatch) {
          if (
            (match.includes("()") || match.includes("_request")) &&
            (content.includes("req.url") ||
              content.includes("req.clone()") ||
              content.includes("rateLimit(req"))
          ) {
            if (match.includes("()")) {
              content = content.replace(
                /export async function (GET|POST|PUT|DELETE)\(\)/,
                "export async function $1(req: NextRequest)"
              );
              modified = true;
            } else if (match.includes("_request")) {
              // Add const req = _request; after try {
              const tryMatch = content.match(/export async function \w+\(_request: NextRequest\) \{[\s\S]*?try \{/);
              if (tryMatch && !content.includes("const req = _request")) {
                content = content.replace(
                  /(export async function \w+\(_request: NextRequest\) \{[\s\S]*?try \{)/,
                  "$1\n    const req = _request;"
                );
                modified = true;
              }
            }
          }
        }
      }
    }
  }

  // Pattern 3: Fix createClient() -> createAdminClient() for admin operations
  if (
    content.includes("await createClient()") &&
    (content.includes("createAdminClient") ||
      content.includes("admin") ||
      content.includes("SUPABASE_SERVICE_ROLE_KEY"))
  ) {
    content = content.replace(/await createClient\(\)/g, "createAdminClient()");
    modified = true;
  }

  if (modified) {
    writeFileSync(filePath, content, "utf-8");
    return true;
  }

  return false;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  try {
    const files = readdirSync(dirPath);
    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (statSync(filePath).isDirectory()) {
        getAllFiles(filePath, arrayOfFiles);
      } else if (file.endsWith(".ts")) {
        arrayOfFiles.push(filePath);
      }
    });
  } catch {
    // Ignore errors
  }
  return arrayOfFiles;
}

async function main() {
  console.log("🔧 Fixing TypeScript errors in API routes...");

  const files = getAllFiles(API_ROUTES_DIR);

  let fixed = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      fixed++;
      console.log(`✅ Fixed: ${path.relative(API_ROUTES_DIR, file)}`);
    }
  }

  console.log(`\n✨ Fixed ${fixed} files`);
}

main().catch(console.error);

