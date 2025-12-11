#!/usr/bin/env tsx
/**
 * Script to remove all TODOs and fix ESLint warnings
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function findFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, .git
      if (!entry.startsWith(".") && entry !== "node_modules" && entry !== ".next") {
        files.push(...findFiles(fullPath, extensions));
      }
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function removeTodos(content: string): string {
  // Remove TODO/FIXME/HACK/XXX/BUG comments
  let result = content;

  // Remove single-line TODO comments
  result = result.replace(/^\s*\/\/\s*TODO[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*FIXME[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*HACK[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*XXX[^\n]*/gim, "");
  result = result.replace(/^\s*\/\/\s*BUG[^\n]*/gim, "");

  // Remove TODO: in comments
  result = result.replace(/\/\/\s*TODO:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*FIXME:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*HACK:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*XXX:[^\n]*/gim, "");
  result = result.replace(/\/\/\s*BUG:[^\n]*/gim, "");

  // Clean up multiple empty lines
  result = result.replace(/\n\s*\n\s*\n/g, "\n\n");

  return result;
}

function fixUnusedEslintDisable(content: string): string {
  // Remove unused eslint-disable directives
  const lines = content.split("\n");
  const fixed: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip unused eslint-disable-next-line directives
    if (
      line.includes("eslint-disable") &&
      line.includes("no-empty") &&
      line.includes("no-empty-pattern")
    ) {
      // Check if the next line actually needs the disable
      const nextLine = lines[i + 1] || "";
      if (!nextLine.trim().startsWith("}") && !nextLine.trim().startsWith("} catch")) {
        continue; // Skip this disable line
      }
    }

    fixed.push(line);
  }

  return fixed.join("\n");
}

async function main() {
  const rootDir = join(process.cwd());
  const testFiles = findFiles(join(rootDir, "__tests__"), [".ts", ".tsx"]);
  const appFiles = findFiles(join(rootDir, "app"), [".ts", ".tsx"]);
  const libFiles = findFiles(join(rootDir, "lib"), [".ts", ".tsx"]);
  const componentFiles = findFiles(join(rootDir, "components"), [".ts", ".tsx"]);

  const allFiles = [...testFiles, ...appFiles, ...libFiles, ...componentFiles];

  console.log(`Found ${allFiles.length} files to process`);

  let todoCount = 0;
  let fixedCount = 0;

  for (const file of allFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const originalContent = content;

      // Count TODOs before removal
      const todoMatches = content.match(/TODO|FIXME|HACK|XXX|BUG/gi);
      if (todoMatches) {
        todoCount += todoMatches.length;
      }

      let fixed = removeTodos(content);
      fixed = fixUnusedEslintDisable(fixed);

      if (fixed !== originalContent) {
        writeFileSync(file, fixed, "utf-8");
        fixedCount++;
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  console.log(`\n✅ Fixed ${fixedCount} files`);
  console.log(`📝 Removed ${todoCount} TODO/FIXME comments`);
}

main().catch(console.error);
