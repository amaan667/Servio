#!/usr/bin/env node

/**
 * Remove ALL console statements from source files
 * Production code should use logger utility only
 */

import fs from 'fs';
import { glob } from 'glob';

let totalFiles = 0;
let totalRemoved = 0;

async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const newLines = [];
  
  let linesRemoved = 0;
  let skip = false;
  let skipDepth = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check if line contains console statement
    if (trimmed.match(/^console\.(log|info|debug|warn|error|trace|table|dir|time|timeEnd|assert|count|group|groupEnd|clear)\(/)) {
      skip = true;
      skipDepth = 0;
      linesRemoved++;
      
      // Count opening/closing parens to handle multi-line
      const opens = (line.match(/\(/g) || []).length;
      const closes = (line.match(/\)/g) || []).length;
      skipDepth = opens - closes;
      
      if (skipDepth <= 0 || trimmed.endsWith(');')) {
        skip = false;
      }
      continue;
    }
    
    // Skip multi-line console statements
    if (skip) {
      linesRemoved++;
      const opens = (line.match(/\(/g) || []).length;
      const closes = (line.match(/\)/g) || []).length;
      skipDepth += opens - closes;
      
      if (skipDepth <= 0 || trimmed.endsWith(');')) {
        skip = false;
      }
      continue;
    }
    
    newLines.push(line);
  }
  
  if (linesRemoved > 0) {
    // Remove excessive blank lines
    let newContent = newLines.join('\n');
    newContent = newContent.replace(/\n\n\n+/g, '\n\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ ${filePath}: Removed ${linesRemoved} console statements`);
    totalRemoved += linesRemoved;
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🧹 Removing ALL console statements (production cleanup)...\n');

  const patterns = [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
  ];

  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'] 
    });
    
    for (const file of files) {
      const modified = await processFile(file);
      if (modified) totalFiles++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`📝 Files modified: ${totalFiles}`);
  console.log(`🗑️  Lines removed: ${totalRemoved}`);
}

main().catch(console.error);

