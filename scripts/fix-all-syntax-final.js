/**
 * Final comprehensive script to fix all syntax errors
 * Fixes: duplicate searchParams, duplicate venueId, req vs _request mismatches
 */

const fs = require('fs');
const path = require('path');

function fixSyntaxErrors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const lines = content.split('\n');
  const fixedLines = [];
  
  let skipDuplicateAuth = false;
  let inDuplicateAuthBlock = false;
  let foundBodyParse = false;
  let venueIdDeclared = false;
  let searchParamsDeclared = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect duplicate auth block
    if (line.includes('CRITICAL: Authentication') && venueIdDeclared && !foundBodyParse) {
      inDuplicateAuthBlock = true;
      skipDuplicateAuth = true;
      continue;
    }
    
    // Mark venueId as declared
    if (line.includes('let venueId') || line.includes('const venueId')) {
      if (venueIdDeclared && !foundBodyParse) {
        // Skip duplicate
        continue;
      }
      venueIdDeclared = true;
    }
    
    // Mark searchParams as declared
    if (line.includes('const { searchParams }')) {
      if (searchParamsDeclared && !foundBodyParse) {
        // Skip duplicate
        continue;
      }
      searchParamsDeclared = true;
    }
    
    // Detect body parsing - end of auth block
    if (line.includes('const body') || line.includes('await req.json()') || line.includes('await _request.json()') || line.includes('await request.json()')) {
      foundBodyParse = true;
      inDuplicateAuthBlock = false;
      skipDuplicateAuth = false;
    }
    
    // Skip lines in duplicate auth block
    if (skipDuplicateAuth && !foundBodyParse) {
      continue;
    }
    
    // Fix req vs _request mismatch
    if (line.includes('req.url') && content.includes('_request: NextRequest') && !content.includes('req: NextRequest')) {
      fixedLines.push(line.replace(/req\.url/g, '_request.url').replace(/req\.clone\(\)/g, '_request.clone()').replace(/req,/g, '_request,'));
      continue;
    }
    
    // Fix req vs request mismatch
    if (line.includes('req.url') && content.includes('request: NextRequest') && !content.includes('req: NextRequest')) {
      fixedLines.push(line.replace(/req\.url/g, 'request.url').replace(/req\.clone\(\)/g, 'request.clone()').replace(/req,/g, 'request,'));
      continue;
    }
    
    fixedLines.push(line);
  }

  const newContent = fixedLines.join('\n');
  if (newContent !== originalContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    return true;
  }
  return false;
}

function findApiRoutes(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      findApiRoutes(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.tsx') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

const apiDir = path.join(__dirname, '..', 'app', 'api');
const routes = findApiRoutes(apiDir);

let fixedCount = 0;
routes.forEach(route => {
  try {
    if (fixSyntaxErrors(route)) {
      console.log(`✓ Fixed: ${route}`);
      fixedCount++;
    }
  } catch (error) {
    // Skip errors
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);

