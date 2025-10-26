#!/usr/bin/env node

/**
 * Prefix common unused variables with _
 */

import fs from 'fs';
import { glob } from 'glob';

// Common unused variable names to prefix
const COMMON_UNUSED = [
  'error',
  'req',
  'request',
  '_request',
  'params',
  'payload',
  'data',
  'result',
  'response',
  'value',
  'options',
  'name',
  'props',
  'event',
  'e',
  'err',
];

async function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Pattern 1: catch (error) => catch (_error)
  if (content.match(/catch\s*\(\s*error\s*\)/)) {
    content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (_error)');
    modified = true;
  }
  
  if (content.match(/catch\s*\(\s*e\s*\)/)) {
    content = content.replace(/catch\s*\(\s*e\s*\)/g, 'catch (_e)');
    modified = true;
  }
  
  if (content.match(/catch\s*\(\s*err\s*\)/)) {
    content = content.replace(/catch\s*\(\s*err\s*\)/g, 'catch (_err)');
    modified = true;
  }
  
  // Pattern 2: Unused destructured variables
  // const { error } = ... => const { error: _error } = ...
  // This is complex, skip for now
  
  // Pattern 3: Unused function params
  // async function foo(req: Request) => async function foo(_req: Request)
  const unusedParamPatterns = [
    { from: /\breq:\s*Request\b/g, to: '_req: Request' },
    { from: /\brequest:\s*Request\b/g, to: '_request: Request' },
    { from: /\brequest:\s*NextRequest\b/g, to: '_request: NextRequest' },
    { from: /\b_request:\s*Request\b/g, to: '__request: Request' }, // Already prefixed
  ];
  
  unusedParamPatterns.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

async function main() {
  console.log('🔧 Fixing unused variables...\n');
  
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

