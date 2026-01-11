#!/usr/bin/env tsx
/**
 * Script to fix incomplete logger removals that left syntax errors
 * Fixes patterns like:
 * - `,` on its own line
 * - `: null,` or `: something,` without preceding code
 * - Incomplete object literals
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const EXCLUDED_DIRS = ["node_modules", ".git", ".next", "dist", "build", ".turbo", "test-results", "__tests__"];

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function shouldProcessFile(filePath: string): boolean {
  const ext = extname(filePath);
  return EXTENSIONS.includes(ext);
}

function shouldProcessDir(dirName: string): boolean {
  return !EXCLUDED_DIRS.includes(dirName);
}

function fixIncompleteRemovals(content: string): string {
  // Remove lines that are just commas or colons
  content = content.replace(/^\s*,\s*$/gm, "");
  content = content.replace(/^\s*:\s*$/gm, "");
  
  // Remove lines starting with just a comma followed by code
  content = content.replace(/^\s*,\s*([^,}]+),?\s*$/gm, "");
  
  // Remove incomplete object properties like `: null,` or `: something,`
  content = content.replace(/^\s*:\s*[^,}]+,?\s*$/gm, "");
  
  // Remove incomplete logger calls like `logger.` without method
  content = content.replace(/logger\.\s*$/gm, "");
  
  // Remove incomplete console calls
  content = content.replace(/console\.\s*$/gm, "");
  
  // Remove lines with just `});` that might be orphaned
  content = content.replace(/^\s*\}\);?\s*$/gm, "");
  
  // Remove orphaned object properties
  content = content.replace(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^,}]+,?\s*$/gm, "");
  
  // Clean up multiple empty lines
  content = content.replace(/\n{3,}/g, "\n\n");
  
  return content;
}

function processFile(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const newContent = fixIncompleteRemovals(content);
    
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
            console.log(`Fixed: ${fullPath}`);
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
console.log(`Fixing incomplete logger removals in: ${rootDir}`);
const modified = walkDirectory(rootDir);
console.log(`\nDone! Fixed ${modified} files.`);
