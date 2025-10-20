#!/usr/bin/env node
/**
 * Fix remaining TypeScript errors
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  {
    file: 'lib/api/response-helpers.ts',
    pattern: /\.\.\.\(details && \{ details \}\)/g,
    replacement: '...(details ? { details } : {})',
  },
  {
    file: 'lib/api/handler-wrapper.ts',
    pattern: /return async \(req: NextRequest\) => \{/g,
    replacement: 'return async (req: NextRequest): Promise<NextResponse<ApiResponse<TResponse>>> => {',
  },
  {
    file: 'lib/auth/client.ts',
    pattern: /return !error && user \? user\.email : null;/g,
    replacement: 'return !error && user ? user.email ?? null : null;',
  },
];

fixes.forEach(({ file, pattern, replacement }) => {
  const fullPath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  if (content.match(pattern)) {
    content = content.replace(pattern, replacement);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Fixed ${file}`);
  }
});

console.log('\n✅ Fixed critical TypeScript errors!');

