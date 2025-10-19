#!/usr/bin/env node
/**
 * Fix API route import syntax errors
 * Fixes: import { NextResponse } { NextRequest, NextResponse } from 'next/server';
 * To:     import { NextRequest, NextResponse } from 'next/server';
 */

const fs = require('fs');
const path = require('path');

function getAllFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, extensions));
    } else if (extensions.some(ext => filePath.endsWith(ext))) {
      results.push(filePath);
    }
  }
  
  return results;
}

function fixApiImports() {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('⚠ No app/api directory found');
    return { fixed: 0, modified: [] };
  }
  
  const routeFiles = getAllFiles(apiDir, ['route.ts']);
  let fixed = 0;
  const modified = [];
  
  for (const file of routeFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let fileModified = false;
    
    // Fix: import { NextResponse } { NextRequest, NextResponse } from 'next/server';
    // To:   import { NextRequest, NextResponse } from 'next/server';
    const brokenImportPattern = /import \{ NextResponse \} \{ NextRequest, NextResponse \} from ['"]next\/server['"];?/g;
    if (brokenImportPattern.test(content)) {
      content = content.replace(brokenImportPattern, "import { NextRequest, NextResponse } from 'next/server';");
      fileModified = true;
    }
    
    // Fix: import { NextRequest } { NextRequest, NextResponse } from 'next/server';
    // To:   import { NextRequest, NextResponse } from 'next/server';
    const brokenImportPattern2 = /import \{ NextRequest \} \{ NextRequest, NextResponse \} from ['"]next\/server['"];?/g;
    if (brokenImportPattern2.test(content)) {
      content = content.replace(brokenImportPattern2, "import { NextRequest, NextResponse } from 'next/server';");
      fileModified = true;
    }
    
    // Fix: import { NextResponse } from 'next/server'; import { NextRequest, NextResponse } from 'next/server';
    // To:   import { NextRequest, NextResponse } from 'next/server';
    const duplicateImportPattern = /import \{ NextResponse \} from ['"]next\/server['"];?\s*import \{ NextRequest, NextResponse \} from ['"]next\/server['"];?/g;
    if (duplicateImportPattern.test(content)) {
      content = content.replace(duplicateImportPattern, "import { NextRequest, NextResponse } from 'next/server';");
      fileModified = true;
    }
    
    // Fix: import { NextRequest } from 'next/server'; import { NextRequest, NextResponse } from 'next/server';
    // To:   import { NextRequest, NextResponse } from 'next/server';
    const duplicateImportPattern2 = /import \{ NextRequest \} from ['"]next\/server['"];?\s*import \{ NextRequest, NextResponse \} from ['"]next\/server['"];?/g;
    if (duplicateImportPattern2.test(content)) {
      content = content.replace(duplicateImportPattern2, "import { NextRequest, NextResponse } from 'next/server';");
      fileModified = true;
    }
    
    if (fileModified) {
      fs.writeFileSync(file, content, 'utf-8');
      modified.push(file);
      fixed++;
    }
  }
  
  console.log(`✓ Fixed ${fixed} API route files`);
  console.log(`✓ Modified ${modified.length} files`);
  
  return { fixed, modified };
}

fixApiImports();

