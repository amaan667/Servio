/**
 * Fix duplicate variable declarations from batch script
 */

const fs = require('fs');
const path = require('path');

function fixDuplicates(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix duplicate venueId declarations
  const lines = content.split('\n');
  const fixedLines = [];
  let inAuthBlock = false;
  let venueIdDeclared = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect auth block start
    if (line.includes('CRITICAL: Authentication')) {
      inAuthBlock = true;
      venueIdDeclared = false;
    }

    // Detect venueId declaration in auth block
    if (inAuthBlock && (line.includes('let venueId') || line.includes('const venueId'))) {
      if (venueIdDeclared) {
        // Skip this venueId value for later use
        const match = line.match(/venueId\s*=\s*(.+)/);
        if (match) {
          // Skip this duplicate line
          modified = true;
          continue;
        }
      }
      venueIdDeclared = true;
    }

    // Detect end of auth block
    if (inAuthBlock && line.includes('const body') && line.includes('req.json()')) {
      inAuthBlock = false;
    }

    // Skip duplicate venueId from body if already declared in auth block
    if (venueIdDeclared && line.includes('const { venueId } = body') && !line.includes('body?.venueId')) {
      // Replace with extraction that doesn't redeclare
      fixedLines.push('    const venueIdFromBody = body?.venueId || body?.venue_id;');
      fixedLines.push('    if (!venueIdFromBody && !venueId) {');
      modified = true;
      continue;
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
routes.forEach(route => {
  try {
    if (fixDuplicates(route)) {
      console.log(`✓ Fixed: ${route}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`✗ Error fixing ${route}:`, error.message);
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);

