#!/usr/bin/env node
/**
 * Remove console.log statements from production code
 */

const fs = require('fs');
const path = require('path');

const files = [
  'app',
  'components',
  'hooks',
  'lib',
];

let totalRemoved = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;
  
  // Remove console statements (but keep eslint-disable comments)
  const patterns = [
    // console.log(...);
    [/^\s*console\.log\([^)]*\);?\s*$/gm, ''],
    // console.warn(...);
    [/^\s*console\.warn\([^)]*\);?\s*$/gm, ''],
    // console.error(...);
    [/^\s*console\.error\([^)]*\);?\s*$/gm, ''],
    // console.debug(...);
    [/^\s*console\.debug\([^)]*\);?\s*$/gm, ''],
    // console.info(...);
    [/^\s*console\.info\([^)]*\);?\s*$/gm, ''],
    // console.trace(...);
    [/^\s*console\.trace\([^)]*\);?\s*$/gm, ''],
    // console.table(...);
    [/^\s*console\.table\([^)]*\);?\s*$/gm, ''],
    // console.dir(...);
    [/^\s*console\.dir\([^)]*\);?\s*$/gm, ''],
    // console.time(...);
    [/^\s*console\.time\([^)]*\);?\s*$/gm, ''],
    // console.timeEnd(...);
    [/^\s*console\.timeEnd\([^)]*\);?\s*$/gm, ''],
    // console.group(...);
    [/^\s*console\.group\([^)]*\);?\s*$/gm, ''],
    // console.groupEnd(...);
    [/^\s*console\.groupEnd\([^)]*\);?\s*$/gm, ''],
    // console.count(...);
    [/^\s*console\.count\([^)]*\);?\s*$/gm, ''],
    // console.clear();
    [/^\s*console\.clear\(\);?\s*$/gm, ''],
  ];
  
  patterns.forEach(([pattern]) => {
    if (newContent.match(pattern)) {
      newContent = newContent.replace(pattern, '');
      modified = true;
    }
  });
  
  if (modified) {
    // Clean up multiple empty lines
    newContent = newContent.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalRemoved++;
    console.log(`✅ Cleaned ${filePath}`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist' || entry.name === 'build' || entry.name === '__tests__') {
        continue;
      }
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      processFile(fullPath);
    }
  }
}

files.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(fullPath)) {
    walkDir(fullPath);
  }
});

console.log(`\n✅ Cleaned ${totalRemoved} files!`);

