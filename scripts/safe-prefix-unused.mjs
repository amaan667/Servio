#!/usr/bin/env node

/**
 * Safely prefix ONLY truly unused variables
 * Conservative approach - only obvious cases
 */

import fs from 'fs';
import { glob } from 'glob';

const SAFE_TO_PREFIX = [
  // Variables that are clearly never used
  'insertedItems', 'insertedHotspots', 'duration', 'scrapeDuration', 
  'aiDuration', 'totalDuration', 'requestId', 'recentError',
  'completionResult', 'orgSlug', 'userName', 'indexSQL', 'rlsSQL',
  'realtimeCounts', 'cartData', 'conversationsCheck', 'messagesCheck',
  'uploadData', 'browserPaths', 'item_count', 'total_amount',
];

async function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const varName of SAFE_TO_PREFIX) {
    // Only prefix if variable exists and is assigned but never read
    const assignPattern = new RegExp(`const ${varName} =`, 'g');
    const readPattern = new RegExp(`\\b${varName}\\b`, 'g');
    
    const assignments = (content.match(assignPattern) || []).length;
    const reads = (content.match(readPattern) || []).length;
    
    // If assigned once and only read once (the assignment itself), prefix it
    if (assignments === 1 && reads === 1) {
      content = content.replace(assignPattern, `const _${varName} =`);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔧 Safely prefixing obviously unused variables...\n');
  
  const files = await glob('{app,components,lib,hooks}/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/.next/**', '**/scripts/**']
  });
  
  let fixed = 0;
  for (const file of files) {
    if (await fixFile(file)) {
      console.log(`✅ ${file}`);
      fixed++;
    }
  }
  
  console.log(`\n✅ Fixed ${fixed} files`);
}

main().catch(console.error);

