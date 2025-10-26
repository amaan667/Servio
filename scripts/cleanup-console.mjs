#!/usr/bin/env node

/**
 * Production Console Cleanup Script
 * 
 * Removes ALL console statements except:
 * - console.error() - Critical errors only
 * - console.warn() - Important warnings only
 * 
 * Removes:
 * - console.log()
 * - console.info()
 * - console.debug()
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DIRECTORIES = ['app', 'components', 'lib', 'hooks'];

// Patterns to remove (complete lines)
const REMOVE_PATTERNS = [
  // console.log with any content
  /^\s*console\.log\([^;]*\);?\s*$/gm,
  
  // console.info with any content
  /^\s*console\.info\([^;]*\);?\s*$/gm,
  
  // console.debug with any content
  /^\s*console\.debug\([^;]*\);?\s*$/gm,
  
  // Multi-line console.log
  /^\s*console\.log\([^)]*$/gm,
  /^[^)]*\);?\s*$/gm,
];

let totalFilesProcessed = 0;
let totalFilesModified = 0;
let totalLinesRemoved = 0;

async function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const newLines = [];
    
    let inConsoleStatement = false;
    let consoleType = null;
    let linesRemovedInFile = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Check if this line starts a console statement we want to remove
      if (trimmed.match(/^console\.(log|info|debug)\(/)) {
        inConsoleStatement = true;
        consoleType = trimmed.match(/^console\.(log|info|debug)/)[1];
        linesRemovedInFile++;
        
        // Check if it's a single-line console statement
        if (trimmed.includes(');')) {
          inConsoleStatement = false;
          consoleType = null;
        }
        continue; // Skip this line
      }
      
      // If we're inside a multi-line console statement
      if (inConsoleStatement) {
        linesRemovedInFile++;
        if (trimmed.includes(');')) {
          inConsoleStatement = false;
          consoleType = null;
        }
        continue; // Skip this line
      }
      
      // Keep all other lines (including console.error and console.warn)
      newLines.push(line);
    }
    
    // Remove excessive blank lines (left after removing console statements)
    let newContent = newLines.join('\n');
    newContent = newContent.replace(/\n\n\n+/g, '\n\n');
    
    if (linesRemovedInFile > 0) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log(`✅ ${path.relative(process.cwd(), filePath)}: Removed ${linesRemovedInFile} lines`);
      totalFilesModified++;
      totalLinesRemoved += linesRemovedInFile;
    }
    
    totalFilesProcessed++;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

async function main() {
  console.log('🧹 Starting production console cleanup...\n');
  console.log('🎯 Removing: console.log, console.info, console.debug');
  console.log('✅ Keeping: console.error, console.warn\n');

  const files = [];
  
  for (const dir of DIRECTORIES) {
    const pattern = `${dir}/**/*.{ts,tsx}`;
    const found = await glob(pattern, { 
      ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'] 
    });
    files.push(...found);
  }

  console.log(`📂 Found ${files.length} files to check\n`);

  for (const file of files) {
    await processFile(file);
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`📊 Files processed: ${totalFilesProcessed}`);
  console.log(`📝 Files modified: ${totalFilesModified}`);
  console.log(`🗑️  Lines removed: ${totalLinesRemoved}`);
  console.log(`\n🔍 Run 'npm run lint' to verify`);
}

main().catch(console.error);

