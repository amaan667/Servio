#!/usr/bin/env node
/**
 * Standardize API route handlers
 * - Add runtime configs
 * - Replace Request with NextRequest
 * - Add proper imports
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

function standardizeAPIRoutes() {
  const apiDir = path.join(process.cwd(), 'app', 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('⚠ No app/api directory found');
    return { standardized: 0, modified: [] };
  }
  
  const routeFiles = getAllFiles(apiDir, ['route.ts']);
  let standardized = 0;
  const modified = [];
  
  for (const file of routeFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let fileModified = false;
    
    // Add runtime config if missing
    if (!content.includes("export const runtime")) {
      content = `export const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\n\n${content}`;
      fileModified = true;
    }
    
    // Ensure NextRequest is imported
    if (content.includes('async function') && !content.includes('NextRequest')) {
      const hasNextServerImport = content.includes("from 'next/server'") || content.includes('from "next/server"');
      if (hasNextServerImport) {
        // Add NextRequest to existing import
        content = content.replace(
          /from ['"]next\/server['"]/,
          "{ NextRequest, NextResponse } from 'next/server'"
        );
        fileModified = true;
      } else {
        // Add new import
        const firstImport = content.match(/^import .+/m);
        if (firstImport) {
          content = content.replace(
            firstImport[0],
            `${firstImport[0]}\nimport { NextRequest, NextResponse } from 'next/server';`
          );
          fileModified = true;
        }
      }
    }
    
    // Replace Request with NextRequest in function signatures
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const method of httpMethods) {
      const pattern = new RegExp(`async function ${method}\\(req: Request\\)`, 'g');
      if (pattern.test(content)) {
        content = content.replace(pattern, `async function ${method}(req: NextRequest)`);
        fileModified = true;
      }
    }
    
    if (fileModified) {
      fs.writeFileSync(file, content, 'utf-8');
      modified.push(file);
      standardized++;
    }
  }
  
  console.log(`✓ Standardized ${standardized} API route files`);
  console.log(`✓ Modified ${modified.length} files`);
  
  return { standardized, modified };
}

standardizeAPIRoutes();

