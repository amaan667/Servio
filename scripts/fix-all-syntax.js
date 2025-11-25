/**
 * Comprehensive script to fix all syntax errors from batch auth script
 */

const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const lines = content.split('\n');
  const fixedLines = [];
  
  let skipUntilBody = false;
  let foundBody = false;
  let venueIdDeclared = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect duplicate auth block start
    if (line.includes('CRITICAL: Authentication') && !foundBody) {
      // Check if this is a duplicate (if we already have venueId declared)
      if (venueIdDeclared) {
        skipUntilBody = true;
        modified = true;
        continue;
      }
      venueIdDeclared = true;
    }
    
    // Detect body parsing - end of auth block
    if (line.includes('const body') || line.includes('await req.json()') || line.includes('await _request.json()')) {
      foundBody = true;
      skipUntilBody = false;
    }
    
    // Skip duplicate auth block lines
    if (skipUntilBody && !foundBody) {
      continue;
    }
    
    // Fix duplicate searchParams
    if (line.includes('const { searchParams }') && fixedLines.some(l => l.includes('const { searchParams }'))) {
      // Skip duplicate
      modified = true;
      continue;
    }
    
    // Fix req vs _request mismatch
    if (line.includes('req.url') && content.includes('_request: NextRequest')) {
      fixedLines.push(line.replace('req.url', '_request.url').replace('req.clone()', '_request.clone()').replace('req,', '_request,'));
      modified = true;
      continue;
    }
    
    // Fix duplicate venueId declarations
    if (line.includes('const { venueId }') && venueIdDeclared) {
      // Change to use existing venueId or extract differently
      const match = line.match(/const \{ venueId(.*)\} =/);
      if (match) {
        fixedLines.push(line.replace('const { venueId', 'const { venueId: venueIdFromBody'));
        modified = true;
        continue;
      }
    }
    
    fixedLines.push(line);
  }

  if (modified) {
    fs.writeFileSync(filePath, fixedLines.join('\n'), 'utf8');
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
const errors = [];

routes.forEach(route => {
  try {
    if (fixFile(route)) {
      console.log(`✓ Fixed: ${route}`);
      fixedCount++;
    }
  } catch (error) {
    errors.push({ route, error: error.message });
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);
if (errors.length > 0) {
  console.log(`\n✗ ${errors.length} errors:`);
  errors.forEach(e => console.log(`  - ${e.route}: ${e.error}`));
}

