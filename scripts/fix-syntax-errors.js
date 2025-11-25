/**
 * Script to fix syntax errors from batch auth script
 * Removes duplicate auth blocks and fixes variable conflicts
 */

const fs = require('fs');
const path = require('path');

function fixSyntaxErrors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const lines = content.split('\n');
  const fixedLines = [];
  
  let inAuthBlock = false;
  let authBlockStart = -1;
  let braceCount = 0;
  let foundDuplicate = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect start of duplicate auth block
    if (line.includes('CRITICAL: Authentication') && !inAuthBlock) {
      // Check if next 30 lines contain another auth block
      let hasDuplicate = false;
      for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
        if (lines[j].includes('CRITICAL: Authentication')) {
          hasDuplicate = true;
          break;
        }
        if (lines[j].includes('export async function') || lines[j].includes('const body')) {
          break;
        }
      }
      
      if (hasDuplicate) {
        // Skip this first auth block
        inAuthBlock = true;
        authBlockStart = i;
        foundDuplicate = true;
        modified = true;
        continue;
      }
    }
    
    // Skip lines until we find the end of auth block
    if (inAuthBlock) {
      if (line.includes('const body') || line.includes('await req.json()') || line.includes('await _request.json()')) {
        inAuthBlock = false;
        // Don't skip this line, include it
        fixedLines.push(line);
        continue;
      }
      // Skip all lines in the duplicate auth block
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
    if (fixSyntaxErrors(route)) {
      console.log(`✓ Fixed: ${route}`);
      fixedCount++;
    }
  } catch (error) {
    console.error(`✗ Error fixing ${route}:`, error.message);
  }
});

console.log(`\n✓ Fixed ${fixedCount} files`);

