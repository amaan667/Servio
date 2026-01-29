#!/usr/bin/env tsx
/**
 * Comprehensive script to fix all syntax errors from incomplete logger removals
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { join, extname } from "path";

const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".turbo",
  "test-results",
  "__tests__",
  "scripts",
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

function shouldProcessFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() || "";
  if (fileName.includes("fix-") || fileName.includes("remove-")) {
    return false;
  }
  const ext = extname(filePath);
  return EXTENSIONS.includes(ext);
}

function shouldProcessDir(dirName: string): boolean {
  return !EXCLUDED_DIRS.includes(dirName);
}

function fixSyntaxErrors(content: string): string {
  // Fix incomplete object properties - lines that are just colons or commas
  content = content.replace(/^\s*:\s*[^,}]*,\s*$/gm, "");
  content = content.replace(/^\s*,\s*$/gm, "");

  // Fix incomplete function calls - lines ending with just a comma or opening paren
  content = content.replace(/^\s*,\s*$/gm, "");
  content = content.replace(/^\s*\(\s*$/gm, "");

  // Fix incomplete object literals - lines with just closing braces/parens
  content = content.replace(/^\s*\}\s*,\s*$/gm, "");
  content = content.replace(/^\s*\)\s*,\s*$/gm, "");

  // Fix incomplete try-catch blocks
  content = content.replace(
    /try\s*\{\s*\n\s*\n\s*catch/gm,
    "try {\n    // Empty try block\n  } catch"
  );

  // Fix incomplete if statements
  content = content.replace(/if\s*\([^)]*\)\s*\{\s*\n\s*\n\s*else/gm, (match) => {
    return match.replace(/\{\s*\n\s*\n\s*else/, "{\n    // Empty if block\n  } else");
  });

  // Fix incomplete return statements
  content = content.replace(/return\s*\{\s*\n\s*\n\s*\};/gm, "return {};");

  // Fix incomplete array/object destructuring
  content = content.replace(/const\s+\{\s*\n\s*\n\s*\}/gm, "const {} = {};");

  // Fix incomplete template literals
  content = content.replace(/`[^`]*\$\{[^}]*$/gm, (match) => {
    // Try to close the template literal
    if (!match.includes("`")) {
      return match + "`";
    }
    return match;
  });

  // Fix incomplete string literals
  content = content.replace(/"[^"]*$/gm, (match) => {
    if ((match.match(/"/g) || []).length % 2 !== 0) {
      return match + '"';
    }
    return match;
  });

  // Remove orphaned closing braces/parens on their own lines
  content = content.replace(/^\s*\}\s*\}\s*$/gm, "");
  content = content.replace(/^\s*\)\s*\)\s*$/gm, "");

  // Fix incomplete method chains
  content = content.replace(/\.\s*\n\s*\./gm, ".");
  content = content.replace(/\.\s*\n\s*\(/gm, "(");

  // Clean up multiple empty lines
  content = content.replace(/\n{4,}/g, "\n\n\n");

  return content;
}

function processFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const newContent = fixSyntaxErrors(content);

    if (content !== newContent) {
      writeFileSync(filePath, newContent, "utf-8");
      return true;
    }

    return false;
  } catch (error) {
    return false;
  }
}

function walkDirectory(dir: string): number {
  let modifiedCount = 0;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (shouldProcessDir(entry)) {
          modifiedCount += walkDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        if (shouldProcessFile(fullPath)) {
          if (processFile(fullPath)) {
            modifiedCount++;
          }
        }
      }
    }
  } catch (error) {
    // Ignore errors
  }

  return modifiedCount;
}

const rootDir = join(__dirname, "..");

const modified = walkDirectory(rootDir);
