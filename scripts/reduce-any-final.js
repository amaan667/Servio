#!/usr/bin/env node
/**
 * Final aggressive any type reduction
 */

const fs = require('fs');
const path = require('path');

const files = [
  'app',
  'components',
  'hooks',
  'lib',
];

let totalFixed = 0;

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let newContent = content;
  
  // More aggressive any replacements
  const replacements = [
    // Function parameters with any
    [/\b([a-zA-Z_$][a-zA-Z0-9_$]*):\s*any\b/g, '$1: unknown'],
    // Array<any> -> Array<unknown>
    [/\bArray<any>\b/g, 'Array<unknown>'],
    // Record<string, any> -> Record<string, unknown>
    [/\bRecord<string,\s*any>\b/g, 'Record<string, unknown>'],
    // Promise<any> -> Promise<unknown>
    [/\bPromise<any>\b/g, 'Promise<unknown>'],
    // (): any => -> (): unknown =>
    [/\(\):\s*any\s*=>/g, '(): unknown =>'],
    // : any\b -> : unknown
    [/(?<![\w])any\b(?![\w])/g, 'unknown'],
  ];
  
  replacements.forEach(([pattern, replacement]) => {
    if (newContent.match(pattern)) {
      newContent = newContent.replace(pattern, replacement);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    totalFixed++;
    console.log(`✅ Fixed ${filePath}`);
  }
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
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

console.log(`\n✅ Fixed ${totalFixed} files!`);

