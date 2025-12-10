/**
 * Script to replace console.log statements with proper logger calls
 * This script helps maintain code quality by using the centralized logger
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

const EXCLUDE_DIRS = ["node_modules", ".next", "coverage", "dist", "build", "__tests__"];
const INCLUDE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

interface Replacement {
  file: string;
  line: number;
  original: string;
  replacement: string;
}

const replacements: Replacement[] = [];

function shouldProcessFile(filePath: string): boolean {
  const ext = extname(filePath);
  return INCLUDE_EXTENSIONS.includes(ext);
}

function shouldSkipDir(dirName: string): boolean {
  return EXCLUDE_DIRS.includes(dirName) || dirName.startsWith(".");
}

function processFile(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    let modified = false;
    const newLines: string[] = [];

    // Check if file already imports logger
    const hasLoggerImport = content.includes('from "@/lib/logger"') || content.includes('from "../lib/logger"');

    lines.forEach((line, index) => {
      // Skip if line is commented out
      if (line.trim().startsWith("//")) {
        newLines.push(line);
        return;
      }

      // Match console.log, console.info, console.debug, console.warn
      const consoleLogMatch = line.match(/console\.(log|info|debug|warn)\s*\(/);
      
      if (consoleLogMatch) {
        const method = consoleLogMatch[1];
        const indent = line.match(/^(\s*)/)?.[1] || "";
        
        // Extract the arguments
        const argsMatch = line.match(/console\.(log|info|debug|warn)\s*\((.*)\)/);
        if (argsMatch) {
          const args = argsMatch[2];
          
          // Determine logger method
          let loggerMethod = "debug";
          if (method === "warn") loggerMethod = "warn";
          else if (method === "info") loggerMethod = "info";
          else if (method === "log") loggerMethod = "debug";
          
          // Create replacement
          let replacement = "";
          
          // Add logger import if needed
          if (!hasLoggerImport && !modified) {
            // Find the last import statement
            let lastImportIndex = -1;
            for (let i = index - 1; i >= 0; i--) {
              if (lines[i].includes("import ")) {
                lastImportIndex = i;
                break;
              }
            }
            
            if (lastImportIndex >= 0) {
              newLines[lastImportIndex] += '\nimport { logger } from "@/lib/logger";';
            } else {
              newLines.unshift('import { logger } from "@/lib/logger";');
            }
          }
          
          // Replace console call
          // Try to parse arguments intelligently
          if (args.includes('"') || args.includes("'")) {
            // String arguments - use as message
            replacement = `${indent}logger.${loggerMethod}(${args});`;
          } else {
            // Complex arguments - wrap in object
            replacement = `${indent}logger.${loggerMethod}({ data: ${args} });`;
          }
          
          replacements.push({
            file: filePath,
            line: index + 1,
            original: line,
            replacement: replacement,
          });
          
          newLines.push(replacement);
          modified = true;
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    });

    if (modified) {
      writeFileSync(filePath, newLines.join("\n"), "utf-8");
      logger.debug({ data: `✓ Processed: ${filePath}` });
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
logger.debug("Cleaning up console.log statements...\n");

walkDirectory(rootDir);

logger.debug({ data: `\n✓ Processed ${replacements.length} replacements` });
logger.debug("\nSummary:");
const fileCounts = new Map<string, number>();
replacements.forEach((r) => {
  fileCounts.set(r.file, (fileCounts.get(r.file) || 0) + 1);
});

fileCounts.forEach((count, file) => {
  logger.debug({ data: `  ${file}: ${count} replacements` });
});

logger.debug("\n⚠️  Review changes before committing!");
logger.debug("Run: git diff to see all changes");

