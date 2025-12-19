/**
 * Script to remove all TODO/FIXME/XXX/HACK comments from production code
 * Excludes scripts directory and test files
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const EXCLUDE_DIRS = [
  "node_modules",
  ".next",
  "coverage",
  "dist",
  "build",
  "__tests__",
  "scripts",
  "test-results",
];
const INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

let totalRemoved = 0;
const filesModified: string[] = [];

function shouldProcessFile(filePath: string): boolean {
  const ext = extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext);
}

function shouldSkipDir(dirName: string): boolean {
  return EXCLUDE_DIRS.includes(dirName) || dirName.startsWith(".");
}

function removeTodos(content: string): string {
  let result = content;

  // Remove single-line TODO/FIXME/HACK/XXX comments
  result = result.replace(/^\s*\/\/\s*TODO[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*FIXME[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*HACK[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*XXX[^\n]*/gim, "");

  // Remove TODO: in comments
  result = result.replace(/\/\/\s*TODO:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*FIXME:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*HACK:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*XXX:[^\n]*/gim, "");

  // Remove multi-line comments with TODO/FIXME
  result = result.replace(/\/\*[\s\S]*?TODO[\s\S]*?\*\//g, "");
  result = result.replace(/\/\*[\s\S]*?FIXME[\s\S]*?\*\//g, "");
  result = result.replace(/\/\*[\s\S]*?HACK[\s\S]*?\*\//g, "");
  result = result.replace(/\/\*[\s\S]*?XXX[\s\S]*?\*\//g, "");

  // Remove inline TODO comments
  result = result.replace(/\s*\/\/\s*TODO[^\n]*/gim, "");
  result = result.replace(/\s*\/\/\s*FIXME[^\n]*/gim, "");

  return result;
}

function processFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");

    // Count TODOs before removal
    const todoMatches = content.match(/TODO|FIXME|HACK|XXX/gi);
    if (!todoMatches) {
      return; // No TODOs in this file
    }

    // Skip if it's a translation string (Portuguese "TODO" means "all day")
    if (filePath.includes("translation-executor")) {
      return;
    }

    // Skip Storybook files
    if (filePath.includes(".stories.")) {
      return;
    }

    const fixed = removeTodos(content);

    if (fixed !== content) {
      writeFileSync(filePath, fixed, "utf-8");
      const count = todoMatches.length;
      totalRemoved += count;
      filesModified.push(filePath);
      console.log(`✓ ${filePath}: Removed ${count} TODO/FIXME comment(s)`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
  }
}

function walkDirectory(dirPath: string): void {
  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!shouldSkipDir(entry)) {
        walkDirectory(fullPath);
      }
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      processFile(fullPath);
    }
  }
}

// Main execution
const rootDir = join(process.cwd());
console.log("Removing TODO/FIXME/HACK/XXX comments from production code...\n");

walkDirectory(rootDir);

console.log(`\n✓ Removed ${totalRemoved} TODO/FIXME comments from ${filesModified.length} files`);
console.log("\n⚠️  Review changes before committing!");
console.log("Run: git diff to see all changes");

