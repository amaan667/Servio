#!/usr/bin/env tsx
/**
 * Script to remove all logging/debugging statements from the codebase
 * Removes:
 * - logger.* calls
 * - console.* calls
 * - debugger statements
 * - logger imports
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
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
];

const EXCLUDED_FILES = [
  "remove-all-logging.ts",
  "production-logger.ts",
  "logger.ts",
  "structured-logger.ts",
];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function shouldProcessFile(filePath: string): boolean {
  const fileName = filePath.split("/").pop() || "";
  if (EXCLUDED_FILES.includes(fileName)) {
    return false;
  }

  const ext = extname(filePath);
  if (!EXTENSIONS.includes(ext)) {
    return false;
  }

  return true;
}

function shouldProcessDir(dirName: string): boolean {
  return !EXCLUDED_DIRS.includes(dirName);
}

function removeLoggerCalls(content: string): string {
  // Remove logger.method(...) calls - handles multi-line with nested parentheses
  // Match from logger. to the matching closing paren, handling nested parens
  const loggerMethods = [
    "debug",
    "info",
    "warn",
    "error",
    "log",
    "apiRequest",
    "apiResponse",
    "authEvent",
    "dbQuery",
    "cacheHit",
    "cacheMiss",
    "performance",
    "authSuccess",
    "authFailure",
    "authAttempt",
    "dbError",
    "dbConnection",
    "cacheSet",
    "aiRequest",
    "aiResponse",
    "aiError",
  ];
  
  for (const method of loggerMethods) {
    // Match logger.method( ... ) with balanced parentheses
    const regex = new RegExp(
      `logger\\.${method}\\([^()]*(?:\\([^()]*(?:\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)[^()]*)*\\)[^()]*)*\\);?`,
      "gs"
    );
    content = content.replace(regex, "");
    
    // Also handle simpler cases (single line)
    content = content.replace(
      new RegExp(`logger\\.${method}\\([^)]*\\);?`, "g"),
      ""
    );
  }

  // Remove apiLogger.* calls
  content = content.replace(
    /apiLogger\.(debug|info|warn|error|log|apiRequest|apiResponse|apiError)\([^)]*\);?/gs,
    ""
  );

  // Remove authLogger.* calls
  content = content.replace(
    /authLogger\.(debug|info|warn|error|log|authSuccess|authFailure|authAttempt)\([^)]*\);?/gs,
    ""
  );

  // Remove dbLogger.* calls
  content = content.replace(
    /dbLogger\.(debug|info|warn|error|log|dbQuery|dbError|dbConnection)\([^)]*\);?/gs,
    ""
  );

  // Remove cacheLogger.* calls
  content = content.replace(
    /cacheLogger\.(debug|info|warn|error|log|cacheHit|cacheMiss|cacheSet)\([^)]*\);?/gs,
    ""
  );

  // Remove aiLogger.* calls
  content = content.replace(
    /aiLogger\.(debug|info|warn|error|log|aiRequest|aiResponse|aiError)\([^)]*\);?/gs,
    ""
  );

  // Remove structuredLogger.* calls
  content = content.replace(
    /structuredLogger\.(debug|info|warn|error|log)\([^)]*\);?/gs,
    ""
  );

  // Remove logApiCall(...) calls
  content = content.replace(/logApiCall\([^)]*\);?/g, "");

  // Remove logDbQuery(...) calls
  content = content.replace(/logDbQuery\([^)]*\);?/g, "");

  return content;
}

function removeLoggerImports(content: string): string {
  // Remove aliased imports like: import { apiLogger as logger } from "@/lib/logger";
  content = content.replace(
    /import\s+{\s*\w+Logger\s+as\s+logger\s*}\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );
  
  // Remove single-line logger imports
  content = content.replace(
    /import\s+{\s*logger(?:\s*,\s*\w+)*\s*}\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+{\s*\w+(?:\s*,\s*\w+)*\s*}\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+logger\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+\*\s+as\s+logger\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );

  // Remove logger from multi-import statements
  content = content.replace(
    /import\s+{\s*([^}]*),\s*logger\s*}\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+{\s*logger\s*,\s*([^}]*)\s*}\s+from\s+["']@\/lib\/logger["'];?\n/g,
    ""
  );

  // Remove from production-logger imports
  content = content.replace(
    /import\s+{\s*logger(?:\s*,\s*\w+)*\s*}\s+from\s+["']@\/lib\/logger\/production-logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+logger\s+from\s+["']@\/lib\/logger\/production-logger["'];?\n/g,
    ""
  );

  // Remove structured-logger imports
  content = content.replace(
    /import\s+{\s*structuredLogger(?:\s*,\s*\w+)*\s*}\s+from\s+["']@\/lib\/structured-logger["'];?\n/g,
    ""
  );
  content = content.replace(
    /import\s+structuredLogger\s+from\s+["']@\/lib\/structured-logger["'];?\n/g,
    ""
  );

  // Remove dynamic imports: const { logger } = await import("@/lib/logger");
  content = content.replace(
    /const\s+{\s*logger\s*}\s*=\s*await\s+import\(["']@\/lib\/logger["']\);?\n/g,
    ""
  );
  content = content.replace(
    /const\s+{\s*logger\s*}\s*=\s*await\s+import\(["']\.\.\/lib\/logger["']\);?\n/g,
    ""
  );

  return content;
}

function removeConsoleCalls(content: string): string {
  // Remove console.log/debug/info/warn/error/trace/table/dir/group/groupEnd/time/timeEnd/count/assert
  content = content.replace(
    /console\.(log|debug|info|warn|error|trace|table|dir|group|groupEnd|time|timeEnd|count|assert)\([^)]*\);?\n?/g,
    ""
  );

  return content;
}

function removeDebugger(content: string): string {
  // Remove debugger statements
  content = content.replace(/debugger;?\n?/g, "");

  return content;
}

function cleanEmptyLines(content: string): string {
  // Remove multiple consecutive empty lines (more than 2)
  content = content.replace(/\n{3,}/g, "\n\n");

  // Remove empty lines at start of file
  content = content.replace(/^\n+/, "");

  return content;
}

function processFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    let newContent = content;

    newContent = removeLoggerCalls(newContent);
    newContent = removeLoggerImports(newContent);
    newContent = removeConsoleCalls(newContent);
    newContent = removeDebugger(newContent);
    newContent = cleanEmptyLines(newContent);

    if (content !== newContent) {
      writeFileSync(filePath, newContent, "utf-8");
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
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
            console.log(`Modified: ${fullPath}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return modifiedCount;
}

// Main execution
const rootDir = join(__dirname, "..");
console.log(`Starting to remove all logging from: ${rootDir}`);
const modified = walkDirectory(rootDir);
console.log(`\nDone! Modified ${modified} files.`);
