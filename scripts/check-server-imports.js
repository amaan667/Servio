#!/usr/bin/env node

/**
 * Build-time guard to prevent server-side imports of browser-only Supabase client
 * This script checks for imports of @/lib/supabase/client in server files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files that should never import the browser client
const SERVER_PATTERNS = [
  'app/**/*.ts',
  'app/**/*.tsx',
  'lib/**/*.ts',
  'lib/**/*.tsx',
  'middleware.ts',
  'pages/api/**/*.ts',
  'pages/api/**/*.tsx'
];

// Exclude client components and browser-only files
const CLIENT_EXCLUSIONS = [
  '**/*.client.ts',
  '**/*.client.tsx',
  '**/page.client.ts',
  '**/page.client.tsx',
  '**/client.ts',
  '**/client.tsx',
  'lib/supabase/client.ts'
];

// Pattern to match browser client imports
const BROWSER_CLIENT_IMPORT = /from\s+['"]@\/lib\/supabase\/client['"]/;

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip files with "use client" directive
    if (content.includes('"use client"') || content.includes("'use client'")) {
      return null;
    }
    
    // Check for browser client imports
    if (BROWSER_CLIENT_IMPORT.test(content)) {
      return {
        file: filePath,
        lines: content.split('\n').map((line, index) => ({
          number: index + 1,
          content: line.trim()
        })).filter(line => BROWSER_CLIENT_IMPORT.test(line.content))
      };
    }
    
    return null;
  } catch (error) {
    console.warn(`Warning: Could not read file ${filePath}:`, error.message);
    return null;
  }
}

function main() {
  console.log('🔍 Checking for server-side imports of browser client...');
  
  let hasErrors = false;
  const errors = [];
  
  // Check each server pattern
  SERVER_PATTERNS.forEach(pattern => {
    const files = glob.sync(pattern, {
      ignore: CLIENT_EXCLUSIONS,
      cwd: process.cwd()
    });
    
    files.forEach(file => {
      const result = checkFile(file);
      if (result) {
        hasErrors = true;
        errors.push(result);
      }
    });
  });
  
  if (hasErrors) {
    console.error('\n❌ BUILD FAILED: Server-side imports of browser client detected!');
    console.error('\nThe following server files are importing @/lib/supabase/client:');
    
    errors.forEach(error => {
      console.error(`\n📁 ${error.file}:`);
      error.lines.forEach(line => {
        console.error(`   Line ${line.number}: ${line.content}`);
      });
    });
    
    console.error('\n🚫 FIX: Server files should only import @/lib/supabase/server');
    console.error('   Client files should import @/lib/supabase/client');
    console.error('   Add "use client" directive to files that need browser client');
    
    process.exit(1);
  }
  
  console.log('✅ No server-side browser client imports found');
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, main };