/**
 * Remove console.log, console.debug, console.warn, and console.error statements
 * Keeps console statements in production-logger.ts (intentional for Railway)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, extname } from "path";

const rootDir = process.cwd();

function shouldProcessFile(filePath: string): boolean {
  const ext = extname(filePath);
  if (ext !== ".ts" && ext !== ".tsx") return false;

  // Exclude patterns
  if (filePath.includes("node_modules")) return false;
  if (filePath.includes(".next")) return false;
  if (filePath.includes("__tests__")) return false;
  if (filePath.includes("production-logger.ts")) return false;
  if (filePath.includes("test-log")) return false;
  if (filePath.includes("log-dashboard")) return false;
  if (filePath.includes("log-payment")) return false;
  if (filePath.includes(".test.")) return false;

  return true;
}

function removeConsoleStatements(content: string): string {
  // Remove single-line console.log
  content = content.replace(/^\s*console\.log\([^)]*\);?\s*$/gm, "");

  // Remove single-line console.debug
  content = content.replace(/^\s*console\.debug\([^)]*\);?\s*$/gm, "");

  // Remove single-line console.warn
  content = content.replace(/^\s*console\.warn\([^)]*\);?\s*$/gm, "");

  // Remove single-line console.error
  content = content.replace(/^\s*console\.error\([^)]*\);?\s*$/gm, "");

  // Remove multi-line console statements (simple cases)
  content = content.replace(/console\.(log|debug|warn|error)\([^;]*\);/gs, "");

  // Clean up excessive empty lines
  content = content.replace(/\n{3,}/g, "\n\n");

  return content;
}

function processDirectory(dir: string): number {
  let totalRemoved = 0;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          totalRemoved += processDirectory(fullPath);
        } else if (stat.isFile() && shouldProcessFile(fullPath)) {
          const content = readFileSync(fullPath, "utf-8");
          const originalMatches = (content.match(/console\.(log|debug|warn|error)/g) || []).length;

          if (originalMatches > 0) {
            const cleaned = removeConsoleStatements(content);
            const newMatches = (cleaned.match(/console\.(log|debug|warn|error)/g) || []).length;
            const removed = originalMatches - newMatches;

            if (removed > 0) {
              writeFileSync(fullPath, cleaned, "utf-8");
              totalRemoved += removed;
              console.log(
                `Removed ${removed} console statements from ${fullPath.replace(rootDir, "")}`
              );
            }
          }
        }
      } catch (err) {
        // Skip files we can't read
      }
    }
  } catch (err) {
    // Skip directories we can't read
  }

  return totalRemoved;
}

// Process app, components, and lib directories
const dirs = ["app", "components", "lib"];
let total = 0;

for (const dir of dirs) {
  const dirPath = join(rootDir, dir);
  try {
    total += processDirectory(dirPath);
  } catch {
    // Directory doesn't exist, skip
  }
}

console.log(`\n✓ Total console statements removed: ${total}`);
